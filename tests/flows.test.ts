/**
 * Flows (L2F_FLOWS): get_flows, set_flows and get_prototype_links against a mocked
 * figma global and a fake server.tool capture. No Figma or relay needed:
 *   bun test tests/flows.test.ts
 */
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { READ_BACK_ERROR, getFlows, setFlows } from "../src/llm2figma_plugin/src/prototyping";
import { assertEditorAllowed } from "../src/llm2figma_plugin/src/editor-gate";
import { BackgroundPaintsSchema, BackgroundSchema, NO_FILE_KEY, buildPrototypeLink, registerFlowTools } from "../src/llm2figma_mcp/tools/prototyping";
import { registerWhenEnabled } from "../src/shared/flags";

const KEY = "AbC123xyz789QrStUv";
const originalFigma = (globalThis as any).figma;
let nodes: Map<string, any>;
let page: any;
let otherPage: any;
let flowWrites: number;
let backgroundWrites: number;
let failBackground: boolean;

function node(id: string, type: string, name: string, parent?: any): any {
  const n: any = { id, type, name, parent: parent ?? null, children: [] };
  if (parent) parent.children.push(n);
  nodes.set(id, n);
  return n;
}

function makePage(id: string, name: string): any {
  const p = node(id, "PAGE", name);
  let flows: any[] = [];
  let backgrounds: any[] = [];
  p.loadAsync = async () => {};
  Object.defineProperty(p, "flowStartingPoints", {
    get: () => flows,
    set: (value) => { flowWrites++; flows = value.map((f: any) => ({ ...f })); },
    configurable: true,
  });
  Object.defineProperty(p, "prototypeBackgrounds", {
    get: () => backgrounds,
    set: (value) => {
      if (failBackground) throw new Error("background rejected");
      backgroundWrites++;
      backgrounds = value;
    },
  });
  return p;
}

beforeEach(() => {
  nodes = new Map();
  flowWrites = 0;
  backgroundWrites = 0;
  failBackground = false;
  page = makePage("0:1", "Prototype");
  otherPage = makePage("0:2", "Other");
  node("1:1", "FRAME", "Home", page);
  const outer = node("2:1", "SECTION", "Onboarding", page);
  const inner = node("2:2", "SECTION", "Step group", outer);
  node("1:2", "FRAME", "Welcome", inner);
  node("1:3", "FRAME", "Checkout", page);
  node("1:4", "FRAME", "Nested card", nodes.get("1:1"));
  node("1:5", "RECTANGLE", "Shape", page);
  node("1:6", "FRAME", "Elsewhere", otherPage);
  (globalThis as any).figma = {
    editorType: "figma",
    root: { name: "Shop app / v2" },
    getNodeByIdAsync: async (id: string) => nodes.get(id) ?? null,
    showUI: () => {},
    on: () => {},
    ui: { postMessage: () => {} },
    clientStorage: { getAsync: async () => undefined, setAsync: async () => {} },
  };
});
afterAll(() => { (globalThis as any).figma = originalFigma; });

const FLOWS = [
  { name: "Main", nodeId: "1:1" },
  { name: "Onboarding", nodeId: "1:2" },
];

