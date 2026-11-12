// Spec sync (L2F_SPEC_SYNC): the one normaliser, bundled into both the server
// and the plugin. A Spec node uses create_node_tree's property vocabulary (text
// content is `text`, colours are `fillColor` / `strokeColor` / `fontColor`), so a
// later apply can write it back through updateNodeProperties.
//
// normalizeNode turns a node's properties, read from Figma or written in a Spec
// file, into one canonical form: numbers rounded to 2 decimals, colours as
// upper-case hex or `$var:` references, layout-derived values left out, and
// values equal to SPEC_DEFAULTS left out. Both sides go through it, so raw
// floats and spelling differences never reach a comparison. The plugin leaves
// out what it cannot read faithfully (figma.mixed values, multi-paint lists,
// ambiguous variables...) before calling it; see src/llm2figma_plugin/src/spec.ts.

export const SPEC_VERSION = 1;
export const SPEC_LOCK_VERSION = 1;

export type SpecType = "frame" | "text" | "rectangle" | "vector" | "instance";
export const SPEC_TYPES: readonly SpecType[] = ["frame", "text", "rectangle", "vector", "instance"];

// A node the format cannot express: {type: "$opaque", id, name, nodeType}, plus
// truncated: true when the node budget cut its children off. Never edited or
// recreated; its subtree is absent from the Spec.
export const OPAQUE_TYPE = "$opaque";

// A colour with no paint: applyColorPaint writes alpha 0 as an empty paint list.
export const NO_PAINT = "#00000000";

const COMMON = ["name", "x", "y", "opacity", "layoutPositioning"];
const SIZING = ["layoutSizingHorizontal", "layoutSizingVertical"];
const PAINTED = ["fillColor", "strokeColor", "strokeWeight", "strokeAlign", "effects"];
// Frame properties that only mean something while the frame has auto-layout.
const AUTO_LAYOUT = [
  "layoutWrap", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "primaryAxisAlignItems", "counterAxisAlignItems", "itemSpacing", "counterAxisSpacing", "itemReverseZIndex",
];

// The properties each editable type carries in a Spec: what updateNodeProperties
// can write for that type. Anything else is dropped by normalizeNode.
export const SPEC_VOCABULARY: Record<SpecType, readonly string[]> = {
  frame: [...COMMON, "width", "height", ...PAINTED, "cornerRadius", "clipsContent", "layoutMode", ...AUTO_LAYOUT, ...SIZING],
  rectangle: [...COMMON, "width", "height", ...PAINTED, "cornerRadius", ...SIZING],
  vector: [...COMMON, "width", "height", ...PAINTED, "strokeCap", "pathData", ...SIZING],
  text: [...COMMON, "text", "fontFamily", "fontStyle", "fontSize", "fontColor", "lineHeight", "letterSpacing",
    "textCase", "textAlignHorizontal", "textAutoResize", "width", "effects", ...SIZING],
  instance: [...COMMON, "componentKey", "componentId", "properties", ...SIZING],
};

const BASE_DEFAULTS = { x: 0, y: 0, opacity: 1, layoutPositioning: "AUTO", layoutSizingHorizontal: "FIXED", layoutSizingVertical: "FIXED" };
const PAINT_DEFAULTS = { fillColor: NO_PAINT, strokeColor: NO_PAINT, strokeWeight: 1, effects: [] };

// What create_node_tree applies when a property is absent (creation.ts,
// vectors.ts, components.ts; padding 10 and itemReverseZIndex true come from
// createFrame for auto-layout frames). A value equal to its default is left out
// of a Spec. Paints default to "no paint": create leaves Figma's own creation
// paint in place, which differs by node type, so a create from a Spec should
// pass these defaults explicitly rather than rely on Figma's.
export const SPEC_DEFAULTS: Record<SpecType, Readonly<Record<string, unknown>>> = {
  frame: {
    ...BASE_DEFAULTS, ...PAINT_DEFAULTS, width: 100, height: 100, strokeAlign: "INSIDE", cornerRadius: 0, clipsContent: true,
    layoutMode: "NONE", layoutWrap: "NO_WRAP", paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10,
    primaryAxisAlignItems: "MIN", counterAxisAlignItems: "MIN", itemSpacing: 0, counterAxisSpacing: 0, itemReverseZIndex: true,
  },
  rectangle: { ...BASE_DEFAULTS, ...PAINT_DEFAULTS, width: 100, height: 100, strokeAlign: "INSIDE", cornerRadius: 0 },
  vector: { ...BASE_DEFAULTS, ...PAINT_DEFAULTS, strokeAlign: "CENTER", strokeCap: "NONE" },
  text: {
    x: 0, y: 0, opacity: 1, layoutPositioning: "AUTO", effects: [], fontFamily: "Inter", fontStyle: "Regular", fontSize: 14,
    fontColor: "#000000", letterSpacing: 0, textCase: "ORIGINAL", textAlignHorizontal: "LEFT",
  },
  instance: { ...BASE_DEFAULTS, properties: {} },
};

