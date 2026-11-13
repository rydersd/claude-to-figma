// Pure callout layout (L2F_CALLOUTS), shared by the plugin and the tests. No
// Figma access here: the plugin reads absolute boxes and measured label sizes
// and passes plain values in, then draws what this returns.
//
// Callouts sit in rails beside the frame, never on it. Each target goes to the
// rail on its nearer side (left or right); the other side takes what does not
// fit, then top and bottom, and the rest is returned as overflow. Leaders are
// orthogonal: out of the label, one elbow in the gutter between the rail and the
// frame, then straight to the target, ending in a dot on it. Above
// `denseThreshold` callouts, the layout switches to numbered badges on the
// targets and a numbered list in the rails, with no leaders.

import type { Box } from "./verify";

export type { Box };
export type Rail = "left" | "right" | "top" | "bottom";
export const RAILS: readonly Rail[] = ["left", "right", "top", "bottom"];

export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface CalloutTarget { key: string; box: Box }

export interface CalloutOptions {
  rails?: readonly Rail[];
  gap?: number;
  railOffset?: number;
  width?: number;
  denseThreshold?: number;
}

export interface PlacedCallout {
  key: string;
  index: number;          // position in the input
  rail: Rail;
  label: Box;             // absolute
  number?: number;        // numbered mode only
  badge?: Box;            // numbered mode only, on the target
  leader?: Point[];       // leaders mode only: 2 points (straight) or 4 (one elbow)
  dot?: Point;            // leaders mode only, the leader's end on the target
}

export type OverflowReason = "no room" | "crossing" | "blocked";
export interface OverflowCallout { key: string; index: number; reason: OverflowReason }

export interface CalloutLayout {
  mode: "leaders" | "numbered";
  placed: PlacedCallout[];          // input order
  overflow: OverflowCallout[];      // input order
  rails: Partial<Record<Rail, Box>>; // furniture box of every rail that holds a label
}

export const DEFAULTS = { gap: 12, railOffset: 48, width: 240, denseThreshold: 12 } as const;
// The leader meets a label this far below its top edge (or at its middle, if shorter):
// level with the first line of text rather than the middle of a long paragraph.
export const ANCHOR = 12;
// Neighbouring leaders in one rail end at least this far apart on their targets.
export const MIN_ATTACH_SEPARATION = 4;
export const BADGE_SIZE = 20;
// A label within this distance of its target's line gets a straight leader.
export const STRAIGHT_TOLERANCE = 1;

const EPS = 1e-6;

export function calloutMode(count: number, denseThreshold: number = DEFAULTS.denseThreshold): "leaders" | "numbered" {
  return count > denseThreshold ? "numbered" : "leaders";
}

// Reading order of target boxes: rows top to bottom, left to right within a row.
// A box joins the current row when its centre lies within the row's first box's
// vertical extent, so slightly misaligned items in one row do not zig-zag.
// Returns input indices.
export function readingOrder(boxes: readonly Box[]): number[] {
  const byTop = boxes.map((b, i) => i).sort((a, b) => boxes[a].y - boxes[b].y || boxes[a].x - boxes[b].x || a - b);
  const rows: number[][] = [];
  for (const i of byTop) {
    const row = rows[rows.length - 1];
    const head = row ? boxes[row[0]] : null;
    const cy = boxes[i].y + boxes[i].height / 2;
    if (head && cy >= head.y && cy <= head.y + head.height) row!.push(i);
    else rows.push([i]);
  }
  return rows.flatMap(row => row.sort((a, b) => boxes[a].x - boxes[b].x || a - b));
}

// --- Rail geometry -------------------------------------------------------
// Each rail is handled in its own coordinates: u runs along the rail, d is the
// distance outward from the frame edge (negative inside the frame).

interface Geometry {
  frame: Box;
  gap: number;
  railOffset: number;
  width: number;
  bandHeight: number; // across size of the top and bottom rails
}

const vertical = (rail: Rail) => rail === "left" || rail === "right";