describe("plugin getFlows / setFlows", () => {
  test("reports name, starting frame and the outermost section", async () => {
    const result = await setFlows({ pageId: "0:1", flows: FLOWS });
    expect(result.flows).toEqual([
      { name: "Main", nodeId: "1:1", nodeName: "Home", section: null, missing: false },
      { name: "Onboarding", nodeId: "1:2", nodeName: "Welcome", section: { id: "2:1", name: "Onboarding" }, missing: false },
    ]);
    expect(result.fileName).toBe("Shop app / v2");
  });

  test("a flow whose starting frame was deleted is reported, not dropped", async () => {
    await setFlows({ pageId: "0:1", flows: [...FLOWS, { name: "Pay", nodeId: "1:3" }] });
    nodes.delete("1:3");
    const result = await getFlows({ pageId: "0:1" });
    expect(result.flows).toHaveLength(3);
    expect(result.flows[2]).toEqual({ name: "Pay", nodeId: "1:3", nodeName: null, section: null, missing: true });
    // Writing it back is rejected, and nothing changes.
    const writes = flowWrites;
    await expect(setFlows({ pageId: "0:1", flows: result.flows.map(({ name, nodeId }: any) => ({ name, nodeId })) })).rejects.toThrow("Pay (1:3): node not found");
    expect(flowWrites).toBe(writes);
  });

  test("assigns flowStartingPoints whole, once per call", async () => {
    await setFlows({ pageId: "0:1", flows: FLOWS });
    await setFlows({ pageId: "0:1", flows: [{ name: "Only", nodeId: "1:3" }] });
    expect(flowWrites).toBe(2);
    expect(page.flowStartingPoints).toEqual([{ name: "Only", nodeId: "1:3" }]);
    await setFlows({ pageId: "0:1", flows: [] });
    expect(page.flowStartingPoints).toEqual([]);
  });

  test("rejects every bad node and lists them, with no partial write", async () => {
    await setFlows({ pageId: "0:1", flows: FLOWS, background: "#ffffff" });
    const before = structuredClone(page.flowStartingPoints);
    const writes = [flowWrites, backgroundWrites];
    const error = await setFlows({
      pageId: "0:1",
      background: "#000000",
      flows: [
        { name: "Good", nodeId: "1:3" },
        { name: "Child", nodeId: "1:4" },
        { name: "Rect", nodeId: "1:5" },
        { name: "Away", nodeId: "1:6" },
        { name: "Gone", nodeId: "9:9" },
        { name: "Again", nodeId: "1:3" },
      ],
    }).then(() => null, (e: Error) => e.message);
    expect(error).toContain("Nothing written. 5 flow(s)");
    expect(error).toContain("Child (1:4): not a top-level frame (inside FRAME 1:1)");
    expect(error).toContain("Rect (1:5): RECTANGLE is not a frame");
    expect(error).toContain("Away (1:6): on another page (Other)");
    expect(error).toContain("Gone (9:9): node not found");
    expect(error).toContain("Again (1:3): listed more than once");
    expect(error).not.toContain("Good (1:3)");
    expect([flowWrites, backgroundWrites]).toEqual(writes);
    expect(page.flowStartingPoints).toEqual(before);
  });

  test("an unknown page or a non-page id is an error", async () => {
    await expect(getFlows({ pageId: "7:7" })).rejects.toThrow("Page not found: 7:7");
    await expect(setFlows({ pageId: "1:1", flows: [] })).rejects.toThrow("Page not found: 1:1");
  });

  test("background: one solid colour, with alpha, read back as the same hex", async () => {
    let result = await setFlows({ pageId: "0:1", flows: [], background: "#1A2B3C" });
    expect(page.prototypeBackgrounds).toEqual([{ type: "SOLID", color: { r: 0x1a / 255, g: 0x2b / 255, b: 0x3c / 255 }, opacity: 1 }]);
    expect(result.background).toBe("#1a2b3c");
    result = await setFlows({ pageId: "0:1", flows: [], background: "#ff000080" });
    expect(result.background).toBe("#ff000080");
    expect(page.prototypeBackgrounds[0].opacity).toBeCloseTo(0x80 / 255);
  });

  test("no background argument leaves the background alone", async () => {
    await setFlows({ pageId: "0:1", flows: [], background: "#123456" });
    await setFlows({ pageId: "0:1", flows: FLOWS });
    expect(backgroundWrites).toBe(1);
    expect((await getFlows({ pageId: "0:1" })).background).toBe("#123456");
  });

  test("an invalid background is rejected before anything is written", async () => {
    await expect(setFlows({ pageId: "0:1", flows: FLOWS, background: "red" })).rejects.toThrow("Invalid background");
    expect(flowWrites).toBe(0);
  });

  test("a rejected background restores the previous flows", async () => {
    await setFlows({ pageId: "0:1", flows: FLOWS });
    failBackground = true;
    await expect(setFlows({ pageId: "0:1", flows: [], background: "#000000" })).rejects.toThrow("background rejected");
    expect(page.flowStartingPoints).toEqual(FLOWS);
  });

  test("a failed restore still rethrows the original error, and says the flows were not restored", async () => {
    await setFlows({ pageId: "0:1", flows: FLOWS });
    failBackground = true;
    let writes = 0;
    const desc = Object.getOwnPropertyDescriptor(page, "flowStartingPoints")!;
    Object.defineProperty(page, "flowStartingPoints", {
      get: desc.get,
      set: (value) => { if (++writes > 1) throw new Error("restore rejected"); desc.set!(value); },
    });
    const error = await setFlows({ pageId: "0:1", flows: [], background: "#000000" }).then(() => null, (e: Error) => e);
    expect(error?.message).toBe("background rejected (previous flows could not be restored)");
  });

  test("a read-back failure after a good write is reported as written, not as a failure", async () => {
    const realGet = (globalThis as any).figma.getNodeByIdAsync;
    let calls = 0;
    // loadPage, then one lookup per flow while validating; everything after that is the read-back.
    (globalThis as any).figma.getNodeByIdAsync = async (id: string) => {
      if (++calls > 1 + FLOWS.length) throw new Error("boom");
      return realGet(id);
    };
    const result = await setFlows({ pageId: "0:1", flows: FLOWS });
    expect(result).toEqual({ pageId: "0:1", written: true, readBackError: READ_BACK_ERROR });
    expect(page.flowStartingPoints).toEqual(FLOWS);
  });

  test("duplicate flow names in one call are rejected with nothing written", async () => {
    const error = await setFlows({ pageId: "0:1", flows: [{ name: "Same", nodeId: "1:1" }, { name: "Same", nodeId: "1:3" }] })
      .then(() => null, (e: Error) => e.message);
    expect(error).toContain("Same (1:3): flow name used more than once");
    expect(flowWrites).toBe(0);
  });

  test("dropMissing leaves out flows whose starting frame is gone and lists them", async () => {
    await setFlows({ pageId: "0:1", flows: [...FLOWS, { name: "Pay", nodeId: "1:3" }] });
    nodes.delete("1:3");
    const read = await getFlows({ pageId: "0:1" });
    const result: any = await setFlows({ pageId: "0:1", flows: read.flows, dropMissing: true });
    expect(result.dropped).toEqual([{ name: "Pay", nodeId: "1:3" }]);
    expect(page.flowStartingPoints).toEqual(FLOWS);
    // dropMissing never hides a frame that exists but is not a top-level frame.
    await expect(setFlows({ pageId: "0:1", flows: [{ name: "Child", nodeId: "1:4" }], dropMissing: true })).rejects.toThrow("Child (1:4)");
  });

  test("backgroundPaints is written exactly, and contradicting background is refused", async () => {
    const paint = { type: "SOLID", color: { r: 0.1, g: 0.2, b: 0.3 }, opacity: 0.5, visible: false, blendMode: "MULTIPLY" };
    await setFlows({ pageId: "0:1", flows: [], backgroundPaints: [paint] });
    expect(page.prototypeBackgrounds).toEqual([paint]);
    await setFlows({ pageId: "0:1", flows: [], backgroundPaints: [] });
    expect(page.prototypeBackgrounds).toEqual([]);
    const writes = flowWrites;
    await expect(setFlows({ pageId: "0:1", flows: [], background: "#000000", backgroundPaints: [paint] })).rejects.toThrow("not both");
    await expect(setFlows({ pageId: "0:1", flows: [], backgroundPaints: [{ type: "GRADIENT_LINEAR" }] })).rejects.toThrow("Invalid backgroundPaints");
    expect(flowWrites).toBe(writes);
  });

  test("background: null leaves the background alone", async () => {
    await setFlows({ pageId: "0:1", flows: [], background: "#123456" });
    await setFlows({ pageId: "0:1", flows: FLOWS, background: null, backgroundPaints: null });
    expect(backgroundWrites).toBe(1);
  });

  test("a background that is not one solid paint is reported, not invented", async () => {
    failBackground = false;
    page.prototypeBackgrounds = [{ type: "GRADIENT_LINEAR" }];
    const result = await getFlows({ pageId: "0:1" });
    expect(result.background).toBeNull();
    expect(result.backgroundPaintTypes).toEqual(["GRADIENT_LINEAR"]);
    page.prototypeBackgrounds = [];
    expect("backgroundPaintTypes" in (await getFlows({ pageId: "0:1" }))).toBe(false);
  });
});

