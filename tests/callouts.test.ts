/**
 * Callout layout (L2F_CALLOUTS): the pure rail layout in src/shared/callouts.ts.
 * No Figma needed:
 *   bun test tests/callouts.test.ts
 */
import { describe, expect, test } from "bun:test";
import {
  ANCHOR, BADGE_SIZE, boxesOverlap, layoutCallouts, leadersIntersect, readingOrder, settleRail, tightPack,
  type Box, type CalloutLayout, type CalloutOptions, type CalloutTarget, type PlacedCallout, type Size,
} from "../src/shared/callouts";

const FRAME: Box = { x: 0, y: 0, width: 800, height: 1000 };
const LABEL: Size = { width: 240, height: 40 };

const target = (key: string, x: number, y: number, width = 60, height = 30): CalloutTarget => ({ key, box: { x, y, width, height } });
const sizes = (n: number, s: Size = LABEL) => Array.from({ length: n }, () => ({ ...s }));
const run = (targets: CalloutTarget[], obstacles: Box[] = [], opts: CalloutOptions = {}, labelSizes = sizes(targets.length), frame = FRAME) =>
  layoutCallouts(frame, targets, labelSizes, obstacles, opts);

// A small deterministic PRNG so the property tests are reproducible.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function randomScenario(seed: number) {
  const r = rng(seed);
  const frame: Box = { x: Math.round(r() * 400), y: Math.round(r() * 400), width: 300 + Math.round(r() * 900), height: 300 + Math.round(r() * 900) };
  const n = 1 + Math.floor(r() * 12);
  const targets: CalloutTarget[] = [];
  for (let i = 0; i < n; i++) {
    const w = 10 + Math.round(r() * 200), h = 10 + Math.round(r() * 80);
    targets.push(target(`k${i}`, frame.x + Math.round(r() * (frame.width - w)), frame.y + Math.round(r() * (frame.height - h)), w, h));
  }
  const labelSizes = targets.map(() => ({ width: 240, height: 24 + Math.round(r() * 60) }));
  const obstacles: Box[] = [];
  if (r() < 0.5) obstacles.push({ x: frame.x - 600 + Math.round(r() * 300), y: frame.y + Math.round(r() * frame.height), width: 250, height: 200 + Math.round(r() * 300) });
  if (r() < 0.5) obstacles.push({ x: frame.x + frame.width + 60 + Math.round(r() * 300), y: frame.y - 200 + Math.round(r() * frame.height), width: 300, height: 300 });
  return { frame, targets, labelSizes, obstacles };
}

function checkInvariants(layout: CalloutLayout, frame: Box, obstacles: Box[], gap = 12) {
  const { placed } = layout;
  // Labels: never on the frame or an obstacle, never closer than gap to each other.
  for (const p of placed) {
    expect(boxesOverlap(p.label, frame)).toBe(false);
    for (const o of obstacles) expect(boxesOverlap(p.label, o)).toBe(false);
  }
  for (let a = 0; a < placed.length; a++) {
    for (let b = a + 1; b < placed.length; b++) {
      const A = placed[a].label, B = placed[b].label;
      const grown = { x: A.x - gap + 0.001, y: A.y - gap + 0.001, width: A.width + 2 * gap - 0.002, height: A.height + 2 * gap - 0.002 };
      expect(boxesOverlap(grown, B)).toBe(false);
    }
  }
  if (layout.mode === "numbered") return;
  // Leaders: axis-aligned, at most one elbow, ending in the dot on the target, pairwise disjoint.
  for (const p of placed) {
    const pts = p.leader!;
    expect([2, 4]).toContain(pts.length);
    for (let i = 1; i < pts.length; i++) {
      const horizontal = pts[i].y === pts[i - 1].y, verticalSeg = pts[i].x === pts[i - 1].x;
      expect(horizontal || verticalSeg).toBe(true);
    }
    // One elbow: horizontal, vertical, horizontal (or the transpose for top/bottom rails).
    if (pts.length === 4) {
      const sideRail = p.rail === "left" || p.rail === "right";
      expect(pts[0][sideRail ? "y" : "x"]).toBe(pts[1][sideRail ? "y" : "x"]);
      expect(pts[1][sideRail ? "x" : "y"]).toBe(pts[2][sideRail ? "x" : "y"]);
      expect(pts[2][sideRail ? "y" : "x"]).toBe(pts[3][sideRail ? "y" : "x"]);
    }
    expect(p.dot).toEqual(pts[pts.length - 1]);
    for (const o of obstacles) {
      for (let i = 1; i < pts.length; i++) {
        const seg = { x: Math.min(pts[i].x, pts[i - 1].x), y: Math.min(pts[i].y, pts[i - 1].y), width: Math.abs(pts[i].x - pts[i - 1].x) + 0.01, height: Math.abs(pts[i].y - pts[i - 1].y) + 0.01 };
        expect(boxesOverlap(seg, o)).toBe(false);
      }
    }
  }
  for (let a = 0; a < placed.length; a++) {
    for (let b = a + 1; b < placed.length; b++) expect(leadersIntersect(placed[a].leader!, placed[b].leader!)).toBe(false);
  }
}

