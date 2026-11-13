// place_callouts (L2F_CALLOUTS): review callouts in rails beside a frame, not
// diagonal lines across it. The plugin reads absolute boxes, creates and
// measures the labels, hands plain values to layoutCallouts (src/shared/callouts.ts)
// and draws the result as one group next to the frame. Each callout is also
// written as a native annotation on its target, so Dev Mode shows it.
// `figma` is a global provided by the Figma plugin runtime.

import { calloutMode, DEFAULTS, layoutCallouts, readingOrder, type Box, type CalloutLayout, type Point, type Rail } from "../../shared/callouts";
import { boxOverflow, toBox } from "../../shared/verify";
import { loadFontCached } from "./utils";

export const GROUP_DATA = "l2f-callouts"; // on the group: {"frameId", "annotated": {key: targetId}, "labels": {key: markdown written}}
export const PART_DATA = "l2f-callout";   // on each part: {"key", "part", "targetId", "frameId"}; rails and the archive carry part only

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
// The prefix alone is not proof of ownership: the group's plugin data records
// which key was annotated on which target, and only a recorded (key, target)
// pair is ever updated or removed. Anything else that looks like a callout is
// left alone.

const OWN_ANNOTATION = /^\**Callout (.+?):\**\s/;

export function annotationMarkdown(key: string, text: string): string {
  return `**Callout ${key}:** ${text}`;
}

export function annotationKey(a: any): string | null {
  const s = (a && (a.labelMarkdown || a.label)) || "";
  const m = OWN_ANNOTATION.exec(s);
  return m ? m[1] : null;
}