// --- Round trip through the real tools: get_flows output into set_flows, unchanged ---

// A send that runs the plugin's own functions, so the server schema and the plugin are tested together.
const pluginSend = async (command: string, params?: any) => {
  if (command === "get_flows") return getFlows(params);
  if (command === "set_flows") return setFlows(params);
  if (command === "get_document_info") return { fileKey: KEY };
  throw new Error("unexpected " + command);
};

describe("round trip from a page the tool did not set up", () => {
  const backgrounds: Record<string, any[]> = {
    gradient: [{ type: "GRADIENT_LINEAR", visible: true, opacity: 1, blendMode: "NORMAL", gradientStops: [], gradientTransform: [[1, 0, 0], [0, 1, 0]] }],
    "multiple paints": [
      { type: "SOLID", visible: true, opacity: 1, blendMode: "NORMAL", color: { r: 1, g: 1, b: 1 } },
      { type: "IMAGE", visible: true, opacity: 1, blendMode: "NORMAL", scaleMode: "FILL", imageHash: "abc" },
    ],
    empty: [],
    "solid with visible:false": [{ type: "SOLID", visible: false, opacity: 0.37, blendMode: "MULTIPLY", color: { r: 0.123456, g: 0.654321, b: 0.999 } }],
  };

  for (const [label, paints] of Object.entries(backgrounds)) {
    test(`${label}: set_flows accepts get_flows output unchanged and the page does not change`, async () => {
      // Set directly on the page, as Figma or a person would, not through set_flows.
      page.prototypeBackgrounds = structuredClone(paints);
      page.flowStartingPoints = [{ name: "Main", nodeId: "1:1" }, { name: "Onboarding", nodeId: "1:2" }];
      const before = { flows: structuredClone(page.flowStartingPoints), backgrounds: structuredClone(page.prototypeBackgrounds) };
      const tools = capture(pluginSend);
      const read = JSON.parse(await output(tools.get_flows, { pageId: "0:1" }));
      const args = z.object(tools.set_flows.schema).parse(read);
      const written = JSON.parse(await output(tools.set_flows, args));
      expect({ flows: page.flowStartingPoints, backgrounds: page.prototypeBackgrounds }).toEqual(before);
      expect(written).toEqual(read);
    });
  }

  test("a missing starting frame: refused by default, dropped and listed with dropMissing", async () => {
    page.prototypeBackgrounds = structuredClone(backgrounds.gradient);
    page.flowStartingPoints = [{ name: "Main", nodeId: "1:1" }, { name: "Pay", nodeId: "1:3" }];
    nodes.delete("1:3");
    const tools = capture(pluginSend);
    const read = JSON.parse(await output(tools.get_flows, { pageId: "0:1" }));
    expect(read.flows[1]).toMatchObject({ name: "Pay", missing: true });
    const args = z.object(tools.set_flows.schema).parse(read);
    expect(await output(tools.set_flows, args)).toContain("Pay (1:3): node not found");
    expect(page.flowStartingPoints).toHaveLength(2);
    const dropped = JSON.parse(await output(tools.set_flows, { ...args, dropMissing: true }));
    expect(dropped.dropped).toEqual([{ name: "Pay", nodeId: "1:3" }]);
    expect(page.flowStartingPoints).toEqual([{ name: "Main", nodeId: "1:1" }]);
    expect(page.prototypeBackgrounds).toEqual(backgrounds.gradient);
  });
});