const byRail = (layout: CalloutLayout, rail: string) => layout.placed.filter(p => p.rail === rail).sort((a, b) => along(a) - along(b));
const along = (p: PlacedCallout) => (p.rail === "left" || p.rail === "right" ? p.label.y : p.label.x);

describe("leaders mode", () => {
  test("targets go to the rail on their nearer side; labels sit beside the frame at railOffset", () => {
    const layout = run([target("a", 20, 100), target("b", 700, 300), target("c", 100, 600)]);
    expect(layout.mode).toBe("leaders");
    expect(layout.placed.map(p => [p.key, p.rail])).toEqual([["a", "left"], ["b", "right"], ["c", "left"]]);
    const a = layout.placed[0];
    expect(a.label.x + a.label.width).toBe(-48);
    expect(layout.placed[1].label.x).toBe(848);
    expect(layout.rails.left).toEqual({ x: -288, y: 0, width: 240, height: 1000 });
    expect(layout.rails.right).toEqual({ x: 848, y: 0, width: 240, height: 1000 });
    expect(layout.rails.top).toBeUndefined();
    expect(layout.overflow).toEqual([]);
  });

  test("an unobstructed label starts level with its target and gets a straight leader to a dot on the target", () => {
    const layout = run([target("a", 120, 200, 60, 40)]);
    const p = layout.placed[0];
    expect(p.label.y + ANCHOR).toBe(220);
    expect(p.leader).toEqual([{ x: -48, y: 220 }, { x: 120, y: 220 }]);
    expect(p.dot).toEqual({ x: 120, y: 220 });
  });

  test("order is kept per rail", () => {
    const ys = [400, 90, 95, 600, 100, 120, 130];
    const layout = run(ys.map((y, i) => target(`t${i}`, 30, y)));
    for (const rail of ["left", "right"]) {
      const list = byRail(layout, rail);
      const targetY = list.map(p => ys[p.index]);
      expect(targetY).toEqual(targetY.slice().sort((a, b) => a - b));
      expect(list.map(along)).toEqual(list.map(along).sort((a, b) => a - b));
    }
    checkInvariants(layout, FRAME, []);
  });

  test("crowded targets are pushed apart by at least gap, with orthogonal elbows that never cross", () => {
    const targets = [100, 110, 120, 130, 140, 900].map((y, i) => target(`t${i}`, 40 + i * 10, y, 40, 10));
    const layout = run(targets, [], { gap: 16 });
    expect(byRail(layout, "left")).toHaveLength(6);
    expect(layout.placed.filter(p => p.leader!.length === 4).length).toBeGreaterThan(3);
    checkInvariants(layout, FRAME, [], 16);
    // Elbows are staggered: no two share a gutter x.
    const elbows = layout.placed.filter(p => p.leader!.length === 4).map(p => p.leader![1].x);
    expect(new Set(elbows).size).toBe(elbows.length);
    // Every elbow is in the gutter between the rail and the frame.
    for (const x of elbows) expect(x > -48 && x < 0).toBe(true);
  });

  test("targets at the same y keep a stable (input) order", () => {
    const targets = [target("first", 300, 500), target("second", 50, 500), target("third", 200, 500)];
    const layout = run(targets);
    expect(byRail(layout, "left").sort((a, b) => along(a) - along(b)).map(p => p.key)).toEqual(["first", "second", "third"]);
    checkInvariants(layout, FRAME, []);
    const again = run([targets[1], targets[0], targets[2]]);
    expect(byRail(again, "left").sort((a, b) => along(a) - along(b)).map(p => p.key)).toEqual(["second", "first", "third"]);
  });

  test("a full side spills to the other side, then to top and bottom, and the rest is overflow", () => {
    const frame: Box = { x: 0, y: 0, width: 400, height: 200 };
    // Left rail holds 3 labels of 40 with gap 12 (3*40 + 2*12 = 144 <= 200, 4 needs 196 <= 200, 5 do not fit).
    const targets = Array.from({ length: 12 }, (_, i) => target(`t${i}`, 10 + i, 10 + i * 15, 20, 10));
    const layout = run(targets, [], {}, sizes(12), frame);
    expect(byRail(layout, "left")).toHaveLength(4);
    expect(byRail(layout, "right")).toHaveLength(4);
    // Top and bottom rails hold 240-wide labels along a 400-wide frame: one each.
    expect(byRail(layout, "top")).toHaveLength(1);
    expect(byRail(layout, "bottom")).toHaveLength(1);
    expect(layout.overflow).toHaveLength(2);
    expect(layout.overflow.every(o => o.reason === "no room")).toBe(true);
    // The callouts kept on the left are the ones nearest the left edge.
    const leftX = byRail(layout, "left").map(p => targets[p.index].box.x);
    const rightX = byRail(layout, "right").map(p => targets[p.index].box.x);
    expect(Math.max(...leftX)).toBeLessThan(Math.min(...rightX));
    checkInvariants(layout, frame, []);
  });

  test("rails limits where labels may go; overflow is reported with keys", () => {
    const frame: Box = { x: 0, y: 0, width: 400, height: 100 };
    const targets = Array.from({ length: 4 }, (_, i) => target(`t${i}`, 20, 10 + i * 20, 20, 10));
    const layout = run(targets, [], { rails: ["left"] }, sizes(4), frame);
    expect(byRail(layout, "left")).toHaveLength(2);
    expect(layout.placed.every(p => p.rail === "left")).toBe(true);
    expect(layout.overflow.map(o => o.key)).toEqual(["t2", "t3"]);
  });

  test("labels skip obstacles in the rail band, and never overlap the frame or an obstacle", () => {
    const sibling: Box = { x: -400, y: 200, width: 300, height: 300 };
    const targets = [target("a", 20, 300), target("b", 20, 350), target("c", 20, 100)];
    const layout = run(targets, [sibling]);
    checkInvariants(layout, FRAME, [sibling]);
    for (const p of byRail(layout, "left")) expect(p.label.y + p.label.height <= 188 || p.label.y >= 512).toBe(true);
  });

  test("a sibling inside the whole left band sends everything right", () => {
    const sibling: Box = { x: -150, y: -100, width: 120, height: 1200 };
    const layout = run([target("a", 20, 300), target("b", 20, 500)], [sibling]);
    expect(layout.placed.map(p => p.rail)).toEqual(["right", "right"]);
    checkInvariants(layout, FRAME, [sibling]);
  });

  test("output is deterministic and settling it again changes nothing", () => {
    const { frame, targets, labelSizes, obstacles } = randomScenario(7);
    const a = layoutCallouts(frame, targets, labelSizes, obstacles);
    const b = layoutCallouts(frame, targets.map(t => ({ ...t, box: { ...t.box } })), labelSizes.map(s => ({ ...s })), obstacles.map(o => ({ ...o })));
    expect(b).toEqual(a);
    // Re-running the settle on its own output is a fixed point.
    const ideal = [10, 12, 14, 400, 405];
    const len = [40, 40, 40, 30, 30];
    const free: [number, number][] = [[0, 300], [360, 1000]];
    const once = settleRail(ideal, len, free, 12)!;
    expect(settleRail(once, len, free, 12)).toEqual(once);
    expect(once).toEqual([10, 62, 114, 400, 442]);
  });

  test("settleRail pulls labels up when the bottom is reached, and tightPack reports no room", () => {
    expect(settleRail([90, 90], [20, 20], [[0, 100]], 10)).toEqual([50, 80]);
    expect(tightPack([60, 60], [[0, 100]], 10)).toBeNull();
    expect(tightPack([60, 30], [[0, 100]], 10)).toEqual([0, 70]);
  });

  test("property: random layouts keep every invariant", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { frame, targets, labelSizes, obstacles } = randomScenario(seed);
      const layout = layoutCallouts(frame, targets, labelSizes, obstacles);
      expect(layout.placed.length + layout.overflow.length).toBe(targets.length);
      checkInvariants(layout, frame, obstacles);
    }
  });

  test("duplicate keys and mismatched sizes are refused", () => {
    expect(() => run([target("a", 0, 0), target("a", 10, 10)])).toThrow("duplicate callout key: a");
    expect(() => layoutCallouts(FRAME, [target("a", 0, 0)], [], [])).toThrow("differ in length");
  });
});

