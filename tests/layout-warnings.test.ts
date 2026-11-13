/**
 * create_node_tree reports frames that hold several children without auto
 * layout, so the caller fixes them in the same pass.
 *   bun test tests/layout-warnings.test.ts
 */
import { describe, expect, test } from "bun:test";
import { findAbsoluteContainers } from "../src/llm2figma_mcp/tools/node-tree";

const rect = (name: string) => ({ type: "rectangle", name, width: 10, height: 10 });

describe("findAbsoluteContainers", () => {
  test("a frame with two children and no layoutMode is reported; auto layout frames are not", () => {
    const tree = {
      type: "frame", name: "screen", layoutMode: "VERTICAL",
      children: [
        { type: "frame", name: "card", children: [rect("a"), rect("b")] },
        { type: "frame", name: "row", layoutMode: "HORIZONTAL", children: [rect("c"), rect("d")] },
        { type: "frame", name: "single", children: [rect("e")] },
        { type: "frame", name: "explicit none", layoutMode: "NONE", children: [rect("f"), rect("g"), rect("h")] },
      ],
    };
    const found = findAbsoluteContainers(tree);
    expect(found.count).toBe(2);
    expect(found.examples).toEqual([{ name: "card", children: 2 }, { name: "explicit none", children: 3 }]);
  });

  test("$repeat rows count as children, and a template frame counts once per row", () => {
    const list = { type: "frame", name: "list", children: [{ $repeat: { data: [1, 2, 3], template: rect("item") } }] };
    expect(findAbsoluteContainers(list)).toEqual({ count: 1, examples: [{ name: "list", children: 3 }] });
    const grid = {
      type: "frame", name: "grid", layoutMode: "VERTICAL",
      children: [{ $repeat: { data: [1, 2, 3, 4], template: { type: "frame", name: "tile", children: [rect("x"), rect("y")] } } }],
    };
    expect(findAbsoluteContainers(grid).count).toBe(4);
    expect(findAbsoluteContainers(grid).examples).toEqual([{ name: "tile", children: 2 }]);
  });

  test("a fully auto layout tree reports nothing, and examples are capped", () => {
    const ok = { type: "frame", name: "ok", layoutMode: "VERTICAL", children: [rect("a"), rect("b")] };
    expect(findAbsoluteContainers(ok)).toEqual({ count: 0, examples: [] });
    const many = { type: "frame", name: "root", layoutMode: "VERTICAL", children: Array.from({ length: 15 }, (_, i) => ({ type: "frame", name: `f${i}`, children: [rect("a"), rect("b")] })) };
    const found = findAbsoluteContainers(many);
    expect(found.count).toBe(15);
    expect(found.examples).toHaveLength(10);
  });
});