describe("sectionId uses the plugin's real section logic", () => {
  test("flows in a nested section count under their top-level section", async () => {
    await setFlows({ pageId: "0:1", flows: [...FLOWS, { name: "Pay", nodeId: "1:3" }] });
    const result = await getFlows({ pageId: "0:1", sectionId: "2:1" });
    expect(result.flows.map((f: any) => f.name)).toEqual(["Onboarding"]);
    const links = JSON.parse(await output(capture(pluginSend).get_prototype_links, { pageId: "0:1", sectionId: "2:1" }));
    expect(links.links.map((l: any) => l.name)).toEqual(["Onboarding"]);
  });
  test("an inner section, a frame, or an unknown id is not a top-level section on this page", async () => {
    await setFlows({ pageId: "0:1", flows: FLOWS });
    for (const id of ["2:2", "1:1", "nope"]) {
      await expect(getFlows({ pageId: "0:1", sectionId: id })).rejects.toThrow(`${id} is not a top-level section on this page`);
      expect(await output(capture(pluginSend).get_prototype_links, { pageId: "0:1", sectionId: id }))
        .toBe(`Error getting prototype links: ${id} is not a top-level section on this page (Prototype)`);
    }
  });
});

// --- Dispatch through the plugin's real command handler in main.ts ---

