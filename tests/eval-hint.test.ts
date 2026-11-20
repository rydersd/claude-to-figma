import { describe, expect, test } from "bun:test";
import { DYNAMIC_PAGE_HINT, evalErrorText, syncMainComponentRead } from "../src/llm2figma_mcp/tools/eval";

describe("figma_eval error hint", () => {
  test("adds the async-lookup hint when Figma rejects a sync call under dynamic-page", () => {
    const text = evalErrorText("in getNodeById: Cannot call with documentAccess: dynamic-page. Use figma.getNodeByIdAsync instead.");
    expect(text).toStartWith("Eval error: in getNodeById");
    expect(text).toContain(DYNAMIC_PAGE_HINT);
    expect(text).toContain("figma.getNodeByIdAsync(id)");
  });

  test("tells callers how to read an instance's main component", () => {
    const text = evalErrorText("in get_mainComponent: Cannot call with documentAccess: dynamic-page. Use node.getMainComponentAsync instead.");
    expect(text).toContain("getMainComponentAsync()");
    expect(text).toContain("collect instances first");
  });

  test("leaves other errors unchanged", () => {
    expect(evalErrorText("x is not defined")).toBe("Eval error: x is not defined");
  });

  test("catches sync mainComponent reads before the script runs", () => {
    expect(syncMainComponentRead("const n = figma.currentPage.findOne(n => n.type === 'INSTANCE' && n.mainComponent.name === 'x');")).toBe(true);
    expect(syncMainComponentRead("const mc = node.mainComponent;")).toBe(true);
    expect(syncMainComponentRead("const mc = node?.mainComponent?.key;")).toBe(true);
    expect(syncMainComponentRead("if (inst.mainComponent == null) {}")).toBe(true);
  });

  test("allows the async form, property references and setters", () => {
    expect(syncMainComponentRead("const mc = await node.getMainComponentAsync();")).toBe(false);
    expect(syncMainComponentRead("const ref = child.componentPropertyReferences?.mainComponent;")).toBe(false);
    expect(syncMainComponentRead("inst.mainComponent = comp;")).toBe(false);
    expect(syncMainComponentRead("const mainComponent = await n.getMainComponentAsync(); return mainComponent.name;")).toBe(false);
  });
});
