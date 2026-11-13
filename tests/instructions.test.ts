/**
 * Server instructions steer every session toward spec sync for edits, and
 * never mention flagged tools that are not registered.
 *   bun test tests/instructions.test.ts
 */
import { describe, expect, test } from "bun:test";
import { serverInstructions } from "../src/llm2figma_mcp/instructions";

describe("server instructions", () => {
  test("with L2F_ALL, edits default to spec sync and bulk edits to snapshot/diff", () => {
    const text = serverInstructions({ L2F_ALL: "1" });
    expect(text).toContain("use spec sync by default");
    expect(text).toContain("pull_spec");
    expect(text).toContain("apply_spec");
    // Prototype links are edited through the Spec, not figma_eval (issue #40).
    expect(text).toContain("order, prototype links (reactions), adding or removing layers), use spec sync");
    expect(text).not.toMatch(/figma_eval or the batch tools instead[^\n]*prototype/);
    expect(text).toContain("snapshot_positions");
  });

  test("with no flags, no flagged tool is mentioned", () => {
    const text = serverInstructions({});
    for (const tool of ["pull_spec", "plan_spec", "apply_spec", "snapshot_positions", "diff_positions"]) {
      expect(text).not.toContain(tool);
    }
    expect(text).toContain("join_channel");
  });

  test("auto layout, components and issue filing are always in the instructions", () => {
    for (const env of [{}, { L2F_ALL: "1" }]) {
      const text = serverInstructions(env);
      expect(text).toContain("auto layout");
      expect(text).toContain("layoutWarnings");
      expect(text).toContain("get_local_components");
      expect(text).toContain("three times");
      expect(text).toContain("gh issue create -R rydersd/claude-to-figma --label l2f-feedback");
      expect(text).toContain("The repository is public");
    }
  });

  test("each flag adds only its own guidance", () => {
    expect(serverInstructions({ L2F_SPEC_SYNC: "1" })).toContain("pull_spec");
    expect(serverInstructions({ L2F_SPEC_SYNC: "1" })).not.toContain("snapshot_positions");
    expect(serverInstructions({ L2F_VERIFY: "1" })).toContain("snapshot_positions");
    expect(serverInstructions({ L2F_VERIFY: "1" })).not.toContain("pull_spec");
  });
});