function point(g: Geometry, rail: Rail, u: number, d: number): Point {
  const f = g.frame;
  switch (rail) {
    case "left": return { x: f.x - d, y: u };
    case "right": return { x: f.x + f.width + d, y: u };
    case "top": return { x: u, y: f.y - d };
    case "bottom": return { x: u, y: f.y + f.height + d };
  }
}

function boxFrom(a: Point, b: Point): Box {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

const along = (rail: Rail, s: Size) => (vertical(rail) ? s.height : s.width);
const across = (rail: Rail, s: Size) => (vertical(rail) ? s.width : s.height);
const alongStart = (rail: Rail, b: Box) => (vertical(rail) ? b.y : b.x);
const alongSize = (rail: Rail, b: Box) => (vertical(rail) ? b.height : b.width);

function railExtent(g: Geometry, rail: Rail): [number, number] {
  const f = g.frame;
  return vertical(rail) ? [f.y, f.y + f.height] : [f.x, f.x + f.width];
}

function railDepth(g: Geometry, rail: Rail): number {
  return vertical(rail) ? g.width : g.bandHeight;
}

// The rail's furniture box: where its labels go, outside the gutter.
export function railBox(g: Geometry, rail: Rail): Box {
  const [a, b] = railExtent(g, rail);
  return boxFrom(point(g, rail, a, g.railOffset), point(g, rail, b, g.railOffset + railDepth(g, rail)));
}

// The band an obstacle must stay out of: rail plus gutter.
function bandBox(g: Geometry, rail: Rail): Box {
  const [a, b] = railExtent(g, rail);
  return boxFrom(point(g, rail, a, 0), point(g, rail, b, g.railOffset + railDepth(g, rail)));
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width - EPS && b.x < a.x + a.width - EPS && a.y < b.y + b.height - EPS && b.y < a.y + a.height - EPS;
}

type Interval = [number, number];

// The parts of the rail's extent no obstacle (kept `gap` clear) blocks.
function freeIntervals(g: Geometry, rail: Rail, obstacles: readonly Box[]): Interval[] {
  const band = bandBox(g, rail);
  const [start, end] = railExtent(g, rail);
  let free: Interval[] = [[start, end]];
  for (const o of obstacles) {
    if (!boxesOverlap(o, band)) continue;
    const lo = alongStart(rail, o) - g.gap, hi = alongStart(rail, o) + alongSize(rail, o) + g.gap;
    free = free.flatMap(([a, b]): Interval[] => {
      if (hi <= a || lo >= b) return [[a, b]];
      const parts: Interval[] = [];
      if (lo > a) parts.push([a, lo]);
      if (hi < b) parts.push([hi, b]);
      return parts;
    });
  }
  return free;
}

function snapForward(p: number, size: number, free: Interval[]): number | null {
  for (const [a, b] of free) {
    const q = Math.max(p, a);
    if (q + size <= b + EPS) return q;
  }
  return null;
}

function snapBackward(p: number, size: number, free: Interval[]): number | null {
  for (let k = free.length - 1; k >= 0; k--) {
    const [a, b] = free[k];
    const q = Math.min(p, b - size);
    if (q >= a - EPS) return q;
  }
  return null;
}

// Every label as early as it can go, in order. Null when they do not all fit.
export function tightPack(sizes: readonly number[], free: Interval[], gap: number): number[] | null {
  const pos: number[] = [];
  for (let i = 0; i < sizes.length; i++) {
    const p = snapForward(i ? pos[i - 1] + sizes[i - 1] + gap : -Infinity, sizes[i], free);
    if (p === null) return null;
    pos.push(p);
  }
  return pos;
}

// Labels start at their ideal positions; a downward sweep enforces the gap (and
// skips past obstacles), an upward sweep pulls labels back up within the rail,
// and the two repeat until nothing moves. Falls back to a tight pack if the
// sweeps cannot settle (only possible when obstacles fragment the rail).
export function settleRail(ideal: readonly number[], sizes: readonly number[], free: Interval[], gap: number): number[] | null {
  const n = ideal.length;
  if (!n) return [];
  let pos = ideal.slice();
  for (let iteration = 0; iteration < 20; iteration++) {
    const next = pos.slice();
    let ok = true;
    // Down: from the ideal, at least gap below the previous label, past any
    // obstacle. A label that runs off the end of the rail stays there for now.
    for (let i = 0; i < n; i++) {
      const lo = i ? next[i - 1] + sizes[i - 1] + gap : -Infinity;
      const want = Math.max(ideal[i], lo);
      next[i] = snapForward(want, sizes[i], free) ?? want;
    }
    // Up: pull back anything off the end or too close to the label below.
    for (let i = n - 1; i >= 0 && ok; i--) {
      const hi = i < n - 1 ? next[i + 1] - gap - sizes[i] : Infinity;
      if (next[i] <= hi + EPS && inFree(next[i], sizes[i], free)) continue;
      const p = snapBackward(Math.min(next[i], hi), sizes[i], free);
      if (p === null) ok = false; else next[i] = p;
    }
    if (!ok || !validRail(next, sizes, free, gap)) return tightPack(sizes, free, gap);
    const moved = next.some((p, i) => Math.abs(p - pos[i]) > EPS);
    pos = next;
    if (!moved) break;
  }
  return pos;
}

function inFree(p: number, size: number, free: Interval[]): boolean {
  return free.some(([a, b]) => p >= a - EPS && p + size <= b + EPS);
}

function validRail(pos: readonly number[], sizes: readonly number[], free: Interval[], gap: number): boolean {
  for (let i = 0; i < pos.length; i++) {
    if (!inFree(pos[i], sizes[i], free)) return false;
    if (i && pos[i] < pos[i - 1] + sizes[i - 1] + gap - EPS) return false;
  }
  return true;
}

// --- Segments -----------------------------------------------------------

export type Segment = [Point, Point];

export function leaderSegments(points: readonly Point[]): Segment[] {
  const segs: Segment[] = [];
  for (let i = 1; i < points.length; i++) segs.push([points[i - 1], points[i]]);
  return segs;
}

// Axis-aligned segments only (which is all a leader has). Touching counts.
export function segmentsIntersect([a1, a2]: Segment, [b1, b2]: Segment): boolean {
  const ax0 = Math.min(a1.x, a2.x), ax1 = Math.max(a1.x, a2.x), ay0 = Math.min(a1.y, a2.y), ay1 = Math.max(a1.y, a2.y);
  const bx0 = Math.min(b1.x, b2.x), bx1 = Math.max(b1.x, b2.x), by0 = Math.min(b1.y, b2.y), by1 = Math.max(b1.y, b2.y);
  return ax0 <= bx1 + EPS && bx0 <= ax1 + EPS && ay0 <= by1 + EPS && by0 <= ay1 + EPS;
}

function segmentHitsBox([a, b]: Segment, box: Box): boolean {
  return boxesOverlap({ x: Math.min(a.x, b.x) - EPS, y: Math.min(a.y, b.y) - EPS, width: Math.abs(a.x - b.x) + 2 * EPS, height: Math.abs(a.y - b.y) + 2 * EPS }, box);
}

export function leadersIntersect(a: readonly Point[], b: readonly Point[]): boolean {
  return leaderSegments(a).some(s => leaderSegments(b).some(t => segmentsIntersect(s, t)));
}

// --- Leaders mode ---------------------------------------------------------

interface Member { index: number; attachU: number; depth: number }

function attachFor(g: Geometry, rail: Rail, t: Box): { u: number; depth: number; uMin: number; uMax: number } {
  const f = g.frame;
  const u = vertical(rail) ? t.y + t.height / 2 : t.x + t.width / 2;
  const [uMin, uMax] = vertical(rail) ? [t.y, t.y + t.height] : [t.x, t.x + t.width];
  let depth: number;
  switch (rail) {
    case "left": depth = t.x - f.x; break;
    case "right": depth = f.x + f.width - (t.x + t.width); break;
    case "top": depth = t.y - f.y; break;
    case "bottom": depth = f.y + f.height - (t.y + t.height); break;
  }
  return { u, depth: Math.max(0, depth), uMin, uMax };
}

const anchorOffset = (rail: Rail, s: Size) => (vertical(rail) ? Math.min(s.height / 2, ANCHOR) : s.width / 2);

interface RailPlan { members: Member[]; pos: number[] }

// Sort a rail's members by their target's position along it (input order on a
// tie) and spread attach points that would otherwise share a line.
function railMembers(g: Geometry, rail: Rail, indices: readonly number[], targets: readonly CalloutTarget[]): Member[] {
  const raw = indices.map(index => ({ index, ...attachFor(g, rail, targets[index].box) }));
  raw.sort((a, b) => a.u - b.u || a.index - b.index);
  const members: Member[] = [];
  for (const m of raw) {
    let u = m.u;
    const prev = members[members.length - 1];
    if (prev && u < prev.attachU + MIN_ATTACH_SEPARATION) u = Math.min(prev.attachU + MIN_ATTACH_SEPARATION, Math.max(m.uMin, m.uMax - 1));
    members.push({ index: m.index, attachU: u, depth: m.depth });
  }
  return members;
}

function planRail(g: Geometry, rail: Rail, members: Member[], sizes: readonly Size[], free: Interval[]): number[] | null {
  const lengths = members.map(m => along(rail, sizes[m.index]));
  const ideal = members.map(m => Math.round(m.attachU - anchorOffset(rail, sizes[m.index])));
  return settleRail(ideal, lengths, free, g.gap);
}

function fits(g: Geometry, rail: Rail, indices: readonly number[], targets: readonly CalloutTarget[], sizes: readonly Size[], free: Interval[]): boolean {
  const members = railMembers(g, rail, indices, targets);
  return tightPack(members.map(m => along(rail, sizes[m.index])), free, g.gap) !== null;
}

// Distance of a target's centre from the rail's frame edge: the larger, the
// better the target suits another rail.
function distanceFromRail(g: Geometry, rail: Rail, t: Box): number {
  const f = g.frame, cx = t.x + t.width / 2, cy = t.y + t.height / 2;
  switch (rail) {
    case "left": return cx - f.x;
    case "right": return f.x + f.width - cx;
    case "top": return cy - f.y;
    case "bottom": return f.y + f.height - cy;
  }
}

function buildLeaders(g: Geometry, rail: Rail, members: Member[], pos: number[], sizes: readonly Size[]): PlacedCallout[] {
  // Down leaders (target further along than the label) take lanes moving out
  // from the frame in rail order; up leaders take the remaining lanes moving
  // in. That ordering is what keeps elbows from crossing.
  const anchors = members.map((m, i) => pos[i] + anchorOffset(rail, sizes[m.index]));
  const straight = members.map((m, i) => Math.abs(anchors[i] - m.attachU) <= STRAIGHT_TOLERANCE);
  const down = members.map((m, i) => i).filter(i => !straight[i] && members[i].attachU > anchors[i]);
  const up = members.map((m, i) => i).filter(i => !straight[i] && members[i].attachU < anchors[i]).reverse();
  const lanes = [...down, ...up];
  const laneD = new Map<number, number>();
  lanes.forEach((i, k) => laneD.set(i, Math.round(g.railOffset * (k + 1) / (lanes.length + 1) * 2) / 2));
  return members.map((m, i) => {
    const s = sizes[m.index];
    const label = boxFrom(point(g, rail, pos[i], g.railOffset), point(g, rail, pos[i] + along(rail, s), g.railOffset + across(rail, s)));
    const end = point(g, rail, m.attachU, -m.depth);
    const leader = straight[i]
      ? [point(g, rail, m.attachU, g.railOffset), end]
      : [point(g, rail, anchors[i], g.railOffset), point(g, rail, anchors[i], laneD.get(i)!), point(g, rail, m.attachU, laneD.get(i)!), end];
    return { key: "", index: m.index, rail, label, leader, dot: end };
  });
}

function validate(targets: readonly CalloutTarget[], sizes: readonly Size[]) {
  if (targets.length !== sizes.length) throw new Error(`targets (${targets.length}) and labelSizes (${sizes.length}) differ in length`);
  const seen = new Set<string>();
  for (const t of targets) {
    if (seen.has(t.key)) throw new Error(`duplicate callout key: ${t.key}`);
    seen.add(t.key);
  }
}

function resolveOptions(opts: CalloutOptions) {
  const rails = RAILS.filter(r => (opts.rails ?? RAILS).includes(r));
  return {
    rails,
    gap: opts.gap ?? DEFAULTS.gap,
    railOffset: opts.railOffset ?? DEFAULTS.railOffset,
    width: opts.width ?? DEFAULTS.width,
    denseThreshold: opts.denseThreshold ?? DEFAULTS.denseThreshold,
  };
}

export function layoutCallouts(
  frameBox: Box,
  targets: readonly CalloutTarget[],
  labelSizes: readonly Size[],
  obstacles: readonly Box[],
  opts: CalloutOptions = {},
): CalloutLayout {
  validate(targets, labelSizes);
  const o = resolveOptions(opts);
  const g: Geometry = {
    frame: frameBox, gap: o.gap, railOffset: o.railOffset,
    width: Math.max(o.width, ...labelSizes.map(s => s.width)),
    bandHeight: Math.max(0, ...labelSizes.map(s => s.height)),
  };
  const free = Object.fromEntries(o.rails.map(r => [r, freeIntervals(g, r, obstacles)])) as Record<Rail, Interval[]>;
  const result = calloutMode(targets.length, o.denseThreshold) === "numbered"
    ? layoutNumbered(g, o.rails, targets, labelSizes, free)
    : layoutLeaders(g, o.rails, targets, labelSizes, free, obstacles);
  for (const p of result.placed) p.key = targets[p.index].key;
  result.placed.sort((a, b) => a.index - b.index);
  result.overflow.sort((a, b) => a.index - b.index);
  const rails: Partial<Record<Rail, Box>> = {};
  for (const r of o.rails) if (result.placed.some(p => p.rail === r)) rails[r] = railBox(g, r);
  return { ...result, rails };
}

function layoutLeaders(
  g: Geometry, allowed: Rail[], targets: readonly CalloutTarget[], sizes: readonly Size[],
  free: Record<Rail, Interval[]>, obstacles: readonly Box[],
): Omit<CalloutLayout, "rails"> {
  const assigned: Record<Rail, number[]> = { left: [], right: [], top: [], bottom: [] };
  const overflow: OverflowCallout[] = [];
  const has = (r: Rail) => allowed.includes(r);
  const fitsIn = (r: Rail, list: number[]) => fits(g, r, list, targets, sizes, free[r]);
  const cx = g.frame.x + g.frame.width / 2, cy = g.frame.y + g.frame.height / 2;
  const centre = (i: number) => ({ x: targets[i].box.x + targets[i].box.width / 2, y: targets[i].box.y + targets[i].box.height / 2 });

  // Trim a rail to what fits, dropping the targets furthest from it first.
  const trim = (r: Rail): number[] => {
    const dropped: number[] = [];
    while (assigned[r].length && !fitsIn(r, assigned[r])) {
      const victim = assigned[r].reduce((best, i) => {
        const d = distanceFromRail(g, r, targets[i].box), bd = distanceFromRail(g, r, targets[best].box);
        return d > bd + EPS || (Math.abs(d - bd) <= EPS && i > best) ? i : best;
      });
      assigned[r] = assigned[r].filter(i => i !== victim);
      dropped.push(victim);
    }
    return dropped;
  };
  // Offer callouts to a rail, nearest first; returns the ones it could not take.
  const offer = (r: Rail, list: number[]): number[] => {
    if (!has(r)) return list;
    const rest: number[] = [];
    const byNearest = list.slice().sort((a, b) => distanceFromRail(g, r, targets[a].box) - distanceFromRail(g, r, targets[b].box) || a - b);
    for (const i of byNearest) {
      if (fitsIn(r, [...assigned[r], i])) assigned[r].push(i);
      else rest.push(i);
    }
    return rest.sort((a, b) => a - b);
  };

  // 1. Nearer side rail.
  const pool: number[] = [];
  targets.forEach((_, i) => {
    const near: Rail = centre(i).x <= cx ? "left" : "right";
    const far: Rail = near === "left" ? "right" : "left";
    if (has(near)) assigned[near].push(i);
    else if (has(far)) assigned[far].push(i);
    else pool.push(i);
  });
  // 2. Each side's excess goes to the other side.
  const fromLeft = trim("left"), fromRight = trim("right");
  pool.push(...offer("right", fromLeft), ...offer("left", fromRight));
  // 3. Then the nearer of top and bottom, then the other.
  const toTop = pool.filter(i => centre(i).y <= cy), toBottom = pool.filter(i => centre(i).y > cy);
  const leftover = [...offer("top", toTop), ...offer("bottom", toBottom)];
  const last = [...offer("bottom", leftover.filter(i => centre(i).y <= cy)), ...offer("top", leftover.filter(i => centre(i).y > cy))];
  for (const i of last) overflow.push({ key: targets[i].key, index: i, reason: "no room" });

  // 4. Lay out each rail; drop any callout whose leader would cross another
  // leader or an obstacle (top and bottom rails give way first), and repeat.
  const priority: Rail[] = ["bottom", "top", "right", "left"];
  for (let guard = 0; guard <= targets.length; guard++) {
    const placed: PlacedCallout[] = [];
    for (const r of RAILS) {
      if (!assigned[r].length) continue;
      const members = railMembers(g, r, assigned[r], targets);
      const pos = planRail(g, r, members, sizes, free[r]);
      if (!pos) throw new Error(`internal: rail ${r} did not fit after the capacity check`);
      placed.push(...buildLeaders(g, r, members, pos, sizes));
    }
    const blocked = placed.find(p => leaderSegments(p.leader!).some(s => obstacles.some(b => segmentHitsBox(s, b))));
    let victim: PlacedCallout | undefined = blocked;
    let reason: OverflowReason = "blocked";
    if (!victim) {
      outer: for (let a = 0; a < placed.length; a++) {
        for (let b = a + 1; b < placed.length; b++) {
          if (!leadersIntersect(placed[a].leader!, placed[b].leader!)) continue;
          const [pa, pb] = [placed[a], placed[b]];
          const ra = priority.indexOf(pa.rail), rb = priority.indexOf(pb.rail);
          victim = ra < rb ? pa : rb < ra ? pb : (pa.index > pb.index ? pa : pb);
          reason = "crossing";
          break outer;
        }
      }
    }
    if (!victim) return { mode: "leaders", placed, overflow };
    assigned[victim.rail] = assigned[victim.rail].filter(i => i !== victim!.index);
    overflow.push({ key: targets[victim.index].key, index: victim.index, reason });
  }
  throw new Error("internal: leader crossing guard did not converge");
}

function layoutNumbered(
  g: Geometry, allowed: Rail[], targets: readonly CalloutTarget[], sizes: readonly Size[], free: Record<Rail, Interval[]>,
): Omit<CalloutLayout, "rails"> {
  const order = readingOrder(targets.map(t => t.box));
  const placed: PlacedCallout[] = [];
  const overflow: OverflowCallout[] = [];
  let railIndex = 0;
  let cursor = -Infinity;
  for (let n = 0; n < order.length; n++) {
    const i = order[n];
    let spot: number | null = null;
    while (railIndex < allowed.length) {
      const r = allowed[railIndex];
      spot = snapForward(cursor, along(r, sizes[i]), free[r]);
      if (spot !== null) break;
      railIndex++;
      cursor = -Infinity;
    }
    if (spot === null) {
      overflow.push({ key: targets[i].key, index: i, reason: "no room" });
      continue;
    }
    const r = allowed[railIndex];
    const s = sizes[i];
    const t = targets[i].box;
    cursor = spot + along(r, s) + g.gap;
    placed.push({
      key: "", index: i, rail: r, number: n + 1,
      label: boxFrom(point(g, r, spot, g.railOffset), point(g, r, spot + along(r, s), g.railOffset + across(r, s))),
      badge: { x: t.x - BADGE_SIZE / 2, y: t.y - BADGE_SIZE / 2, width: BADGE_SIZE, height: BADGE_SIZE },
    });
  }
  return { mode: "numbered", placed, overflow };
}
