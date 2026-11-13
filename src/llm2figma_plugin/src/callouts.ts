// place_callouts (L2F_CALLOUTS): review callouts in rails beside a frame, not
// diagonal lines across it. The plugin reads absolute boxes, creates and
// measures the labels, hands plain values to layoutCallouts (src/shared/callouts.ts)
// and draws the result as one group next to the frame. Each callout is also
// written as a native annotation on its target, so Dev Mode shows it.
// `figma` is a global provided by the Figma plugin runtime.

import { calloutMode, DEFAULTS, layoutCallouts, readingOrder, type Box, type CalloutLayout, type Point, type Rail } from "../../shared/callouts";
import { boxOverflow, toBox } from "../../shared/verify";
import { loadFontCached } from "./utils";

export const GROUP_DATA = "l2f-callouts"; // on the group: {"frameId": "..."}
export const PART_DATA = "l2f-callout";   // on each part: {"key", "part", "targetId"}

const ACCENT = { r: 0.478, g: 0.353, b: 0.973 };      // #7A5AF8
const LABEL_FILL = { r: 1, g: 1, b: 1 };
const LABEL_STROKE = { r: 0.816, g: 0.835, b: 0.867 }; // #D0D5DD
const LABEL_TEXT = { r: 0.114, g: 0.161, b: 0.224 };   // #1D2939
const REGULAR = { family: "Inter", style: "Regular" };
const BOLD = { family: "Inter", style: "Bold" };
const DOT = 6;
// Far enough that "outside the section" covers any canvas a design uses.
const FAR = 100000;

export interface CalloutInput { key?: string; targetId: string; text: string }
export interface PlaceCalloutsParams {
  frameId: string;
  callouts: CalloutInput[];
  rails?: Rail[];
  gap?: number;
  railOffset?: number;
  width?: number;
  denseThreshold?: number;
  native?: boolean;
  leaderStyle?: LeaderStyle;
}

export type LeaderStyle = "auto" | "connector" | "vector";

export const NO_CONNECTOR_TEMPLATE =
  'leaderStyle "connector" needs a connector to clone, and Figma Design cannot create one (figma.createConnector works only in FigJam). ' +
  "Paste any FigJam connector into this file once, select it and call set_default_connector, then run place_callouts again.";

// --- Native annotations ---------------------------------------------------
// Figma's Annotation has no id and no plugin data (label, labelMarkdown,
// properties, categoryId only), so this tool marks its own with a label prefix
// that carries the key: "**Callout <key>:** <text>". Matching accepts the prefix
// with or without the bold markers, in case Figma returns `label` in plain text.

const OWN_ANNOTATION = /^\**Callout (.+?):\**\s/;

export function annotationMarkdown(key: string, text: string): string {
  return `**Callout ${key}:** ${text}`;
}

export function annotationKey(a: any): string | null {
  const s = (a && (a.labelMarkdown || a.label)) || "";
  const m = OWN_ANNOTATION.exec(s);
  return m ? m[1] : null;
}

// A writable copy of an existing annotation: Figma refuses label and
// labelMarkdown together, so keep the markdown when there is one.
function copyAnnotation(a: any): any {
  const out: any = {};
  if (a.labelMarkdown) out.labelMarkdown = a.labelMarkdown;
  else if (a.label) out.label = a.label;
  if (a.properties && a.properties.length) out.properties = a.properties.map((p: any) => ({ type: p.type }));
  if (a.categoryId) out.categoryId = a.categoryId;
  return out;
}

// Appends this tool's annotation for `key`, or updates it in place; every other
// annotation on the node is written back unchanged.
export function upsertAnnotation(node: any, key: string, text: string): "added" | "updated" | "unchanged" {
  const labelMarkdown = annotationMarkdown(key, text);
  const current: any[] = Array.from(node.annotations || []);
  const at = current.findIndex(a => annotationKey(a) === key);
  if (at >= 0 && current[at].labelMarkdown === labelMarkdown) return "unchanged";
  const next = current.map(copyAnnotation);
  if (at >= 0) next[at] = { ...next[at], label: undefined, labelMarkdown };
  else next.push({ labelMarkdown });
  for (const a of next) if (a.label === undefined) delete a.label;
  node.annotations = next;
  return at >= 0 ? "updated" : "added";
}

// --- Geometry helpers -------------------------------------------------------

