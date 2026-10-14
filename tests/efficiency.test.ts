import { describe, expect, test } from "bun:test";
import { boundNodeTree } from "../src/shared/inspection";
import { createFontLoader } from "../src/shared/font-cache";
import { ReferenceCache } from "../src/llm2figma_mcp/tools/reference-cache";
import { registerTools as registerDocumentTools } from "../src/llm2figma_mcp/tools/document";
import { getNodesInfo } from "../src/llm2figma_plugin/src/document";
import { scanNodeStyles } from "../src/llm2figma_plugin/src/analysis";
import { makeMcpConfig } from "../scripts/write-mcp-config";

const leaf = (id: string): any => ({ id, name: id, type: "TEXT", characters: "hello" });
const root = (children: any[]): any => ({ id: "root", name: "Root", type: "FRAME", children });

describe("bounded inspection", () => {
  test("caps the whole subtree and reports incomplete coverage", () => {
    const input = root([root([leaf("a"), leaf("b")]), leaf("c")]);
    const result = boundNodeTree(input, { maxNodes: 3, maxDepth: 10 });
    expect(result.inspection.returnedNodes).toBe(3);
    expect(result.inspection.truncated).toBe(true);
    expect(result.node.children).toHaveLength(1);
    expect(input.children).toHaveLength(2);
  });
  test("root depth zero returns only the root with truncation", () => {
    const result = boundNodeTree(root([leaf("a")]), { maxDepth: 0 });
    expect(result.node.children).toEqual([]);
    expect(result.inspection.returnedNodes).toBe(1);
    expect(result.inspection.truncated).toBe(true);
  });
  test("an exactly fitting tree is complete", () => {
    expect(boundNodeTree(root([leaf("a")]), { maxNodes: 2 }).inspection.truncated).toBe(false);
  });
  test("field selection skips descendants and irrelevant text without false truncation", () => {
    const result = boundNodeTree(root([{ ...leaf("a"), characters: "x".repeat(5000) }]), { fields: ["id"] });
    expect(result.inspection.returnedNodes).toBe(1);
    expect(result.inspection.truncated).toBe(false);
    expect(result.node.children).toBeUndefined();
  });
  test("long text is bounded and marked incomplete", () => {
    const result = boundNodeTree(leaf("a"), { maxTextLength: 3 });
    expect(result.node.characters).toBe("hel");
    expect(result.inspection.truncated).toBe(true);
  });
  test("multiple roots use one MCP request and preserve plugin coverage metadata", async () => {
    const callbacks: any = {};
    const requests: any[] = [];
    registerDocumentTools({ tool: (name: string, _description: any, _schema: any, callback: any) => { callbacks[name] = callback; } } as any,
      async (command: any, params: any) => { requests.push({ command, params }); return [{ nodeId: "a", document: { id: "a", inspection: { truncated: true } } }]; });
    const result = await callbacks.get_nodes_info({ nodeIds: ["a", "b"], fields: ["id"], maxNodes: 1 });
    expect(requests).toEqual([{ command: "get_nodes_info", params: { nodeIds: ["a", "b"], fields: ["id"], maxNodes: 1 } }]);
    expect(JSON.parse(result.content[0].text)[0].inspection.truncated).toBe(true);
  });
  test("plugin batching stops exporting when the shared budget is exhausted", async () => {
    const previous = (globalThis as any).figma;
    let exports = 0;
    (globalThis as any).figma = { getNodeByIdAsync: async (id: string) => ({ exportAsync: async () => { exports++; return { document: leaf(id) }; } }) };
    try {
      const result = await getNodesInfo(["a", "b", "c"], ["id"], { maxNodes: 1 });
      expect(exports).toBe(1);
      expect(result[0].document.id).toBe("a");
      expect(result[1].skipped).toBe("maxNodes");
      expect(result[2].skipped).toBe("maxNodes");
    } finally { (globalThis as any).figma = previous; }
  });
});