let onmessage: ((msg: any) => Promise<void>) | undefined;
async function dispatch(command: string, params: any): Promise<any> {
  const fig = (globalThis as any).figma;
  if (!onmessage) {
    (globalThis as any).__html__ = "";
    fig.ui = { postMessage: () => {} };
    await import("../src/llm2figma_plugin/src/main");
    onmessage = fig.ui.onmessage;
  }
  const posted: any[] = [];
  fig.ui = { postMessage: (message: any) => posted.push(message) };
  await onmessage!({ type: "execute-command", id: "t1", command, params });
  return posted.find((message) => message.id === "t1");
}

describe("plugin dispatch (main.ts)", () => {
  test("set_flows and get_flows are routed to the flow functions", async () => {
    const set = await dispatch("set_flows", { pageId: "0:1", flows: FLOWS, background: "#102030" });
    expect(set.type).toBe("command-result");
    expect(page.flowStartingPoints).toEqual(FLOWS);
    const get = await dispatch("get_flows", { pageId: "0:1" });
    expect(get.type).toBe("command-result");
    expect(get.result.flows.map((f: any) => f.name)).toEqual(["Main", "Onboarding"]);
    expect(get.result.background).toBe("#102030");
  });
  test("missing parameters and Dev Mode are refused by the dispatcher", async () => {
    expect(await dispatch("get_flows", {})).toMatchObject({ type: "command-error" });
    expect((await dispatch("set_flows", { pageId: "0:1" })).error).toContain("pageId and flows");
    (globalThis as any).figma.editorType = "dev";
    expect((await dispatch("set_flows", { pageId: "0:1", flows: [] })).error).toContain("not available in the dev editor");
    expect((await dispatch("get_flows", { pageId: "0:1" })).type).toBe("command-result");
  });
});

describe("editor gate", () => {
  test("get_flows reads, so Dev Mode allows it; set_flows mutates, so Dev Mode refuses it", () => {
    expect(() => assertEditorAllowed("get_flows", "dev")).not.toThrow();
    expect(() => assertEditorAllowed("set_flows", "dev")).toThrow("set_flows is not available in the dev editor");
    expect(() => assertEditorAllowed("set_flows", "figma")).not.toThrow();
  });
});

describe("buildPrototypeLink", () => {
  test("https, file key, encoded name, node id with - for :", () => {
    expect(buildPrototypeLink(KEY, "Shop app / v2", "12:34")).toBe(
      `https://www.figma.com/proto/${KEY}/Shop%20app%20%2F%20v2?node-id=12-34&starting-point-node-id=12-34`,
    );
  });
  test("a missing file name still gives a well-formed link", () => {
    expect(buildPrototypeLink(KEY, null, "1:2")).toBe(`https://www.figma.com/proto/${KEY}/Untitled?node-id=1-2&starting-point-node-id=1-2`);
  });
  test("instance-style ids are encoded, not passed through raw", () => {
    expect(buildPrototypeLink(KEY, "F", "I1:2;3:4")).toContain("node-id=I1-2%3B3-4&");
  });
});

// --- Server tools ---

type Tool = { description: string; schema: Record<string, z.ZodTypeAny>; run: (args: any) => Promise<any> };
function capture(send: (command: string, params?: any) => Promise<any>, userKey?: string, fileKeyEnabled = true) {
  const tools: Record<string, Tool> = {};
  const server = { tool: (name: string, description: string, schema: any, run: any) => { tools[name] = { description, schema, run }; } };
  registerFlowTools(server as any, send as any, { userFileKey: () => userKey, fileKeyEnabled });
  return tools;
}
const output = async (tool: Tool, args: any) => (await tool.run(args)).content[0].text as string;

