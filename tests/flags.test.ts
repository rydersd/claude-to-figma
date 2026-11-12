import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { FEATURES, isEnabled, registerWhenEnabled } from "../src/shared/flags";
import { FLAG_ENV_KEYS, makeMcpConfig } from "../scripts/write-mcp-config";
import { allowedEditors, assertEditorAllowed } from "../src/llm2figma_plugin/src/editor-gate";
import { getDocumentInfo } from "../src/llm2figma_plugin/src/document";

describe("feature flags", () => {
  test("every flag is off by default", () => {
    for (const feature of FEATURES) expect(isEnabled(feature, {})).toBe(false);
  });
  test("each flag turns on only its own feature", () => {
    for (const feature of FEATURES) {
      const env = { [`L2F_${feature}`]: "1" };
      for (const other of FEATURES) expect(isEnabled(other, env)).toBe(other === feature);
    }
  });
  test("only the value 1 enables a flag", () => {
    expect(isEnabled("FLOWS", { L2F_FLOWS: "" })).toBe(false);
    expect(isEnabled("FLOWS", { L2F_FLOWS: "true" })).toBe(false);
    expect(isEnabled("FLOWS", { L2F_ALL: "0" })).toBe(false);
  });
  test("L2F_ALL enables everything except COMMENTS_WRITE", () => {
    for (const feature of FEATURES) expect(isEnabled(feature, { L2F_ALL: "1" })).toBe(feature !== "COMMENTS_WRITE");
    expect(isEnabled("COMMENTS_WRITE", { L2F_ALL: "1", L2F_COMMENTS_WRITE: "1" })).toBe(true);
  });
  test("a gated module is not registered when off and is registered when on", () => {
    const names: string[] = [];
    const register = (server: any) => server.tool("get_flows");
    const server = { tool: (name: string) => names.push(name) };
    expect(registerWhenEnabled("FLOWS", register, server, null, {})).toBe(false);
    expect(names).toEqual([]);
    expect(registerWhenEnabled("FLOWS", register, server, null, { L2F_FLOWS: "1" })).toBe(true);
    expect(names).toEqual(["get_flows"]);
  });
});

describe("launch paths", () => {
  test("write-mcp-config writes an L2F env reference for every flag", () => {
    const env = makeMcpConfig({}, "/bun", "/repo", {}).mcpServers.LLM2Figma.env;
    for (const key of FLAG_ENV_KEYS) expect(env[key]).toBe(`\${${key}:-}`);
    expect(FLAG_ENV_KEYS).toContain("L2F_COMMENTS_WRITE");
  });
  test("write-mcp-config keeps values already set in the existing config", () => {
    const previous = { mcpServers: { LLM2Figma: { env: { L2F_FLOWS: "1", OTHER: "x" } } } };
    const env = makeMcpConfig(previous, "/bun", "/repo", {}).mcpServers.LLM2Figma.env;
    expect(env.L2F_FLOWS).toBe("1");
    expect(env.OTHER).toBe("x");
  });
  test("plugin.json passes every L2F flag through", () => {
    const manifest = JSON.parse(readFileSync("plugin/.claude-plugin/plugin.json", "utf8"));
    const env = manifest.mcpServers.LLM2Figma.env;
    expect(Object.keys(env).sort()).toEqual([...FLAG_ENV_KEYS].sort());
    for (const key of FLAG_ENV_KEYS) expect(env[key]).toBe(`\${${key}:-}`);
  });
  test("plugin manifest declares the private API and the slides and buzz editors", () => {
    const manifest = JSON.parse(readFileSync("src/llm2figma_plugin/manifest.json", "utf8"));
    expect(manifest.enablePrivatePluginApi).toBe(true);
    expect(manifest.editorType).toEqual(["figma", "figjam", "slides", "buzz"]);
  });
});

describe("editor-type gate", () => {
  test("a mutating command is refused in dev and allowed elsewhere", () => {
    expect(() => assertEditorAllowed("set_fill_color", "dev")).toThrow("not available in the dev editor");
    for (const editor of ["figma", "figjam", "slides", "buzz"]) expect(() => assertEditorAllowed("set_fill_color", editor)).not.toThrow();
  });
  test("a read-only command is allowed in dev", () => {
    expect(() => assertEditorAllowed("get_node_info", "dev")).not.toThrow();
    expect(allowedEditors("get_document_info")).toContain("dev");
  });
  test("every read-only command named in the gate exists in the dispatcher", () => {
    const main = readFileSync("src/llm2figma_plugin/src/main.ts", "utf8");
    const gate = readFileSync("src/llm2figma_plugin/src/editor-gate.ts", "utf8");
    const block = gate.slice(gate.indexOf("new Set(["), gate.indexOf("]);"));
    for (const [, name] of block.matchAll(/"([a-z_]+)"/g)) expect(main).toContain(`case "${name}":`);
  });
  test("get_document_info reports the editor type", async () => {
    const original = (globalThis as any).figma;
    (globalThis as any).figma = { editorType: "figjam", currentPage: { id: "1:1", name: "P", type: "PAGE", children: [], loadAsync: async () => {} } };
    try { expect((await getDocumentInfo()).editorType).toBe("figjam"); }
    finally { (globalThis as any).figma = original; }
  });
});