// The absolute origin that a child's x/y are relative to. Group children are
// positioned relative to the group's own parent, so walk past groups.
function originOf(container: any): Point {
  let c = container;
  while (c && (c.type === "GROUP" || c.type === "BOOLEAN_OPERATION")) c = c.parent;
  if (!c || c.type === "PAGE" || c.type === "DOCUMENT") return { x: 0, y: 0 };
  const t = c.absoluteTransform;
  return { x: t[0][2], y: t[1][2] };
}

// Place a node at an absolute position inside `container`. Section children are
// relative to the section, so this subtracts the section's origin; never sec.x + offset.
function placeAt(node: any, container: any, x: number, y: number) {
  const o = originOf(container);
  node.x = x - o.x;
  node.y = y - o.y;
}

function boxOf(node: any): Box | null {
  return "absoluteBoundingBox" in node ? toBox(node.absoluteBoundingBox) : null;
}

function isInside(node: any, ancestor: any): boolean {
  for (let n = node; n; n = n.parent) if (n === ancestor) return true;
  return false;
}

function groupFrameId(node: any): string | null {
  if (!node || typeof node.getPluginData !== "function") return null;
  const raw = node.getPluginData(GROUP_DATA);
  if (!raw) return null;
  try { return JSON.parse(raw).frameId ?? null; } catch { return null; }
}

function tag(node: any, key: string, part: string, targetId: string) {
  node.setPluginData(PART_DATA, JSON.stringify({ key, part, targetId }));
}

// --- Connector leaders -------------------------------------------------------
// Figma Design has no createConnector, but a CONNECTOR already in the file can be
// cloned. The template is the default connector (set_default_connector) or, failing
// that, any connector on the current page.

async function findConnectorTemplate(): Promise<any | null> {
  const id = await figma.clientStorage.getAsync("defaultConnectorId");
  if (id) {
    const node: any = await figma.getNodeByIdAsync(id);
    if (node && node.type === "CONNECTOR") return node;
  }
  const page: any = figma.currentPage;
  if (typeof page.findAllWithCriteria === "function") return page.findAllWithCriteria({ types: ["CONNECTOR"] })[0] ?? null;
  return page.findOne((n: any) => n.type === "CONNECTOR");
}

export async function resolveLeaderStyle(style: LeaderStyle = "auto"): Promise<{ style: "connector" | "vector"; template: any | null }> {
  if (style === "vector") return { style: "vector", template: null };
  const template = await findConnectorTemplate();
  if (template) return { style: "connector", template };
  if (style === "connector") throw new Error(NO_CONNECTOR_TEMPLATE);
  return { style: "vector", template: null };
}

// The label side that faces the frame.
export const FACING_MAGNET: Record<Rail, "LEFT" | "RIGHT" | "TOP" | "BOTTOM"> = { left: "RIGHT", right: "LEFT", top: "BOTTOM", bottom: "TOP" };

function wireConnector(c: any, key: string, labelId: string, rail: Rail, targetId: string) {
  c.name = `leader/${key}`;
  c.connectorStart = { endpointNodeId: labelId, magnet: FACING_MAGNET[rail] };
  c.connectorEnd = { endpointNodeId: targetId, magnet: "AUTO" };
  c.connectorLineType = "ELBOWED";
  c.connectorStartStrokeCap = "NONE";
  c.connectorEndStrokeCap = "CIRCLE_FILLED";
  c.strokes = [{ type: "SOLID", color: ACCENT }];
}

function createConnectorLeader(template: any, key: string, labelId: string, rail: Rail, targetId: string, parent: any): any {
  const c = template.clone();
  parent.appendChild(c);
  wireConnector(c, key, labelId, rail, targetId);
  return c;
}

// --- Builders ---------------------------------------------------------------

async function createLabel(key: string, text: string, width: number): Promise<any> {
  await loadFontCached(REGULAR);
  const label = figma.createFrame();
  label.name = `callout/${key}`;
  label.layoutMode = "VERTICAL";
  label.resize(width, 32);
  label.counterAxisSizingMode = "FIXED";
  label.primaryAxisSizingMode = "AUTO";
  label.paddingLeft = label.paddingRight = 10;
  label.paddingTop = label.paddingBottom = 6;
  label.fills = [{ type: "SOLID", color: LABEL_FILL }];
  label.strokes = [{ type: "SOLID", color: LABEL_STROKE }];
  label.strokeWeight = 1;
  label.strokeAlign = "INSIDE";
  label.cornerRadius = 6;
  label.clipsContent = false;
  const t = figma.createText();
  t.name = `callout/${key}/text`;
  t.fontName = REGULAR;
  t.fontSize = 12;
  t.lineHeight = { value: 16, unit: "PIXELS" };
  t.fills = [{ type: "SOLID", color: LABEL_TEXT }];
  t.characters = text;
  label.appendChild(t);
  t.layoutSizingHorizontal = "FILL";
  t.textAutoResize = "HEIGHT";
  return label;
}