describe("registration", () => {
  test("the three tools exist only when L2F_FLOWS (or L2F_ALL) is on", () => {
    const names = (env: Record<string, string>) => {
      const tools: string[] = [];
      registerWhenEnabled("FLOWS", registerFlowTools, { tool: (name: string) => tools.push(name) } as any, (async () => ({})) as any, env);
      return tools;
    };
    expect(names({})).toEqual([]);
    expect(names({ L2F_FLOWS: "1" })).toEqual(["get_flows", "set_flows", "get_prototype_links"]);
    expect(names({ L2F_ALL: "1" })).toHaveLength(3);
  });
  test("server.ts registers them through the FLOWS gate, not unconditionally", () => {
    const server = readFileSync("src/llm2figma_mcp/server.ts", "utf8");
    expect(server).toContain('registerFeature("FLOWS", registerFlowTools)');
    expect(server.match(/registerFlowTools/g)).toHaveLength(2);
  });
  test("the link tool says its format is unconfirmed", () => {
    expect(capture(async () => ({})).get_prototype_links.description).toContain("UNCONFIRMED");
  });
});

describe("set_flows schema", () => {
  const schema = z.object(capture(async () => ({})).set_flows.schema);
  test("background accepts only one solid hex colour", () => {
    for (const ok of ["#000000", "#aBcDeF", "#11223344"]) expect(BackgroundSchema.safeParse(ok).success).toBe(true);
    for (const bad of ["red", "#fff", "#1234567", "rgb(0,0,0)", "linear-gradient(#000, #fff)", { r: 0, g: 0, b: 0 }, ["#000000", "#ffffff"]]) {
      expect(BackgroundSchema.safeParse(bad).success).toBe(false);
    }
  });
  test("flows need a name and node id; an empty list is allowed", () => {
    expect(schema.safeParse({ pageId: "0:1", flows: [] }).success).toBe(true);
    expect(schema.safeParse({ pageId: "0:1", flows: [{ name: "", nodeId: "1:1" }] }).success).toBe(false);
    expect(schema.safeParse({ pageId: "0:1", flows: [{ name: "   ", nodeId: "1:1" }] }).success).toBe(false);
    expect(schema.parse({ pageId: "0:1", flows: [{ name: "  Main ", nodeId: "1:1" }] }).flows[0].name).toBe("Main");
    expect(schema.safeParse({ pageId: "0:1", flows: [{ name: "A" }] }).success).toBe(false);
  });
  test("background may be null; backgroundPaints is [] or one SOLID paint with 0..1 channels", () => {
    expect(schema.safeParse({ pageId: "0:1", flows: [], background: null, backgroundPaints: null }).success).toBe(true);
    const solid = { type: "SOLID", color: { r: 0.1, g: 0.2, b: 0.3, a: 1 }, visible: false, opacity: 0.5, blendMode: "NORMAL" };
    for (const ok of [[], [solid], [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }]]) expect(BackgroundPaintsSchema.safeParse(ok).success).toBe(true);
    for (const bad of [[solid, solid], [{ ...solid, type: "GRADIENT_LINEAR" }], [{ ...solid, color: { r: 2, g: 0, b: 0 } }], [{ ...solid, opacity: -1 }], "#000000"]) {
      expect(BackgroundPaintsSchema.safeParse(bad).success).toBe(false);
    }
    expect(schema.safeParse({ pageId: "0:1", flows: [], dropMissing: "yes" }).success).toBe(false);
  });
  test("passes the call through and reports plugin errors", async () => {
    const calls: any[] = [];
    const tools = capture(async (command, params) => {
      calls.push([command, params]);
      throw new Error("Nothing written. 1 flow(s) do not start at a top-level frame");
    });
    expect(await output(tools.set_flows, { pageId: "0:1", flows: FLOWS, background: "#000000" })).toBe(
      "Error setting flows: Nothing written. 1 flow(s) do not start at a top-level frame",
    );
    expect(calls).toEqual([["set_flows", { pageId: "0:1", flows: FLOWS, background: "#000000", backgroundPaints: undefined, dropMissing: undefined }]]);
  });
});