// Kept even when equal to a default: they identify the node or decide others.
const ALWAYS_EMITTED = new Set(["name", "text", "textAutoResize", "pathData", "componentKey", "componentId"]);
const DEFAULT_NAMES: Partial<Record<SpecType, string>> = { frame: "Frame", rectangle: "Rectangle", vector: "Vector" };
const COLOR_KEYS = new Set(["fillColor", "strokeColor", "fontColor"]);
const BOOLEAN_KEYS = new Set(["clipsContent", "itemReverseZIndex"]);
const NUMBER_KEYS = new Set([
  "x", "y", "width", "height", "opacity", "strokeWeight", "cornerRadius", "paddingTop", "paddingRight", "paddingBottom",
  "paddingLeft", "itemSpacing", "counterAxisSpacing", "fontSize", "lineHeight", "letterSpacing",
]);

// Order of keys in a written Spec node, so diffs of the file stay readable.
const KEY_ORDER = [
  "type", "name", "nodeType", "truncated", "componentKey", "componentId", "text", "x", "y", "width", "height",
  "layoutPositioning", ...SIZING, "layoutMode", ...AUTO_LAYOUT, "clipsContent", "fillColor", "strokeColor", "strokeWeight",
  "strokeAlign", "strokeCap", "cornerRadius", "opacity", "effects", "fontFamily", "fontStyle", "fontSize", "fontColor",
  "lineHeight", "letterSpacing", "textCase", "textAlignHorizontal", "textAutoResize", "pathData", "properties",
];

// Shared with the plugin's create path (utils.ts re-exports it), so a Spec's
// fontWeight shorthand maps to the same fontStyle create would load.
export function fontWeightToStyle(weight: number): string {
  switch (weight) {
    case 100: return "Thin";
    case 200: return "Extra Light";
    case 300: return "Light";
    case 400: return "Regular";
    case 500: return "Medium";
    case 600: return "Semi Bold";
    case 700: return "Bold";
    case 800: return "Extra Bold";
    case 900: return "Black";
    default: return "Regular";
  }
}

export function round2(n: number): number {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}

const byte = (v: unknown) => Math.round(Math.min(1, Math.max(0, Number(v) || 0)) * 255);
const hex2 = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();

function hexFromBytes(r: number, g: number, b: number, a: number): string {
  if (a === 0) return NO_PAINT;
  return "#" + hex2(r) + hex2(g) + hex2(b) + (a === 255 ? "" : hex2(a));
}

// A Figma RGB colour (0-1 channels) and opacity as canonical hex.
export function colorToHex(color: { r: number; g: number; b: number; a?: number }, opacity: number = color.a ?? 1): string {
  return hexFromBytes(byte(color.r), byte(color.g), byte(color.b), byte(opacity));
}

// Any colour form create_node_tree accepts, as canonical hex (#RRGGBB, or
// #RRGGBBAA below full alpha, or NO_PAINT at alpha 0). `$var:` references stay
// references. Strings that are not hex (a gradient) are returned unchanged.
export function canonicalColor(value: unknown): string | undefined {
  if (typeof value === "string") {
    const s = value.trim();
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
    if (!m) return s;
    let h = m[1];
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return hexFromBytes(n(0), n(2), n(4), h.length === 8 ? n(6) : 255);
  }
  if (value && typeof value === "object" && "r" in value) return colorToHex(value as any);
  return undefined;
}

