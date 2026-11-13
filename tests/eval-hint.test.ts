import { describe, expect, test } from "bun:test";
import { DYNAMIC_PAGE_HINT, evalErrorText } from "../src/llm2figma_mcp/tools/eval";

describe("figma_eval error hint", () => {
  test("adds the async-lookup hint when Figma rejects a sync call under dynamic-page", () => {
    const text = evalErrorText("in getNodeById: Cannot call with documentAccess: dynamic-page. Use figma.getNodeByIdAsync instead.");
    expect(text).toStartWith("Eval error: in getNodeById");
    expect(text).toContain(DYNAMIC_PAGE_HINT);
    expect(text).toContain("figma.getNodeByIdAsync(id)");
  });

  test("leaves other errors unchanged", () => {
    expect(evalErrorText("x is not defined")).toBe("Eval error: x is not defined");
  });
});