describe("get_prototype_links", () => {
  const flowsResult = {
    pageId: "0:1", pageName: "Prototype", fileName: "Shop", background: null,
    flows: [
      { name: "Main", nodeId: "1:1", nodeName: "Home", section: null, missing: false },
      { name: "Onboarding", nodeId: "1:2", nodeName: "Welcome", section: { id: "2:1", name: "Onboarding" }, missing: false },
      { name: "Pay", nodeId: "1:3", nodeName: null, section: null, missing: true },
    ],
  };
  const fakeSend = (pluginKey: string | null, calls: string[] = [], params: any[] = []) => async (command: string, param?: any) => {
    calls.push(command);
    params.push(param);
    if (command === "get_document_info") return { name: "Prototype", fileKey: pluginKey };
    if (command === "get_flows") return flowsResult;
    throw new Error("unexpected " + command);
  };

  test("no known file key gives the fixed error and reads no flows", async () => {
    const calls: string[] = [];
    expect(await output(capture(fakeSend(null, calls)).get_prototype_links, { pageId: "0:1" })).toBe(NO_FILE_KEY);
    expect(NO_FILE_KEY).toContain("join_channel");
    expect(NO_FILE_KEY).toContain("L2F_FILE_KEY");
    expect(calls).toEqual(["get_document_info"]);
  });
  test("one link per flow from the plugin's key; a missing frame gets null", async () => {
    const result = JSON.parse(await output(capture(fakeSend(KEY), "UserKey0000000000").get_prototype_links, { pageId: "0:1" }));
    expect(result.fileKeySource).toBe("plugin");
    expect(result.links.map((l: any) => l.link)).toEqual([
      buildPrototypeLink(KEY, "Shop", "1:1"),
      buildPrototypeLink(KEY, "Shop", "1:2"),
      null,
    ]);
    expect(result.links[2]).toMatchObject({ name: "Pay", missing: true });
  });
  test("falls back to the key given to join_channel", async () => {
    const result = JSON.parse(await output(capture(fakeSend(null), "UserKey0000000000").get_prototype_links, { pageId: "0:1" }));
    expect(result.fileKeySource).toBe("user");
    expect(result.links[0].link).toContain("/proto/UserKey0000000000/");
  });
  test("sectionId is passed to the plugin, which filters and checks it", async () => {
    const params: any[] = [];
    await output(capture(fakeSend(KEY, [], params)).get_prototype_links, { pageId: "0:1", sectionId: "2:1" });
    expect(params).toEqual([undefined, { pageId: "0:1", sectionId: "2:1" }]);
  });
  test("L2F_FILE_KEY off: the plugin's key is used, the join_channel key never is", async () => {
    const withPluginKey = JSON.parse(await output(capture(fakeSend(KEY), "UserKey0000000000", false).get_prototype_links, { pageId: "0:1" }));
    expect(withPluginKey.fileKeySource).toBe("plugin");
    expect(withPluginKey.links[0].link).toBe(buildPrototypeLink(KEY, "Shop", "1:1"));
    const calls: string[] = [];
    expect(await output(capture(fakeSend(null, calls), "UserKey0000000000", false).get_prototype_links, { pageId: "0:1" })).toBe(NO_FILE_KEY);
    expect(calls).toEqual(["get_document_info"]);
  });
  test("the flag defaults to the server environment", async () => {
    const run = async (env: string | undefined) => {
      const saved = process.env.L2F_FILE_KEY;
      if (env === undefined) delete process.env.L2F_FILE_KEY; else process.env.L2F_FILE_KEY = env;
      const savedAll = process.env.L2F_ALL;
      delete process.env.L2F_ALL;
      try {
        const tools: Record<string, any> = {};
        registerFlowTools({ tool: (name: string, _d: string, _s: any, fn: any) => { tools[name] = fn; } } as any, fakeSend(null) as any, { userFileKey: () => "UserKey0000000000" });
        return (await tools.get_prototype_links({ pageId: "0:1" })).content[0].text as string;
      } finally {
        if (saved === undefined) delete process.env.L2F_FILE_KEY; else process.env.L2F_FILE_KEY = saved;
        if (savedAll !== undefined) process.env.L2F_ALL = savedAll;
      }
    };
    expect(await run(undefined)).toBe(NO_FILE_KEY);
    expect(JSON.parse(await run("1")).fileKeySource).toBe("user");
  });
  test("every link uses https", async () => {
    const text = await output(capture(fakeSend(KEY)).get_prototype_links, { pageId: "0:1" });
    expect(text).not.toContain("http:");
  });
});