// Effects in the form buildFigmaEffects writes, with its defaults filled in, so
// a Spec's shorthand and Figma's full read-back compare equal. Undefined when an
// effect type is not one buildFigmaEffects can write.
function canonicalEffects(list: unknown): unknown[] | undefined {
  if (!Array.isArray(list)) return undefined;
  const out: unknown[] = [];
  for (const e of list) {
    if (!e || typeof e !== "object") return undefined;
    const visible = e.visible !== false;
    if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
      out.push({
        type: e.type, visible,
        color: canonicalColor(e.color ?? { r: 0, g: 0, b: 0, a: 0.25 }),
        offset: { x: round2(Number(e.offset?.x ?? 0)), y: round2(Number(e.offset?.y ?? 4)) },
        radius: round2(Number(e.radius ?? 4)), spread: round2(Number(e.spread ?? 0)), blendMode: e.blendMode || "NORMAL",
      });
    } else if (e.type === "LAYER_BLUR" || e.type === "BACKGROUND_BLUR") {
      out.push({ type: e.type, visible, radius: round2(Number(e.radius ?? 4)) });
    } else {
      return undefined;
    }
  }
  return out;
}

function canonicalValue(key: string, value: unknown): unknown {
  if (COLOR_KEYS.has(key)) return canonicalColor(value);
  if (key === "effects") return canonicalEffects(value);
  if (NUMBER_KEYS.has(key)) {
    const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    return typeof n === "number" && isFinite(n) ? round2(n) : undefined;
  }
  if (BOOLEAN_KEYS.has(key)) return !!value;
  if (key === "pathData") return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : undefined;
  if (key === "properties") return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as object) } : undefined;
  return value;
}

export interface ParentLayout { layoutMode?: string }

const isAutoLayout = (layoutMode: unknown) => typeof layoutMode === "string" && layoutMode !== "NONE";

function orderKeys(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of KEY_ORDER) if (props[key] !== undefined) out[key] = props[key];
  for (const key of Object.keys(props).sort()) if (!(key in out) && props[key] !== undefined) out[key] = props[key];
  return out;
}

// The canonical properties of one node (no id, no children). `node` is a node
// in Spec vocabulary, read from Figma or from a Spec file; `parent` is its
// parent's layout, which decides whether x and y are derived.
export function normalizeNode(node: Record<string, any>, parent: ParentLayout = {}): Record<string, unknown> {
  if (node.type === OPAQUE_TYPE) {
    return orderKeys({ type: OPAQUE_TYPE, name: node.name, nodeType: node.nodeType, truncated: node.truncated === true ? true : undefined });
  }
  const type = node.type as SpecType;
  if (!SPEC_TYPES.includes(type)) throw new Error(`Unknown Spec node type: ${JSON.stringify(node.type)}`);

  // Shorthands create_node_tree accepts, resolved the way create resolves them.
  const src: Record<string, any> = { ...node };
  if (type === "text") {
    if (src.fontStyle === undefined && src.fontWeight !== undefined) src.fontStyle = fontWeightToStyle(Number(src.fontWeight));
    if (src.text === undefined) src.text = "Text";
    if (src.textAutoResize === undefined) src.textAutoResize = src.width !== undefined ? "HEIGHT" : "WIDTH_AND_HEIGHT";
    if (src.name === undefined || src.name === "") src.name = src.text;
  } else if (src.name === undefined && DEFAULT_NAMES[type]) {
    src.name = DEFAULT_NAMES[type];
  }

  const out: Record<string, any> = { type };
  for (const key of SPEC_VOCABULARY[type]) {
    if (src[key] === undefined || src[key] === null) continue;
    const value = canonicalValue(key, src[key]);
    if (value !== undefined) out[key] = value;
  }

  // Values Figma derives from layout: comparing them would report untouched nodes.
  if (isAutoLayout(parent.layoutMode) && out.layoutPositioning !== "ABSOLUTE") { delete out.x; delete out.y; }
  if (type === "text") {
    if (out.textAutoResize !== "HEIGHT") delete out.width;
    // HUG and FIXED on text follow from textAutoResize; only FILL is its own choice.
    for (const key of SIZING) if (out[key] !== "FILL") delete out[key];
  }
  if (out.layoutSizingHorizontal === "HUG" || out.layoutSizingHorizontal === "FILL") delete out.width;
  if (out.layoutSizingVertical === "HUG" || out.layoutSizingVertical === "FILL") delete out.height;
  if (type === "frame") {
    if (!isAutoLayout(out.layoutMode)) for (const key of AUTO_LAYOUT) delete out[key];
    if (out.layoutWrap !== "WRAP") delete out.counterAxisSpacing;
  }
  // The write path is pixels-only and uses parseInt.
  if (typeof out.fontSize === "number" && !Number.isInteger(out.fontSize)) delete out.fontSize;

  const defaults = SPEC_DEFAULTS[type];
  for (const key of Object.keys(out)) {
    if (key === "type" || ALWAYS_EMITTED.has(key) || !(key in defaults)) continue;
    if (stableStringify(out[key]) === stableStringify(defaults[key])) delete out[key];
  }
  return orderKeys(out);
}