describe("numbered (dense) mode", () => {
  const grid = (n: number) => Array.from({ length: n }, (_, i) => target(`k${i}`, 40 + (i % 4) * 180, 60 + Math.floor(i / 4) * 200 + (i % 2) * 6, 80, 40));

  test("more than denseThreshold callouts switch to numbered badges in reading order, with no leaders", () => {
    // Input in reverse so reading order is not input order.
    const targets = grid(16).reverse();
    const layout = run(targets);
    expect(layout.mode).toBe("numbered");
    expect(layout.placed.every(p => !p.leader && !p.dot)).toBe(true);
    const byNumber = layout.placed.slice().sort((a, b) => a.number! - b.number!);
    expect(byNumber.map(p => p.number)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    // Reading order: row by row, left to right, despite the 6px wobble within a row.
    expect(byNumber.map(p => p.key)).toEqual(Array.from({ length: 16 }, (_, i) => `k${i}`));
    for (const p of layout.placed) {
      const t = targets[p.index].box;
      expect(p.badge).toEqual({ x: t.x - BADGE_SIZE / 2, y: t.y - BADGE_SIZE / 2, width: BADGE_SIZE, height: BADGE_SIZE });
    }
    // The list reads top to bottom in the left rail, then continues in the right.
    const left = byRail(layout, "left"), right = byRail(layout, "right");
    expect(left.length + right.length).toBe(16);
    expect(left.map(p => p.number)).toEqual(left.map(p => p.number).sort((a, b) => a! - b!));
    expect(Math.max(...left.map(p => p.number!))).toBeLessThan(Math.min(...(right.length ? right.map(p => p.number!) : [Infinity])));
    expect(left[0].label.y).toBe(0);
    checkInvariants(layout, FRAME, []);
  });

  test("denseThreshold is configurable, and the exact threshold stays in leaders mode", () => {
    expect(run(grid(12)).mode).toBe("leaders");
    expect(run(grid(13)).mode).toBe("numbered");
    expect(run(grid(5), [], { denseThreshold: 4 }).mode).toBe("numbered");
  });

  test("readingOrder groups rows by the first box's extent", () => {
    const boxes: Box[] = [
      { x: 300, y: 10, width: 50, height: 40 },
      { x: 10, y: 20, width: 50, height: 40 },
      { x: 10, y: 100, width: 50, height: 40 },
      { x: 200, y: 0, width: 50, height: 40 },
    ];
    expect(readingOrder(boxes)).toEqual([1, 3, 0, 2]);
  });
});