function createRail(rail: Rail, box: Box, parent: any): any {
  const f = figma.createFrame();
  f.name = `rail/${rail}`;
  f.fills = [];
  f.clipsContent = false;
  // Not auto layout: a label's position along the rail is what lines it up with its target.
  f.resize(Math.max(1, box.width), Math.max(1, box.height));
  parent.appendChild(f);
  placeAt(f, parent, box.x, box.y);
  return f;
}

function createLeader(key: string, points: Point[], parent: any): any {
  const v = figma.createVector();
  v.name = `leader/${key}`;
  const minX = Math.min(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y));
  const data = points.map((p, i) => `${i ? "L" : "M"} ${p.x - minX} ${p.y - minY}`).join(" ");
  // vectorPaths resets x/y, so it is set first.
  v.vectorPaths = [{ windingRule: "NONE", data }];
  v.fills = [];
  v.strokes = [{ type: "SOLID", color: ACCENT }];
  v.strokeWeight = 1;
  v.strokeCap = "ROUND";
  v.strokeJoin = "ROUND";
  parent.appendChild(v);
  placeAt(v, parent, minX, minY);
  return v;
}

function createDot(key: string, at: Point, parent: any): any {
  const d = figma.createEllipse();
  d.name = `dot/${key}`;
  d.resize(DOT, DOT);
  d.fills = [{ type: "SOLID", color: ACCENT }];
  parent.appendChild(d);
  placeAt(d, parent, at.x - DOT / 2, at.y - DOT / 2);
  return d;
}

async function createBadge(n: number, box: Box, parent: any): Promise<any> {
  await loadFontCached(BOLD);
  const b = figma.createFrame();
  b.name = `badge/${n}`;
  b.layoutMode = "HORIZONTAL";
  b.primaryAxisAlignItems = "CENTER";
  b.counterAxisAlignItems = "CENTER";
  b.resize(box.width, box.height);
  b.primaryAxisSizingMode = "FIXED";
  b.counterAxisSizingMode = "FIXED";
  b.cornerRadius = box.width / 2;
  b.fills = [{ type: "SOLID", color: ACCENT }];
  const t = figma.createText();
  t.name = `badge/${n}/number`;
  t.fontName = BOLD;
  t.fontSize = 11;
  t.fills = [{ type: "SOLID", color: LABEL_FILL }];
  t.characters = String(n);
  b.appendChild(t);
  parent.appendChild(b);
  placeAt(b, parent, box.x, box.y);
  return b;
}

// --- The command --------------------------------------------------------------

interface Resolved { index: number; key: string; targetId: string; text: string; node: any; box: Box }

function validateParams(params: PlaceCalloutsParams) {
  if (!params || typeof params.frameId !== "string" || !params.frameId) throw new Error("Missing required parameter: frameId");
  if (!Array.isArray(params.callouts) || !params.callouts.length) throw new Error("callouts must be a non-empty array");
  const keys = new Set<string>();
  for (const c of params.callouts) {
    if (!c || typeof c.targetId !== "string" || !c.targetId || typeof c.text !== "string" || !c.text) {
      throw new Error("each callout needs a targetId and a text");
    }
    const key = c.key ?? c.targetId;
    if (keys.has(key)) throw new Error(`duplicate callout key: ${key} (give callouts on the same target distinct keys)`);
    keys.add(key);
  }
}