// A Spec tree in canonical form: ids kept, every frame given a children array,
// each child normalised against its parent's layout.
export function normalizeSpecTree(node: Record<string, any>, parent: ParentLayout = {}): Record<string, any> {
  const props = normalizeNode(node, parent);
  const out: Record<string, any> = node.id !== undefined ? { id: node.id, ...props } : { ...props };
  if (props.type === "frame") {
    const layout = { layoutMode: typeof node.layoutMode === "string" ? node.layoutMode : "NONE" };
    out.children = (Array.isArray(node.children) ? node.children : []).map((child: any) => normalizeSpecTree(child, layout));
  }
  return out;
}

// JSON with sorted keys and numbers rounded to 2 decimals: equal content gives
// an equal string whatever the key order or float noise.
export function stableStringify(value: unknown): string {
  if (typeof value === "number") return JSON.stringify(isFinite(value) ? round2(value) : null);
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(v => (v === undefined ? "null" : stableStringify(v))).join(",") + "]";
  const keys = Object.keys(value).filter(k => (value as any)[k] !== undefined).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify((value as any)[k])).join(",") + "}";
}

// 53-bit string hash (cyrb53). The plugin sandbox has no crypto; this only has
// to tell edited content from unedited, not resist an attacker.
export function hashString(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

export function hashProps(props: Record<string, unknown>): string {
  return hashString(stableStringify(props));
}

// One SpecLock entry: the node's canonical properties as Figma held them at the
// last pull (the base of the three-way comparison), its hash, and its place.
// Child order lives in `children`, never in propsHash, so a reorder is a move.
export interface SpecLockNode {
  props: Record<string, unknown>;
  propsHash: string;
  parentId: string | null;
  children: string[];
}

// The SpecLock node map for a canonical tree in which every node has an id. An
// OpaqueNode has no children here, so a subtree the budget cut off never reads
// as removed children.
export function lockNodesFromTree(tree: Record<string, any>, rootParentId: string | null): Record<string, SpecLockNode> {
  const nodes: Record<string, SpecLockNode> = {};
  const visit = (node: Record<string, any>, parentId: string | null) => {
    const { id, children, ...props } = node;
    if (typeof id !== "string" || !id) throw new Error("Every node in a pulled Spec needs an id");
    if (nodes[id]) throw new Error(`Duplicate node id in Spec: ${id}`);
    const kids: Record<string, any>[] = Array.isArray(children) ? children : [];
    nodes[id] = { props, propsHash: hashProps(props), parentId, children: kids.map(child => child.id) };
    for (const child of kids) visit(child, id);
  };
  visit(tree, rootParentId);
  return nodes;
}

export interface SpecHeader {
  fileKey: string | null;
  fileName: string | null;
  pageId: string;
  rootId: string;
}

export interface SpecFile extends SpecHeader {
  l2fSpec: number;
  tree: Record<string, any>;
}

export interface SpecLockFile extends SpecHeader {
  l2fLock: number;
  pulledAt: string;
  specHash: string;
  supersededFrameId: string | null;
  pendingApply: string | null;
  nodes: Record<string, SpecLockNode>;
}

// Over the parsed content, not the bytes: reformatting the file or reordering
// keys is not an edit.
export function specHash(spec: unknown): string {
  return hashString(stableStringify(spec));
}

export function isSpecFile(value: any): value is SpecFile {
  return !!value && typeof value === "object" && value.l2fSpec === SPEC_VERSION && !!value.tree && typeof value.tree === "object";
}

export function isSpecLockFile(value: any): value is SpecLockFile {
  return !!value && typeof value === "object" && value.l2fLock === SPEC_LOCK_VERSION && !!value.nodes && typeof value.nodes === "object";
}
