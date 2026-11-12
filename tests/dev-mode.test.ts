/**
 * Dev Mode (L2F_DEV_MODE): set_dev_status, get_dev_resources, add_dev_resource,
 * add_measurement and get_measurements against a mocked figma global and a fake
 * server.tool capture. No Figma or relay needed:
 *   bun test tests/dev-mode.test.ts
 */
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { addDevResource, addMeasurement, getDevResources, getMeasurements, isHttpsUrl as pluginIsHttpsUrl, sameAxis, setDevStatus } from "../src/llm2figma_plugin/src/dev-mode";
import { getFlows } from "../src/llm2figma_plugin/src/prototyping";
import { allowedEditors, assertEditorAllowed } from "../src/llm2figma_plugin/src/editor-gate";
import { HttpsUrlSchema, MeasurementSidesSchema, isHttpsUrl, registerTools } from "../src/llm2figma_mcp/tools/dev-mode";
import { registerFlowTools } from "../src/llm2figma_mcp/tools/prototyping";
import { registerWhenEnabled } from "../src/shared/flags";

const originalFigma = (globalThis as any).figma;
let nodes: Map<string, any>;
let page: any;
let otherPage: any;
let measurements: any[];
let addCalls: Array<[string, string | undefined]>;

// Dev resources per node id: { name, url, nodeId, inheritedNodeId? }.
let resources: Map<string, any[]>;