describe("reference and font reuse", () => {
  test("references stay scoped and snapshots cannot be mutated through retrieval", () => {
    const cache = new ReferenceCache();
    const data = { palette: ["#ffffff"] };
    cache.set("file-a", "palette", data);
    data.palette[0] = "#000000";
    expect(cache.get("file-b", "palette").found).toBe(false);
    const found = cache.get("file-a", "palette") as any;
    expect(found.data.palette).toEqual(["#ffffff"]);
    found.data.palette[0] = "changed";
    expect((cache.get("file-a", "palette") as any).data.palette).toEqual(["#ffffff"]);
    expect(cache.list("file-a")[0]).not.toHaveProperty("data");
  });
  test("expiry and clearing cannot expose another scope", () => {
    let now = 1000;
    const cache = new ReferenceCache(() => now);
    cache.set("a", "refs", {}, 1);
    cache.set("b", "refs", {}, 100);
    now += 1000;
    expect(cache.get("a", "refs").found).toBe(false);
    expect(cache.clear("a").cleared).toBe(0);
    expect(cache.get("b", "refs").found).toBe(true);
  });
  test("reference size and entry counts are bounded", () => {
    const cache = new ReferenceCache();
    expect(() => cache.set("a", "huge", { value: "é".repeat(40000) })).toThrow("64KB");
    for (let i = 0; i < 65; i++) cache.set("a", String(i), {});
    expect(cache.list("a")).toHaveLength(64);
    expect(cache.get("a", "0").found).toBe(false);
  });
  test("font loads share in-flight work and cache successes by family/style", async () => {
    let calls = 0;
    const load = createFontLoader(async () => { calls++; });
    const font = { family: "Inter", style: "Regular" };
    await Promise.all([load(font), load({ ...font })]);
    await load(font);
    await load({ ...font, style: "Bold" });
    expect(calls).toBe(2);
  });
  test("failed font loads can retry", async () => {
    let calls = 0;
    const load = createFontLoader(async () => { if (++calls === 1) throw new Error("unavailable"); });
    const font = { family: "Inter", style: "Regular" };
    await expect(load(font)).rejects.toThrow("unavailable");
    await load(font);
    expect(calls).toBe(2);
  });
});

describe("compact validation", () => {
  test("summary is bounded, distinguishes mixed paint bindings, and avoids component imports", async () => {
    const previous = (globalThis as any).figma;
    const paint = { type: "SOLID", color: { r: 1, g: 0, b: 0 } };
    const tree = root([
      { ...leaf("a"), fills: [{ ...paint, boundVariables: { color: { id: "token" } } }, paint], fontName: { family: "Inter", style: "Regular" } },
      { id: "instance", type: "INSTANCE", name: "Instance", getMainComponentAsync: () => { throw new Error("unnecessary read"); } },
      leaf("b"),
    ]);
    (globalThis as any).figma = { getNodeByIdAsync: async () => tree };
    try {
      const result = await scanNodeStyles({ nodeId: "root", summary: true, maxNodes: 3 });
      expect(result.nodes).toBeUndefined();
      expect(result.totalNodes).toBe(3);
      expect(result.truncated).toBe(true);
      expect(result.summary).toEqual({ textNodes: 1, instanceNodes: 1, fontFamilies: ["Inter"], unboundColorNodes: 1, unboundColorNodeIds: ["a"] });
    } finally { (globalThis as any).figma = previous; }
  });
  test("selected fields avoid unrelated paint and component reads", async () => {
    const previous = (globalThis as any).figma;
    const node = { id: "instance", name: "Instance", type: "INSTANCE", get fills(): any { throw new Error("unnecessary paint read"); }, getMainComponentAsync: () => { throw new Error("unnecessary component read"); } };
    (globalThis as any).figma = { getNodeByIdAsync: async () => node };
    try {
      expect((await scanNodeStyles({ nodeId: "instance", fields: ["id"] })).nodes).toEqual([{ id: "instance" }]);
    } finally { (globalThis as any).figma = previous; }
  });
});

describe("llm2figma setup compatibility", () => {
  test("fresh config uses the new name and JSON preserves paths with spaces", () => {
    const config = makeMcpConfig({}, "/bun path/bun", "/repo path", {});
    expect(config.mcpServers.LLM2Figma.command).toBe("/bun path/bun");
    expect(config.mcpServers.LLM2Figma.args[0]).toBe("/repo path/src/llm2figma_mcp/server.ts");
  });
  test("regeneration migrates the legacy name and preserves env and unrelated servers", () => {
    const previous = { mcpServers: { ClaudeToFigma: { env: { FIGMA_API_TOKEN: "test-token" } }, Other: { command: "other" } } };
    const config = makeMcpConfig(previous, "/bun", "/repo", { hostname: "host" });
    expect(config.mcpServers.LLM2Figma.env).toEqual(previous.mcpServers.ClaudeToFigma.env);
    expect(config.mcpServers.Other).toEqual(previous.mcpServers.Other);
    expect(config.mcpServers.ClaudeToFigma).toBeUndefined();
  });
});