export async function placeCallouts(params: PlaceCalloutsParams): Promise<any> {
  validateParams(params);
  const width = params.width ?? DEFAULTS.width;
  const denseThreshold = params.denseThreshold ?? DEFAULTS.denseThreshold;
  const native = params.native !== false;

  const frame: any = await figma.getNodeByIdAsync(params.frameId);
  if (!frame) throw new Error(`Node not found: ${params.frameId}`);
  const frameBox = boxOf(frame);
  if (!frameBox) throw new Error(`${frame.type} ${frame.id} has no bounding box`);
  const parent = frame.parent;
  if (!parent || (parent.type !== "SECTION" && parent.type !== "PAGE")) {
    throw new Error(`place_callouts needs a frame placed directly on a page or in a section (${frame.id} is inside ${parent ? parent.type : "nothing"})`);
  }
  const existing = parent.children.find((c: any) => groupFrameId(c) === frame.id);
  if (existing) {
    throw new Error(`callouts already placed for ${frame.id} (${existing.id}); updating them in place is not supported yet`);
  }

  // Targets: must exist and sit inside the frame.
  const resolved: Resolved[] = [];
  const unresolved: Array<{ key: string; reason: string }> = [];
  for (let i = 0; i < params.callouts.length; i++) {
    const c = params.callouts[i];
    const key = c.key ?? c.targetId;
    const node: any = await figma.getNodeByIdAsync(c.targetId);
    const box = node ? boxOf(node) : null;
    if (!node) unresolved.push({ key, reason: "target not found" });
    else if (!isInside(node, frame)) unresolved.push({ key, reason: "target not in frame" });
    else if (!box) unresolved.push({ key, reason: "target has no bounding box" });
    else resolved.push({ index: i, key, targetId: c.targetId, text: c.text, node, box });
  }

  // Obstacles: the frame's visible siblings, and everything outside its section,
  // so the section never has to grow around the callouts.
  const obstacles: Box[] = [];
  for (const sibling of parent.children) {
    if (sibling === frame || sibling.visible === false || groupFrameId(sibling) === frame.id) continue;
    const b = boxOf(sibling);
    if (b) obstacles.push(b);
  }
  const sectionBox = parent.type === "SECTION" ? boxOf(parent) : null;
  if (sectionBox) {
    const s = sectionBox;
    obstacles.push(
      { x: s.x - FAR, y: s.y - FAR, width: FAR, height: s.height + 2 * FAR },
      { x: s.x + s.width, y: s.y - FAR, width: FAR, height: s.height + 2 * FAR },
      { x: s.x - FAR, y: s.y - FAR, width: s.width + 2 * FAR, height: FAR },
      { x: s.x - FAR, y: s.y + s.height, width: s.width + 2 * FAR, height: FAR },
    );
  }

  // Labels are created first so they can be measured; numbered mode needs the
  // numbers in the text before measuring, so they come from the same reading
  // order the layout uses.
  const mode = calloutMode(resolved.length, denseThreshold);
  // Numbered mode has no leaders, so it needs no connector template.
  const leaders = mode === "leaders" ? await resolveLeaderStyle(params.leaderStyle) : { style: "vector" as const, template: null };
  const numberOf = new Map<number, number>();
  if (mode === "numbered") readingOrder(resolved.map(r => r.box)).forEach((ri, n) => numberOf.set(ri, n + 1));
  const labels: any[] = [];
  for (let ri = 0; ri < resolved.length; ri++) {
    const r = resolved[ri];
    const text = mode === "numbered" ? `${numberOf.get(ri)}. ${r.text}` : r.text;
    const label = await createLabel(r.key, text, width);
    parent.appendChild(label);
    label.visible = false;
    labels.push(label);
  }

  const layout: CalloutLayout = layoutCallouts(
    frameBox,
    resolved.map(r => ({ key: r.key, box: r.box })),
    labels.map(l => ({ width: l.width, height: l.height })),
    obstacles,
    { rails: params.rails, gap: params.gap, railOffset: params.railOffset, width, denseThreshold },
  );

  // Draw.
  const parts: any[] = [];
  const railNodes: Partial<Record<Rail, any>> = {};
  for (const rail of Object.keys(layout.rails) as Rail[]) {
    railNodes[rail] = createRail(rail, layout.rails[rail]!, parent);
    parts.push(railNodes[rail]);
  }
  const placed: any[] = [];
  const connectors: any[] = [];
  const placedLabels = new Map<string, any>();
  for (const p of layout.placed) {
    const r = resolved[p.index];
    const label = labels[p.index];
    railNodes[p.rail].appendChild(label);
    placeAt(label, railNodes[p.rail], p.label.x, p.label.y);
    label.visible = true;
    tag(label, r.key, "label", r.targetId);
    placedLabels.set(r.key, label);
    const entry: any = { key: r.key, rail: p.rail, x: p.label.x - frameBox.x, y: p.label.y - frameBox.y, labelId: label.id };
    if (p.leader && leaders.style === "connector") {
      const connector = createConnectorLeader(leaders.template, r.key, label.id, p.rail, r.targetId, parent);
      tag(connector, r.key, "leader", r.targetId);
      connectors.push(connector);
      entry.leaderId = connector.id;
    } else if (p.leader) {
      const leader = createLeader(r.key, p.leader, parent);
      tag(leader, r.key, "leader", r.targetId);
      const dot = createDot(r.key, p.dot!, parent);
      tag(dot, r.key, "dot", r.targetId);
      parts.push(leader, dot);
      entry.leaderId = leader.id;
    }
    if (p.badge) {
      const badge = await createBadge(p.number!, p.badge, parent);
      tag(badge, r.key, "badge", r.targetId);
      parts.push(badge);
      entry.number = p.number;
    }
    placed.push(entry);
  }
  // Labels with no room were only made to be measured; nothing else refers to them.
  for (const o of layout.overflow) labels[o.index].remove();

  // Connectors go in the group too. Whether Figma Design accepts a connector in
  // a group is not documented; if it refuses, they stay beside the group.
  let group: any = null;
  let connectorsOutsideGroup = false;
  if (parts.length || connectors.length) {
    try {
      group = figma.group([...parts, ...connectors], parent);
    } catch (error) {
      if (!connectors.length || !parts.length) throw error;
      group = figma.group(parts, parent);
      connectorsOutsideGroup = true;
    }
    group.name = `callouts/${frame.name}`;
    group.setPluginData(GROUP_DATA, JSON.stringify({ frameId: frame.id }));
  }

  // Native annotations, overflowed callouts included: Dev Mode still shows them.
  const annotations = { added: 0, updated: 0, unchanged: 0, skipped: [] as Array<{ key: string; reason: string }> };
  if (native) {
    for (const r of resolved) {
      if (!("annotations" in r.node)) {
        annotations.skipped.push({ key: r.key, reason: `${r.node.type} does not support annotations` });
        continue;
      }
      try {
        annotations[upsertAnnotation(r.node, r.key, r.text)]++;
      } catch (error) {
        annotations.skipped.push({ key: r.key, reason: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  return {
    groupId: group ? group.id : null,
    mode: layout.mode,
    leaderStyle: layout.mode === "numbered" ? null : leaders.style,
    ...(connectorsOutsideGroup ? { connectorsOutsideGroup } : {}),
    placed,
    overflow: [...unresolved, ...layout.overflow.map(o => ({ key: o.key, reason: o.reason }))],
    annotations: native ? annotations : null,
    verification: verify(layout, railNodes, placedLabels, frameBox, obstacles, group, sectionBox),
  };
}

// Read every placed box back from Figma (absoluteBoundingBox) and check it is
// where the layout put it: labels in their rail, off the frame and obstacles,
// the group within its section.
function verify(
  layout: CalloutLayout, railNodes: Partial<Record<Rail, any>>, labels: Map<string, any>,
  frameBox: Box, obstacles: Box[], group: any, sectionBox: Box | null,
) {
  const problems: string[] = [];
  const overlaps = (a: Box, b: Box) => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
  for (const p of layout.placed) {
    const label = labels.get(p.key);
    const actual = label ? boxOf(label) : null;
    const rail = railNodes[p.rail] ? boxOf(railNodes[p.rail]) : null;
    if (!actual || !rail) { problems.push(`${p.key}: label not measurable`); continue; }
    if (Math.abs(actual.x - p.label.x) > 0.5 || Math.abs(actual.y - p.label.y) > 0.5) {
      problems.push(`${p.key}: label at ${actual.x},${actual.y}, planned ${p.label.x},${p.label.y}`);
    }
    if (boxOverflow(rail, actual)) problems.push(`${p.key}: label outside rail/${p.rail}`);
    if (overlaps(actual, frameBox)) problems.push(`${p.key}: label overlaps the frame`);
    if (obstacles.some(o => overlaps(actual, o))) problems.push(`${p.key}: label overlaps a sibling or leaves the section`);
  }
  const groupBox = group ? boxOf(group) : null;
  if (groupBox && sectionBox && boxOverflow(sectionBox, groupBox)) problems.push("callout group is not contained in its section");
  return { ok: problems.length === 0, problems };
}