function node(id: string, type: string, name: string, parent?: any): any {
  const n: any = { id, type, name, parent: parent ?? null, children: [] };
  if (parent) parent.children.push(n);
  n.getDevResourcesAsync = async (options?: { includeChildren?: boolean }) => {
    const own = resources.get(id) ?? [];
    if (!options?.includeChildren) return own;
    const below = (x: any): any[] => x.children.flatMap((c: any) => [...(resources.get(c.id) ?? []), ...below(c)]);
    return [...own, ...below(n)];
  };
  n.addDevResourceAsync = async (url: string, name?: string) => {
    addCalls.push([url, name]);
    const list = resources.get(id) ?? [];
    if (list.some((r) => r.nodeId === id && r.url === url)) throw new Error("duplicate url");
    list.push({ name: name ?? url.replace(/^https:\/\//, ""), url, nodeId: id });
    resources.set(id, list);
  };
  if (["FRAME", "SECTION", "COMPONENT", "INSTANCE"].includes(type)) {
    let status: any = null;
    Object.defineProperty(n, "devStatus", {
      get: () => status,
      set: (value) => {
        for (let p = n.parent; p; p = p.parent) {
          if (p.devStatus) throw new Error("Cannot set devStatus on a node inside a node that already has a devStatus");
        }
        status = value;
      },
      enumerable: true,
    });
  }
  nodes.set(id, n);
  return n;
}

function makePage(id: string, name: string): any {
  const p = node(id, "PAGE", name);
  p.getMeasurements = () => measurements;
  p.getMeasurementsForNode = (n: any) => measurements.filter((m) => m.start.node === n || m.end.node === n);
  p.addMeasurement = (start: any, end: any, options?: any) => {
    const m = { id: `m${measurements.length + 1}`, start, end, offset: options?.offset ?? { type: "INNER", relative: 0 }, freeText: "" };
    measurements.push(m);
    return m;
  };
  p.loadAsync = async () => {};
  return p;
}

beforeEach(() => {
  nodes = new Map();
  resources = new Map();
  measurements = [];
  addCalls = [];
  page = makePage("0:1", "Design");
  otherPage = makePage("0:2", "Other");
  const section = node("2:1", "SECTION", "Checkout", page);
  node("1:1", "FRAME", "Home", page);
  node("1:2", "FRAME", "Pay", section);
  node("1:3", "FRAME", "Card", nodes.get("1:1"));
  node("1:4", "RECTANGLE", "Shape", page);
  node("1:5", "FRAME", "Elsewhere", otherPage);
  node("3:1", "COMPONENT", "Button", page);
  node("3:2", "INSTANCE", "Button instance", page);
  (globalThis as any).figma = {
    editorType: "figma",
    root: { name: "Shop app" },
    currentPage: page,
    getNodeByIdAsync: async (id: string) => nodes.get(id) ?? null,
    showUI: () => {},
    on: () => {},
    ui: { postMessage: () => {} },
    clientStorage: { getAsync: async () => undefined, setAsync: async () => {} },
  };
});
afterAll(() => { (globalThis as any).figma = originalFigma; });

const READY = { type: "READY_FOR_DEV" as const, description: "Sprint 9" };

describe("set_dev_status (plugin)", () => {
  test("sets frames under a page or section, and sections, with per-node results", async () => {
    const result = await setDevStatus({ nodeIds: ["1:1", "1:2"], status: READY });
    expect(result.set).toBe(2);
    expect(result.results[0]).toEqual({ nodeId: "1:1", name: "Home", result: "set", devStatus: READY });
    expect(nodes.get("1:2").devStatus).toEqual(READY);
    expect((await setDevStatus({ nodeIds: ["1:1"], status: null })).results[0].devStatus).toBeNull();
    expect(nodes.get("1:1").devStatus).toBeNull();
  });

  test("skip reasons: not found, no devStatus, not directly under a page or section, ancestor has a status", async () => {
    await setDevStatus({ nodeIds: ["2:1"], status: { type: "COMPLETED" } });
    const result = await setDevStatus({ nodeIds: ["9:9", "1:4", "1:3", "1:2", "1:1"], status: READY });
    expect(result).toMatchObject({ set: 1, skipped: 4 });
    const byId = Object.fromEntries(result.results.map((r: any) => [r.nodeId, r]));
    expect(byId["9:9"]).toEqual({ nodeId: "9:9", result: "skipped", reason: "node not found" });
    expect(byId["1:4"].reason).toBe("RECTANGLE has no dev status (sections and frames only)");
    expect(byId["1:3"].reason).toBe("not directly under a page or section (inside FRAME 1:1)");
    expect(byId["1:2"]).toMatchObject({ result: "skipped", reason: expect.stringContaining("already has a devStatus") });
    expect(byId["1:1"].result).toBe("set");
    expect(nodes.get("1:2").devStatus).toBeNull();
  });

  test("an invalid status or node list is refused before anything is written", async () => {
    await expect(setDevStatus({ nodeIds: ["1:1"], status: { type: "DONE" } as any })).rejects.toThrow("status must be null");
    await expect(setDevStatus({ nodeIds: ["1:1"], status: undefined as any })).rejects.toThrow("status must be null");
    await expect(setDevStatus({ nodeIds: [], status: READY })).rejects.toThrow("1 to 100");
    await expect(setDevStatus({ nodeIds: Array(101).fill("1:1"), status: READY })).rejects.toThrow("1 to 100");
    expect(nodes.get("1:1").devStatus).toBeNull();
  });
});

describe("dev resources (plugin)", () => {
  test("get_dev_resources includes inherited resources and caps the list at 100", async () => {
    resources.set("3:2", [
      { name: "Storybook", url: "https://storybook.example.com/button", nodeId: "3:1", inheritedNodeId: "3:1" },
      { name: "Ticket", url: "https://jira.example.com/T-1", nodeId: "3:2" },
    ]);
    const result = await getDevResources({ nodeId: "3:2" });
    expect(result).toMatchObject({ nodeId: "3:2", count: 2, truncated: false });
    expect(result.resources[0]).toEqual({ name: "Storybook", url: "https://storybook.example.com/button", nodeId: "3:1", inheritedNodeId: "3:1" });
    resources.set("1:1", Array.from({ length: 130 }, (_, i) => ({ name: `L${i}`, url: `https://x.example.com/${i}`, nodeId: "1:1" })));
    const many = await getDevResources({ nodeId: "1:1" });
    expect(many).toMatchObject({ count: 130, truncated: true });
    expect(many.resources).toHaveLength(100);
    await expect(getDevResources({ nodeId: "9:9" })).rejects.toThrow("Node not found: 9:9");
  });

  test("includeChildren is passed through", async () => {
    resources.set("1:2", [{ name: "Pay spec", url: "https://docs.example.com/pay", nodeId: "1:2" }]);
    expect((await getDevResources({ nodeId: "2:1" })).count).toBe(0);
    expect((await getDevResources({ nodeId: "2:1", includeChildren: true })).count).toBe(1);
  });

  test("add_dev_resource adds once; a rerun is already present and does not call Figma", async () => {
    const url = "https://www.figma.com/proto/KEY/Shop?node-id=1-1";
    const first = await addDevResource({ nodeId: "1:1", url, name: " Prototype " });
    expect(first).toEqual({ nodeId: "1:1", result: "added", resource: { name: "Prototype", url, nodeId: "1:1" } });
    const again = await addDevResource({ nodeId: "1:1", url });
    expect(again.result).toBe("already present");
    expect(addCalls).toHaveLength(1);
  });

  test("an inherited resource with the same url is not a duplicate", async () => {
    const url = "https://storybook.example.com/button";
    resources.set("3:2", [{ name: "Storybook", url, nodeId: "3:1", inheritedNodeId: "3:1" }]);
    expect((await addDevResource({ nodeId: "3:2", url })).result).toBe("added");
    expect(addCalls).toEqual([[url, undefined]]);
  });

  test("only https links; name length capped", async () => {
    const refused = [
      "http" + "://example.com", "javascript:alert(1)", "data:text/html,<b>x</b>", "file:///etc/passwd",
      "ftp://example.com", "https://", "https:///path", "https://exa mple.com", "https://example.com/a b",
      "https://user:pw@example.com", "https://example.com\\evil", "//example.com", "example.com",
      "https://example.com/" + "a".repeat(2048),
    ];
    for (const url of refused) {
      await expect(addDevResource({ nodeId: "1:1", url })).rejects.toThrow("url must be an https link");
      expect(pluginIsHttpsUrl(url)).toBe(false);
      expect(isHttpsUrl(url)).toBe(false);
      expect(HttpsUrlSchema.safeParse(url).success).toBe(false);
    }
    for (const url of ["https://example.com", "HTTPS://Example.com:8443/a?b=c#d", "https://www.figma.com/proto/K/N?node-id=1-2&starting-point-node-id=1-2"]) {
      expect(pluginIsHttpsUrl(url)).toBe(true);
      expect(isHttpsUrl(url)).toBe(true);
    }
    await expect(addDevResource({ nodeId: "1:1", url: "https://example.com", name: "n".repeat(201) })).rejects.toThrow("name must be 1 to 200");
    await expect(addDevResource({ nodeId: "1:1", url: "https://example.com", name: "  " })).rejects.toThrow("name must be 1 to 200");
    expect(addCalls).toEqual([]);
  });
});

describe("measurements (plugin)", () => {
  beforeEach(() => { (globalThis as any).figma.editorType = "dev"; });

  test("adds between two nodes on the current page, with an offset", async () => {
    const m = await addMeasurement({ startNodeId: "1:1", startSide: "RIGHT", endNodeId: "3:1", endSide: "LEFT", offset: { type: "OUTER", fixed: 12 } });
    expect(m).toEqual({
      id: "m1",
      start: { nodeId: "1:1", nodeName: "Home", side: "RIGHT" },
      end: { nodeId: "3:1", nodeName: "Button", side: "LEFT" },
      offset: { type: "OUTER", fixed: 12 },
      freeText: "",
    });
    await addMeasurement({ startNodeId: "1:3", startSide: "TOP", endNodeId: "1:2", endSide: "BOTTOM" });
    expect(measurements[1].offset).toEqual({ type: "INNER", relative: 0 });
  });

  test("off-page nodes, pages and unknown ids are rejected and nothing is added", async () => {
    await expect(addMeasurement({ startNodeId: "1:1", startSide: "TOP", endNodeId: "1:5", endSide: "TOP" })).rejects.toThrow("endNodeId 1:5 is not on the current page (Design)");
    await expect(addMeasurement({ startNodeId: "0:1", startSide: "TOP", endNodeId: "1:1", endSide: "TOP" })).rejects.toThrow("is a PAGE");
    await expect(addMeasurement({ startNodeId: "9:9", startSide: "TOP", endNodeId: "1:1", endSide: "TOP" })).rejects.toThrow("Node not found: 9:9");
    await expect(getMeasurements({ nodeId: "1:5" })).rejects.toThrow("not on the current page");
    expect(measurements).toEqual([]);
  });

  test("cross-axis sides and bad offsets are rejected", async () => {
    await expect(addMeasurement({ startNodeId: "1:1", startSide: "LEFT", endNodeId: "3:1", endSide: "TOP" })).rejects.toThrow("different axes");
    await expect(addMeasurement({ startNodeId: "1:1", startSide: "BOTTOM", endNodeId: "3:1", endSide: "RIGHT" })).rejects.toThrow("different axes");
    await expect(addMeasurement({ startNodeId: "1:1", startSide: "MIDDLE", endNodeId: "3:1", endSide: "TOP" })).rejects.toThrow("TOP, RIGHT, BOTTOM or LEFT");
    await expect(addMeasurement({ startNodeId: "1:1", startSide: "LEFT", endNodeId: "3:1", endSide: "LEFT", offset: { type: "OUTER", relative: 1 } as any })).rejects.toThrow("offset must be");
    expect(measurements).toEqual([]);
    expect(sameAxis("LEFT", "RIGHT")).toBe(true);
    expect(sameAxis("TOP", "BOTTOM")).toBe(true);
    expect(sameAxis("TOP", "LEFT")).toBe(false);
  });

  test("get_measurements: all on the page or for one node, capped at 100", async () => {
    await addMeasurement({ startNodeId: "1:1", startSide: "LEFT", endNodeId: "3:1", endSide: "LEFT" });
    await addMeasurement({ startNodeId: "3:1", startSide: "TOP", endNodeId: "3:2", endSide: "TOP" });
    expect((await getMeasurements({})).count).toBe(2);
    expect((await getMeasurements({ nodeId: "1:1" })).measurements.map((m: any) => m.id)).toEqual(["m1"]);
    for (let i = 0; i < 110; i++) await addMeasurement({ startNodeId: "1:1", startSide: "TOP", endNodeId: "3:2", endSide: "BOTTOM" });
    const all = await getMeasurements({});
    expect(all).toMatchObject({ pageId: "0:1", count: 112, truncated: true });
    expect(all.measurements).toHaveLength(100);
  });

  test("refused outside Dev Mode, even when called directly", async () => {
    for (const editor of ["figma", "figjam", "slides", "buzz"]) {
      (globalThis as any).figma.editorType = editor;
      await expect(addMeasurement({ startNodeId: "1:1", startSide: "LEFT", endNodeId: "3:1", endSide: "LEFT" })).rejects.toThrow("only available in Dev Mode");
      await expect(getMeasurements({})).rejects.toThrow("only available in Dev Mode");
    }
    expect(measurements).toEqual([]);
  });
});

describe("editor gate", () => {
  test("status and resources: design editor and Dev Mode; measurements: Dev Mode only", () => {
    for (const command of ["set_dev_status", "get_dev_resources", "add_dev_resource"]) {
      expect(allowedEditors(command)).toEqual(["figma", "dev"]);
      expect(() => assertEditorAllowed(command, "dev")).not.toThrow();
      expect(() => assertEditorAllowed(command, "figma")).not.toThrow();
      expect(() => assertEditorAllowed(command, "figjam")).toThrow(`${command} is not available in the figjam editor`);
    }
    for (const command of ["add_measurement", "get_measurements"]) {
      expect(() => assertEditorAllowed(command, "dev")).not.toThrow();
      for (const editor of ["figma", "figjam", "slides", "buzz"]) {
        expect(() => assertEditorAllowed(command, editor)).toThrow(`${command} is not available in the ${editor} editor`);
      }
    }
  });
  test("other mutations are still refused in Dev Mode", () => {
    expect(() => assertEditorAllowed("set_fill_color", "dev")).toThrow("not available in the dev editor");
    expect(() => assertEditorAllowed("set_annotation", "dev")).toThrow("not available in the dev editor");
  });
});

// --- Dispatch through the plugin's real command handler in main.ts ---

let onmessage: ((msg: any) => Promise<void>) | undefined;
async function dispatch(command: string, params: any): Promise<any> {
  const fig = (globalThis as any).figma;
  if (!onmessage) {
    (globalThis as any).__html__ = "";
    fig.ui = { postMessage: () => {} };
    // A query string gives this file its own instance: another test file may already have
    // loaded main.ts, which registers its handler only once, on the figma global of the time.
    await import("../src/llm2figma_plugin/src/main.ts?dev-mode-test");
    onmessage = fig.ui.onmessage;
  }
  const posted: any[] = [];
  fig.ui = { postMessage: (message: any) => posted.push(message) };
  await onmessage!({ type: "execute-command", id: "t1", command, params });
  return posted.find((message) => message.id === "t1");
}

describe("plugin dispatch (main.ts)", () => {
  test("status and resources run in the design editor and in Dev Mode", async () => {
    for (const editor of ["figma", "dev"]) {
      (globalThis as any).figma.editorType = editor;
      const set = await dispatch("set_dev_status", { nodeIds: ["1:1"], status: READY });
      expect(set).toMatchObject({ type: "command-result", result: { set: 1 } });
      const add = await dispatch("add_dev_resource", { nodeId: "1:1", url: `https://example.com/${editor}` });
      expect(add.result.result).toBe("added");
      expect((await dispatch("get_dev_resources", { nodeId: "1:1" })).result.count).toBeGreaterThan(0);
    }
  });
  test("measurements run only in Dev Mode; missing parameters are refused", async () => {
    const params = { startNodeId: "1:1", startSide: "LEFT", endNodeId: "3:1", endSide: "RIGHT" };
    expect((await dispatch("add_measurement", params)).error).toContain("add_measurement is not available in the figma editor");
    expect((await dispatch("get_measurements", {})).error).toContain("not available in the figma editor");
    (globalThis as any).figma.editorType = "dev";
    expect((await dispatch("add_measurement", params)).type).toBe("command-result");
    expect((await dispatch("get_measurements", {})).result.count).toBe(1);
    expect((await dispatch("add_measurement", { startNodeId: "1:1" })).error).toContain("Missing required parameters");
    expect((await dispatch("set_dev_status", { nodeIds: ["1:1"] })).error).toContain("nodeIds and status");
    expect((await dispatch("add_dev_resource", { nodeId: "1:1" })).error).toContain("nodeId and url");
  });
});

// --- Server tools ---

type Tool = { description: string; schema: Record<string, z.ZodTypeAny>; run: (args: any) => Promise<any> };
function capture(send: (command: string, params?: any) => Promise<any>) {
  const tools: Record<string, Tool> = {};
  const server = { tool: (name: string, description: string, schema: any, run: any) => { tools[name] = { description, schema, run }; } };
  registerTools(server as any, send as any);
  registerFlowTools(server as any, send as any, { userFileKey: () => undefined, fileKeyEnabled: true });
  return tools;
}
const output = async (tool: Tool, args: any) => (await tool.run(args)).content[0].text as string;
const parse = (tool: Tool, args: any) => z.object(tool.schema).safeParse(args);

const DEV_TOOLS = ["set_dev_status", "get_dev_resources", "add_dev_resource", "add_measurement", "get_measurements"];

describe("registration", () => {
  test("the five tools exist only when L2F_DEV_MODE (or L2F_ALL) is on", () => {
    const names = (env: Record<string, string>) => {
      const tools: string[] = [];
      registerWhenEnabled("DEV_MODE", registerTools, { tool: (name: string) => tools.push(name) } as any, (async () => ({})) as any, env);
      return tools;
    };
    expect(names({})).toEqual([]);
    expect(names({ L2F_FLOWS: "1" })).toEqual([]);
    expect(names({ L2F_DEV_MODE: "1" })).toEqual(DEV_TOOLS);
    expect(names({ L2F_ALL: "1" })).toEqual(DEV_TOOLS);
  });
  test("server.ts registers them through the DEV_MODE gate, not unconditionally", () => {
    const server = readFileSync("src/llm2figma_mcp/server.ts", "utf8");
    expect(server).toContain('registerFeature("DEV_MODE", registerDevModeTools)');
    expect(server).not.toMatch(/^registerDevModeTools\(/m);
  });
});

describe("server schemas and handlers", () => {
  test("set_dev_status: 1 to 100 node ids, a status or null", () => {
    const tools = capture(async () => ({}));
    expect(parse(tools.set_dev_status, { nodeIds: ["1:1"], status: READY }).success).toBe(true);
    expect(parse(tools.set_dev_status, { nodeIds: ["1:1"], status: null }).success).toBe(true);
    expect(parse(tools.set_dev_status, { nodeIds: ["1:1"] }).success).toBe(false);
    expect(parse(tools.set_dev_status, { nodeIds: ["1:1"], status: { type: "DONE" } }).success).toBe(false);
    expect(parse(tools.set_dev_status, { nodeIds: [], status: null }).success).toBe(false);
    expect(parse(tools.set_dev_status, { nodeIds: Array(101).fill("1:1"), status: null }).success).toBe(false);
  });
  test("add_dev_resource: https only, name capped", () => {
    const tools = capture(async () => ({}));
    expect(parse(tools.add_dev_resource, { nodeId: "1:1", url: "https://example.com" }).success).toBe(true);
    expect(parse(tools.add_dev_resource, { nodeId: "1:1", url: "http" + "://example.com" }).success).toBe(false);
    expect(parse(tools.add_dev_resource, { nodeId: "1:1", url: "javascript:alert(1)" }).success).toBe(false);
    expect(parse(tools.add_dev_resource, { nodeId: "1:1", url: "https://example.com", name: "n".repeat(201) }).success).toBe(false);
  });
  test("add_measurement: cross-axis sides are refused in Zod and never sent", async () => {
    const sent: any[] = [];
    const tools = capture(async (command, params) => { sent.push([command, params]); return { id: "m1" }; });
    expect(MeasurementSidesSchema.safeParse({ startSide: "LEFT", endSide: "TOP" }).success).toBe(false);
    expect(MeasurementSidesSchema.safeParse({ startSide: "TOP", endSide: "BOTTOM" }).success).toBe(true);
    expect(await output(tools.add_measurement, { startNodeId: "1:1", startSide: "LEFT", endNodeId: "3:1", endSide: "BOTTOM" }))
      .toContain("Error adding measurement: startSide and endSide must be on the same axis");
    expect(sent).toEqual([]);
    expect(parse(tools.add_measurement, { startNodeId: "1:1", startSide: "LEFT", endNodeId: "3:1", endSide: "LEFT", offset: { type: "INNER", fixed: 1 } }).success).toBe(false);
    await output(tools.add_measurement, { startNodeId: "1:1", startSide: "LEFT", endNodeId: "3:1", endSide: "RIGHT", offset: { type: "INNER", relative: 0.5 } });
    expect(sent).toEqual([["add_measurement", { startNodeId: "1:1", startSide: "LEFT", endNodeId: "3:1", endSide: "RIGHT", offset: { type: "INNER", relative: 0.5 } }]]);
  });
  test("plugin errors come back as text", async () => {
    const tools = capture(async () => { throw new Error("add_measurement is only available in Dev Mode (editor: figma)"); });
    expect(await output(tools.get_measurements, {})).toBe("Error getting measurements: add_measurement is only available in Dev Mode (editor: figma)");
  });
});

// Done-when: a frame marked ready for dev, carrying the link from get_prototype_links.
describe("done-when: ready for dev with the prototype link", () => {
  test("get_prototype_links output feeds add_dev_resource, and set_dev_status marks the frame", async () => {
    page.flowStartingPoints = [{ name: "Main", nodeId: "1:1" }];
    const send = async (command: string, params?: any): Promise<any> => {
      if (command === "get_document_info") return { fileKey: "AbC123xyz789QrStUv" };
      if (command === "get_flows") return getFlows(params);
      if (command === "set_dev_status") return setDevStatus(params);
      if (command === "add_dev_resource") return addDevResource(params);
      throw new Error("unexpected " + command);
    };
    const tools = capture(send);
    const { links } = JSON.parse(await output(tools.get_prototype_links, { pageId: "0:1" }));
    const link = links[0].link as string;
    expect(parse(tools.add_dev_resource, { nodeId: "1:1", url: link, name: "Prototype" }).success).toBe(true);
    expect(JSON.parse(await output(tools.add_dev_resource, { nodeId: "1:1", url: link, name: "Prototype" })).result).toBe("added");
    expect(JSON.parse(await output(tools.set_dev_status, { nodeIds: ["1:1"], status: { type: "READY_FOR_DEV" } })).set).toBe(1);
    expect(nodes.get("1:1").devStatus).toEqual({ type: "READY_FOR_DEV" });
    expect(resources.get("1:1")).toEqual([{ name: "Prototype", url: link, nodeId: "1:1" }]);
  });
});