// Which of a node's annotations this tool wrote for `key`: the one whose markdown
// is exactly what was written last time, else the last one with the key's prefix
// (the tool appends, so its own comes after any look-alike that was there first).
function ownIndex(list: any[], key: string, written?: string): number {
  if (written) {
    const exact = list.findIndex(a => a.labelMarkdown === written);
    if (exact >= 0) return exact;
  }
  for (let i = list.length - 1; i >= 0; i--) if (annotationKey(list[i]) === key) return i;
  return -1;
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

// Appends this tool's annotation for `key`, or, when `owned` (the key is recorded
// for this node), updates the existing one in place; every other annotation on
// the node is written back unchanged.
export function upsertAnnotation(node: any, key: string, text: string, owned = true, written?: string): "added" | "updated" | "unchanged" {
  const labelMarkdown = annotationMarkdown(key, text);
  const current: any[] = Array.from(node.annotations || []);
  const at = owned ? ownIndex(current, key, written) : -1;
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

function groupData(node: any): { frameId?: string; annotated?: Record<string, string>; labels?: Record<string, string> } | null {
  if (!node || typeof node.getPluginData !== "function") return null;
  const raw = node.getPluginData(GROUP_DATA);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function groupFrameId(node: any): string | null {
  const d = groupData(node);
  return d && d.frameId ? d.frameId : null;
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

function createConnectorLeader(template: any, key: string, labelId: string, rail: Rail, targetId: string, parent: any, born: Born): any {
  const c = template.clone();
  born(c);
  parent.appendChild(c);
  wireConnector(c, key, labelId, rail, targetId);
  return c;
}

// --- Builders ---------------------------------------------------------------

// Every builder hands a node to `born` the moment it exists, so it is tagged with
// plugin data and recorded for rollback before anything else can throw.
type Born = (node: any) => void;

async function createLabel(key: string, text: string, width: number, parent: any, born: Born): Promise<any> {
  await loadFontCached(REGULAR);
  const label = figma.createFrame();
  born(label);
  parent.appendChild(label);
  label.visible = false;
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
  label.appendChild(t);
  t.name = `callout/${key}/text`;
  t.fontName = REGULAR;
  t.fontSize = 12;
  t.lineHeight = { value: 16, unit: "PIXELS" };
  t.fills = [{ type: "SOLID", color: LABEL_TEXT }];
  t.characters = text;
  t.layoutSizingHorizontal = "FILL";
  t.textAutoResize = "HEIGHT";
  return label;
}

function createRail(rail: Rail, box: Box, parent: any, born: Born): any {
  const f = figma.createFrame();
  born(f);
  f.name = `rail/${rail}`;
  f.fills = [];
  f.clipsContent = false;
  // Not auto layout: a label's position along the rail is what lines it up with its target.
  f.resize(Math.max(1, box.width), Math.max(1, box.height));
  parent.appendChild(f);
  placeAt(f, parent, box.x, box.y);
  return f;
}

function setLeaderPath(v: any, points: Point[]) {
  const minX = Math.min(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y));
  const data = points.map((p, i) => `${i ? "L" : "M"} ${p.x - minX} ${p.y - minY}`).join(" ");
  // vectorPaths resets x/y, so it is set first.
  v.vectorPaths = [{ windingRule: "NONE", data }];
  placeAt(v, v.parent, minX, minY);
}

function createLeader(key: string, points: Point[], parent: any, born: Born): any {
  const v = figma.createVector();
  born(v);
  v.name = `leader/${key}`;
  v.fills = [];
  v.strokes = [{ type: "SOLID", color: ACCENT }];
  v.strokeWeight = 1;
  v.strokeCap = "ROUND";
  v.strokeJoin = "ROUND";
  parent.appendChild(v);
  setLeaderPath(v, points);
  return v;
}

function createDot(key: string, at: Point, parent: any, born: Born): any {
  const d = figma.createEllipse();
  born(d);
  d.name = `dot/${key}`;
  d.resize(DOT, DOT);
  d.fills = [{ type: "SOLID", color: ACCENT }];
  parent.appendChild(d);
  placeAt(d, parent, at.x - DOT / 2, at.y - DOT / 2);
  return d;
}

async function createBadge(n: number, box: Box, parent: any, born: Born): Promise<any> {
  await loadFontCached(BOLD);
  const b = figma.createFrame();
  born(b);
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
  b.appendChild(t);
  t.name = `badge/${n}/number`;
  t.fontName = BOLD;
  t.fontSize = 11;
  t.fills = [{ type: "SOLID", color: LABEL_FILL }];
  t.characters = String(n);
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

// --- Re-runs ------------------------------------------------------------------
// A re-run finds the frame's group by plugin data and matches callouts by key:
// existing parts are updated in place, and parts of callouts no longer in the
// input are renamed "(superseded)", hidden and moved to the archive group.
// Nothing is deleted.

type Parts = { label?: any; leader?: any; dot?: any; badge?: any; targetId?: string };
interface Existing { group: any; parts: Map<string, Parts>; rails: Partial<Record<Rail, any>>; archive: any | null }

function partOf(node: any): { key?: string; part?: string; targetId?: string; rail?: Rail; frameId?: string } | null {
  if (!node || typeof node.getPluginData !== "function") return null;
  const raw = node.getPluginData(PART_DATA);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function readExisting(group: any, parent: any, frameId: string): Existing {
  const ex: Existing = { group, parts: new Map(), rails: {}, archive: null };
  const add = (node: any) => {
    const d = partOf(node);
    if (!d || !d.key || !["label", "leader", "dot", "badge"].includes(d.part!)) return;
    const entry = ex.parts.get(d.key) ?? {};
    if (!entry[d.part as keyof Parts]) (entry as any)[d.part!] = node;
    entry.targetId = entry.targetId ?? d.targetId;
    ex.parts.set(d.key, entry);
  };
  for (const c of group.children) {
    const d = partOf(c);
    if (d && d.part === "archive") { ex.archive = c; continue; }
    if (d && d.part === "rail" && d.rail) {
      ex.rails[d.rail] = c;
      for (const label of c.children) add(label);
      continue;
    }
    add(c);
  }
  // Connectors Figma kept out of the group sit beside it.
  for (const c of parent.children) {
    const d = partOf(c);
    if (d && d.frameId === frameId && c !== group) add(c);
  }
  return ex;
}

// Re-parent without moving on the canvas.
function moveInto(container: any, node: any) {
  const t = node.absoluteTransform;
  const x = t[0][2], y = t[1][2];
  container.appendChild(node);
  placeAt(node, container, x, y);
}

function removeOwnAnnotation(node: any, key: string, written?: string): boolean {
  if (!node || !("annotations" in node)) return false;
  const current: any[] = Array.from(node.annotations || []);
  const at = ownIndex(current, key, written);
  if (at < 0) return false;
  node.annotations = current.filter((_, i) => i !== at).map(copyAnnotation);
  return true;
}

async function setText(textNode: any, text: string, fallbackFont: FontName) {
  if (!textNode) return;
  const font = textNode.fontName && typeof textNode.fontName === "object" && "family" in textNode.fontName ? textNode.fontName : fallbackFont;
  await loadFontCached(font);
  textNode.fontName = font;
  textNode.characters = text;
}

const textChild = (node: any) => (node.children || []).find((c: any) => c.type === "TEXT");

// --- Rollback -----------------------------------------------------------------
// A run either finishes or leaves the canvas as it found it. Existing nodes are
// snapshotted before their first change and restored on a throw; nodes this run
// created (new and unreviewed) are removed.

interface Snapshot {
  parent: any; index: number; x: number; y: number; name: string; visible: boolean;
  width?: number; height?: number; text?: { node: any; characters: string; name: string };
  vectorPaths?: any; connectorStart?: any; connectorEnd?: any; pluginData?: string;
}

function snapshot(n: any): Snapshot {
  const p = n.parent;
  const s: Snapshot = { parent: p, index: p ? p.children.indexOf(n) : -1, x: n.x, y: n.y, name: n.name, visible: n.visible };
  if (n.type === "FRAME") { s.width = n.width; s.height = n.height; }
  const t = textChild(n);
  if (t) s.text = { node: t, characters: t.characters, name: t.name };
  if (n.type === "VECTOR") s.vectorPaths = n.vectorPaths;
  if (n.type === "CONNECTOR") { s.connectorStart = n.connectorStart; s.connectorEnd = n.connectorEnd; }
  if (typeof n.getPluginData === "function") s.pluginData = n.getPluginData(PART_DATA) || n.getPluginData(GROUP_DATA);
  return s;
}

function restore(n: any, s: Snapshot) {
  if (s.parent && n.parent !== s.parent) s.parent.appendChild(n);
  if (s.vectorPaths !== undefined) n.vectorPaths = s.vectorPaths;
  if (s.width !== undefined && Math.abs(n.width - s.width) > 0.01) {
    const hug = n.layoutMode && n.layoutMode !== "NONE" && n.primaryAxisSizingMode === "AUTO";
    n.resize(s.width, hug ? n.height : s.height);
    if (hug) n.primaryAxisSizingMode = "AUTO";
  } else if (s.height !== undefined && n.layoutMode === "NONE" && Math.abs(n.height - s.height) > 0.01) {
    n.resize(n.width, s.height);
  }
  n.x = s.x;
  n.y = s.y;
  n.name = s.name;
  n.visible = s.visible;
  if (s.text) { s.text.node.characters = s.text.characters; s.text.node.name = s.text.name; }
  if (s.connectorStart !== undefined) { n.connectorStart = s.connectorStart; n.connectorEnd = s.connectorEnd; }
}

// Is `node` inside an instance (below the frame)? Connectors and annotations
// cannot be attached reliably to instance sublayers.
function inInstance(node: any, frame: any): boolean {
  if (typeof node.id === "string" && node.id.includes(";")) return true;
  for (let n = node.parent; n && n !== frame; n = n.parent) if (n.type === "INSTANCE") return true;
  return false;
}

function intersect(a: Box, b: Box): Box | null {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.width, b.x + b.width), btm = Math.min(a.y + a.height, b.y + b.height);
  return r > x && btm > y ? { x, y, width: r - x, height: btm - y } : null;
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
  const warnings: string[] = [];
  if (typeof frame.rotation === "number" && Math.abs(frame.rotation) > 0.01) {
    warnings.push(`frame ${frame.id} is rotated ${frame.rotation}°: rails are laid out on its bounding box, not along its sides`);
  }
  const existingGroup = parent.children.find((c: any) => groupFrameId(c) === frame.id) ?? null;
  const ex: Existing | null = existingGroup ? readExisting(existingGroup, parent, frame.id) : null;
  const old = (key: string): Parts => (ex && ex.parts.get(key)) || {};
  const recorded: Record<string, string> = { ...((existingGroup && groupData(existingGroup)?.annotated) || {}) };
  const recordedLabels: Record<string, string> = { ...((existingGroup && groupData(existingGroup)?.labels) || {}) };

  // Targets: must exist and sit inside the frame, visibly. Targets inside an
  // instance are refused before anything changes.
  const resolved: Resolved[] = [];
  const unresolved: Array<{ key: string; reason: string }> = [];
  for (let i = 0; i < params.callouts.length; i++) {
    const c = params.callouts[i];
    const key = c.key ?? c.targetId;
    const node: any = await figma.getNodeByIdAsync(c.targetId);
    const box = node ? boxOf(node) : null;
    if (!node) unresolved.push({ key, reason: "target not found" });
    else if (!isInside(node, frame)) unresolved.push({ key, reason: "target not in frame" });
    else if (inInstance(node, frame)) {
      throw new Error(`callout ${key}: target ${c.targetId} is inside an instance; point the callout at the instance itself (or detach it)`);
    } else if (!box) unresolved.push({ key, reason: "target has no bounding box" });
    else {
      const visible = intersect(box, frameBox);
      if (!visible) unresolved.push({ key, reason: "target outside frame" });
      else resolved.push({ index: i, key, targetId: c.targetId, text: c.text, node, box: visible });
    }
  }

  // Obstacles: the frame's visible siblings except this frame's own callouts,
  // and everything outside its section, so the section never has to grow.
  const obstacles: Box[] = [];
  for (const sibling of parent.children) {
    if (sibling === frame || sibling.visible === false || groupFrameId(sibling) === frame.id) continue;
    const d = partOf(sibling);
    if (d && d.frameId === frame.id) continue;
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

  const mode = calloutMode(resolved.length, denseThreshold);
  // Numbered mode has no leaders, so it needs no connector template.
  const leaders = mode === "leaders" ? await resolveLeaderStyle(params.leaderStyle) : { style: "vector" as const, template: null };

  // Everything from here changes the canvas, so it runs under rollback.
  const created: any[] = [];
  const journal = new Map<any, Snapshot>();
  const touch = (n: any) => { if (n && !journal.has(n)) journal.set(n, snapshot(n)); return n; };
  const partData = (key: string, part: string, targetId: string) => JSON.stringify({ key, part, targetId, frameId: frame.id });
  const bornAs = (key: string, part: string, targetId: string): Born => (n: any) => {
    created.push(n);
    n.setPluginData(PART_DATA, partData(key, part, targetId));
  };
  const tagged = (node: any, key: string, part: string, targetId: string) => {
    node.setPluginData(PART_DATA, partData(key, part, targetId));
    return node;
  };

  try {
    // Snapshot every existing part before anything moves, so layer order can be
    // restored exactly (moving one label changes its siblings' indices).
    if (ex) {
      touch(ex.group);
      if (ex.archive) touch(ex.archive);
      for (const rail of Object.values(ex.rails)) touch(rail);
      for (const parts of ex.parts.values()) for (const n of [parts.label, parts.leader, parts.dot, parts.badge]) touch(n);
    }
    // Labels are created (or updated) first so they can be measured; numbered
    // mode needs the numbers in the text before measuring, so they come from the
    // same reading order the layout uses.
    const numberOf = new Map<number, number>();
    if (mode === "numbered") readingOrder(resolved.map(r => r.box)).forEach((ri, n) => numberOf.set(ri, n + 1));
    const labels: any[] = [];
    const reused = new Set<number>();
    for (let ri = 0; ri < resolved.length; ri++) {
      const r = resolved[ri];
      const text = mode === "numbered" ? `${numberOf.get(ri)}. ${r.text}` : r.text;
      const prev = old(r.key).label;
      if (prev) {
        touch(prev);
        prev.name = `callout/${r.key}`;
        await setText(textChild(prev), text, REGULAR);
        if (Math.abs(prev.width - width) > 0.01) {
          prev.resize(width, prev.height);
          prev.primaryAxisSizingMode = "AUTO";
        }
        labels.push(prev);
        reused.add(ri);
      } else {
        labels.push(await createLabel(r.key, text, width, parent, bornAs(r.key, "label", r.targetId)));
      }
    }

    const layout: CalloutLayout = layoutCallouts(
      frameBox,
      resolved.map(r => ({ key: r.key, box: r.box })),
      labels.map(l => ({ width: l.width, height: l.height })),
      obstacles,
      { rails: params.rails, gap: params.gap, railOffset: params.railOffset, width, denseThreshold },
    );

    // Draw, reusing what a previous run made.
    const fresh: any[] = [];       // new nodes for the group
    const freshConnectors: any[] = [];
    const toArchive: any[] = [];
    const supersede = (node: any) => { if (node) toArchive.push(touch(node)); };

    const railNodes: Partial<Record<Rail, any>> = {};
    for (const rail of Object.keys(layout.rails) as Rail[]) {
      const box = layout.rails[rail]!;
      const prev = ex && ex.rails[rail];
      if (prev) {
        touch(prev);
        prev.resize(Math.max(1, box.width), Math.max(1, box.height));
        placeAt(prev, prev.parent, box.x, box.y);
        railNodes[rail] = prev;
      } else {
        const node = createRail(rail, box, parent, (n) => {
          created.push(n);
          n.setPluginData(PART_DATA, JSON.stringify({ part: "rail", rail, frameId: frame.id }));
        });
        railNodes[rail] = node;
        fresh.push(node);
      }
    }

    const placed: any[] = [];
    const placedLabels = new Map<string, any>();
    for (const p of layout.placed) {
      const r = resolved[p.index];
      const prev = old(r.key);
      const label = labels[p.index];
      // The numbers were written before layout; layout numbers placed callouts only.
      if (p.number !== undefined && numberOf.get(p.index) !== p.number) await setText(textChild(label), `${p.number}. ${r.text}`, REGULAR);
      railNodes[p.rail].appendChild(label);
      placeAt(label, railNodes[p.rail], p.label.x, p.label.y);
      label.visible = true;
      tagged(label, r.key, "label", r.targetId);
      placedLabels.set(r.key, label);
      const entry: any = { key: r.key, rail: p.rail, x: p.label.x - frameBox.x, y: p.label.y - frameBox.y, labelId: label.id };
      if (p.leader && leaders.style === "connector") {
        let connector = prev.leader && prev.leader.type === "CONNECTOR" ? touch(prev.leader) : null;
        if (connector) wireConnector(connector, r.key, label.id, p.rail, r.targetId);
        else {
          supersede(prev.leader);
          connector = createConnectorLeader(leaders.template, r.key, label.id, p.rail, r.targetId, parent, bornAs(r.key, "leader", r.targetId));
          freshConnectors.push(connector);
        }
        connector.visible = true;
        tagged(connector, r.key, "leader", r.targetId);
        supersede(prev.dot);
        entry.leaderId = connector.id;
      } else if (p.leader) {
        let leader = prev.leader && prev.leader.type === "VECTOR" ? touch(prev.leader) : null;
        if (leader) setLeaderPath(leader, p.leader);
        else {
          supersede(prev.leader);
          leader = createLeader(r.key, p.leader, parent, bornAs(r.key, "leader", r.targetId));
          fresh.push(leader);
        }
        leader.visible = true;
        tagged(leader, r.key, "leader", r.targetId);
        let dot = touch(prev.dot);
        if (dot) placeAt(dot, dot.parent, p.dot!.x - DOT / 2, p.dot!.y - DOT / 2);
        else { dot = createDot(r.key, p.dot!, parent, bornAs(r.key, "dot", r.targetId)); fresh.push(dot); }
        dot.visible = true;
        tagged(dot, r.key, "dot", r.targetId);
        entry.leaderId = leader.id;
      } else {
        supersede(prev.leader);
        supersede(prev.dot);
      }
      if (p.badge) {
        let badge = touch(prev.badge);
        if (badge) {
          badge.name = `badge/${p.number}`;
          const number = textChild(badge);
          if (number) number.name = `badge/${p.number}/number`;
          await setText(number, String(p.number), BOLD);
          placeAt(badge, badge.parent, p.badge.x, p.badge.y);
        } else {
          badge = await createBadge(p.number!, p.badge, parent, bornAs(r.key, "badge", r.targetId));
          fresh.push(badge);
        }
        badge.visible = true;
        tagged(badge, r.key, "badge", r.targetId);
        entry.number = p.number;
      } else {
        supersede(prev.badge);
      }
      placed.push(entry);
    }

    // No room this time: a new label was only made to be measured and is removed;
    // an existing callout is hidden in place, not superseded (it is still asked for).
    const hidden: string[] = [];
    const hide = (parts: Parts) => { for (const n of [parts.label, parts.leader, parts.dot, parts.badge]) if (n) touch(n).visible = false; };
    for (const o of layout.overflow) {
      const ri = o.index; // layout indices are positions in `resolved`
      if (reused.has(ri)) { hide(old(o.key)); hidden.push(o.key); } else labels[ri].remove();
    }
    for (const u of unresolved) if (ex && ex.parts.has(u.key)) { hide(old(u.key)); hidden.push(u.key); }

    // Callouts dropped from the input.
    const inputKeys = new Set(params.callouts.map(c => c.key ?? c.targetId));
    const superseded: string[] = [];
    if (ex) {
      for (const [key, parts] of ex.parts) {
        if (inputKeys.has(key)) continue;
        for (const n of [parts.label, parts.leader, parts.dot, parts.badge]) supersede(n);
        superseded.push(key);
      }
      // Rails that hold no labels any more.
      for (const rail of Object.keys(ex.rails) as Rail[]) {
        if (!railNodes[rail] && ex.rails[rail].children.every((c: any) => toArchive.includes(c))) supersede(ex.rails[rail]);
      }
    }

    // Group: new parts join the existing group, or form a new one. Connectors go
    // in the group too; whether Figma Design accepts a connector in a group is not
    // documented, so if it refuses they stay beside the group.
    let group: any = existingGroup;
    let connectorsOutsideGroup = false;
    if (group) {
      touch(group);
      for (const n of fresh) moveInto(group, n);
      for (const c of freshConnectors) {
        try { moveInto(group, c); } catch { connectorsOutsideGroup = true; }
      }
      group.name = `callouts/${frame.name}`;
    } else if (fresh.length || freshConnectors.length) {
      try {
        group = figma.group([...fresh, ...freshConnectors], parent);
      } catch (error) {
        if (!freshConnectors.length || !fresh.length) throw error;
        group = figma.group(fresh, parent);
        connectorsOutsideGroup = true;
      }
      created.push(group);
      group.name = `callouts/${frame.name}`;
      group.setPluginData(GROUP_DATA, JSON.stringify({ frameId: frame.id, annotated: {}, labels: {} }));
    }

    // Archive: renamed, hidden, moved aside inside the group. Never deleted. A
    // connector Figma will not move stays beside the group, hidden and renamed.
    const archivedBesideGroup: string[] = [];
    if (group && toArchive.length) {
      const movable: any[] = [];
      for (const n of toArchive) {
        if (!n.name.endsWith(" (superseded)")) n.name = `${n.name} (superseded)`;
        n.visible = false;
        try {
          moveInto(group, n);
          movable.push(n);
        } catch (error) {
          if (n.type !== "CONNECTOR") throw error;
          archivedBesideGroup.push(n.id);
        }
      }
      let archive = ex && ex.archive ? touch(ex.archive) : null;
      if (archive) {
        for (const n of movable) {
          try { moveInto(archive, n); } catch (error) {
            if (n.type !== "CONNECTOR") throw error;
            archivedBesideGroup.push(n.id);
          }
        }
      } else if (movable.length) {
        const plain = movable.filter(n => n.type !== "CONNECTOR");
        try {
          archive = figma.group(movable, group);
        } catch (error) {
          if (plain.length === movable.length || !plain.length) throw error;
          archive = figma.group(plain, group);
          for (const n of movable) if (n.type === "CONNECTOR") archivedBesideGroup.push(n.id);
        }
        created.push(archive);
        archive.setPluginData(PART_DATA, JSON.stringify({ part: "archive", frameId: frame.id }));
      }
      if (archive) {
        archive.name = `callouts/${frame.name}/archive`;
        archive.visible = false;
      }
    }

    // Native annotations for placed callouts only. Recorded (key, target) pairs
    // that no longer apply (dropped, retargeted, overflowed or unresolved) lose
    // this tool's annotation; nothing unrecorded is ever touched.
    const annotations = { added: 0, updated: 0, unchanged: 0, removed: 0, skipped: [] as Array<{ key: string; reason: string }> };
    let annotated = recorded;
    let labelsWritten = recordedLabels;
    if (native) {
      annotated = {};
      labelsWritten = {};
      for (const p of layout.placed) {
        const r = resolved[p.index];
        if (!("annotations" in r.node)) {
          annotations.skipped.push({ key: r.key, reason: `${r.node.type} does not support annotations` });
          continue;
        }
        try {
          const owned = recorded[r.key] === r.targetId;
          annotations[upsertAnnotation(r.node, r.key, r.text, owned, owned ? recordedLabels[r.key] : undefined)]++;
          annotated[r.key] = r.targetId;
          labelsWritten[r.key] = annotationMarkdown(r.key, r.text);
        } catch (error) {
          annotations.skipped.push({ key: r.key, reason: error instanceof Error ? error.message : String(error) });
        }
      }
      for (const [key, targetId] of Object.entries(recorded)) {
        if (annotated[key] === targetId) continue;
        try {
          if (removeOwnAnnotation(await figma.getNodeByIdAsync(targetId), key, recordedLabels[key])) annotations.removed++;
        } catch (error) {
          annotations.skipped.push({ key, reason: error instanceof Error ? error.message : String(error) });
          if (!annotated[key]) { annotated[key] = targetId; labelsWritten[key] = recordedLabels[key]; } // still there: keep it recorded
        }
      }
    }
    if (group) group.setPluginData(GROUP_DATA, JSON.stringify({ frameId: frame.id, annotated, labels: labelsWritten }));

    return {
      groupId: group ? group.id : null,
      mode: layout.mode,
      leaderStyle: layout.mode === "numbered" ? null : leaders.style,
      ...(connectorsOutsideGroup ? { connectorsOutsideGroup } : {}),
      ...(archivedBesideGroup.length ? { archivedBesideGroup } : {}),
      placed,
      overflow: [...unresolved, ...layout.overflow.map(o => ({ key: o.key, reason: o.reason }))],
      rerun: ex ? { updated: placed.filter(p => old(p.key).label).length, hidden, superseded } : null,
      annotations: native ? annotations : null,
      warnings,
      verification: verify(layout, railNodes, placedLabels, frameBox, obstacles, group, sectionBox),
    };
  } catch (error) {
    const left: string[] = [];
    for (const [node, snap] of Array.from(journal.entries()).reverse()) {
      try { restore(node, snap); } catch (e) { left.push(`${node.id} (${snap.name}) not restored: ${e instanceof Error ? e.message : String(e)}`); }
    }
    let removed = 0;
    for (const node of created.slice().reverse()) {
      if (node.removed) continue;
      try { node.remove(); removed++; } catch (e) { left.push(`${node.id} (${node.name}) not removed: ${e instanceof Error ? e.message : String(e)}`); }
    }
    // Layer order last, once the new layers are gone: lowest original index first.
    for (const [node, snap] of Array.from(journal.entries()).sort((a, b) => a[1].index - b[1].index)) {
      try {
        if (snap.parent && typeof snap.parent.insertChild === "function" && snap.parent.children.indexOf(node) !== snap.index) {
          snap.parent.insertChild(Math.min(Math.max(0, snap.index), snap.parent.children.length - 1), node);
        }
      } catch { /* order only; position and parent are already restored */ }
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message} (rolled back: removed ${removed} new layer${removed === 1 ? "" : "s"}, restored ${journal.size - left.filter(l => l.includes("not restored")).length}${left.length ? `; left behind: ${left.join("; ")}` : ""})`);
  }
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
