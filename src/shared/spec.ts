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
// ambiguous variables...) before calling it, listing those keys in `$unread`;
// see src/llm2figma_plugin/src/spec.ts. Spec input is normalised with
// {strict: true}, which refuses what the default mode would silently drop.

export const SPEC_VERSION = 1;
export const SPEC_LOCK_VERSION = 1;

export type SpecType = "frame" | "text" | "rectangle" | "vector" | "instance";
export const SPEC_TYPES: readonly SpecType[] = ["frame", "text", "rectangle", "vector", "instance"];

// A node the format cannot express: {type: "$opaque", id, name, nodeType, reason}.
// Never edited or recreated; its subtree is absent from the Spec. A node the
// export did not read (node, depth or byte budget) is an OpaqueNode with
// truncated: true in its parent's children, so the parent's child list is
// always complete and nothing reads as removed.
export const OPAQUE_TYPE = "$opaque";

// `"$unread": [sorted keys]` on an editable node: the vocabulary keys whose
// Figma value the format cannot express (a gradient fill, mixed stroke weights,
// a fractional font size...), so the export left them out. An absent key listed
// here does NOT mean its default: Figma holds something else. Written by the
// export only; it is part of the node's props, its SpecLock entry and its
// propsHash. Allowed on every editable type besides SPEC_VOCABULARY; a Spec may
// neither edit nor remove it, and plan_spec never writes a key listed in it.
export const UNREAD_KEY = "$unread";

// A colour with no paint: applyColorPaint writes alpha 0 as an empty paint list.
export const NO_PAINT = "#00000000";

const COMMON = ["name", "visible", "x", "y", "opacity", "layoutPositioning"];
const SIZING = ["layoutSizingHorizontal", "layoutSizingVertical"];
const PAINTED = ["fillColor", "strokeColor", "strokeWeight", "strokeAlign", "effects"];
// Frame properties that only mean something while the frame has auto-layout.
const AUTO_LAYOUT = [
  "layoutWrap", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "primaryAxisAlignItems", "counterAxisAlignItems", "itemSpacing", "counterAxisSpacing", "itemReverseZIndex",
];

// The writable vocabulary: per node type, the keys the export may emit. Every
// key here is written by both createNode and updateNodeProperties for that
// type (tests/spec-sync.test.ts, "writable vocabulary parity"); FILL sizing on
// a frame is written by applyDeferredFill(node, spec, only, {checkParent: true}).
// Anything else is dropped by normalizeNode (and refused by its strict mode).
export const SPEC_VOCABULARY: Record<SpecType, readonly string[]> = {
  frame: [...COMMON, "width", "height", ...PAINTED, "cornerRadius", "clipsContent", "layoutMode", ...AUTO_LAYOUT, ...SIZING],
  rectangle: [...COMMON, "width", "height", ...PAINTED, "cornerRadius", ...SIZING],
  vector: [...COMMON, "width", "height", ...PAINTED, "strokeCap", "pathData", ...SIZING],
  text: [...COMMON, "text", "fontFamily", "fontStyle", "fontSize", "fontColor", "lineHeight", "letterSpacing",
    "textCase", "textAlignHorizontal", "textAutoResize", "width", "height", "effects", ...SIZING],
  instance: [...COMMON, "componentKey", "componentId", "componentSetKey", "componentSetId", "properties", "width", "height", ...SIZING],
};

const BASE_DEFAULTS = { visible: true, x: 0, y: 0, opacity: 1, layoutPositioning: "AUTO", layoutSizingHorizontal: "FIXED", layoutSizingVertical: "FIXED" };
const PAINT_DEFAULTS = { fillColor: NO_PAINT, strokeColor: NO_PAINT, strokeWeight: 1, effects: [] };

// What a property is when it is absent from a Spec: what create_node_tree ends
// up with when the property is not passed (creation.ts, vectors.ts,
// components.ts, plus Figma's own creation paints: a new frame is white, a new
// rectangle #D9D9D9; padding 10 and itemReverseZIndex true come from
// createFrame for auto-layout frames). A value equal to its default is left out
// of a Spec, except the keys in NEVER_DROPPED.
export const SPEC_DEFAULTS: Record<SpecType, Readonly<Record<string, unknown>>> = {
  frame: {
    ...BASE_DEFAULTS, ...PAINT_DEFAULTS, fillColor: "#FFFFFF", width: 100, height: 100, strokeAlign: "INSIDE", cornerRadius: 0,
    clipsContent: true, layoutMode: "NONE", layoutWrap: "NO_WRAP", paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10,
    primaryAxisAlignItems: "MIN", counterAxisAlignItems: "MIN", itemSpacing: 0, counterAxisSpacing: 0, itemReverseZIndex: true,
  },
  rectangle: { ...BASE_DEFAULTS, ...PAINT_DEFAULTS, fillColor: "#D9D9D9", width: 100, height: 100, strokeAlign: "INSIDE", cornerRadius: 0 },
  vector: { ...BASE_DEFAULTS, ...PAINT_DEFAULTS, strokeAlign: "CENTER", strokeCap: "NONE" },
  text: {
    ...BASE_DEFAULTS, effects: [], fontFamily: "Inter", fontStyle: "Regular", fontSize: 14,
    fontColor: "#000000", letterSpacing: 0, textCase: "ORIGINAL", textAlignHorizontal: "LEFT",
  },
  instance: { ...BASE_DEFAULTS, properties: {} },
};

// Emitted whenever present, even when equal to a default. Identity keys, and
// the values Figma derives differently from create (rule D in docs/Spec-Sync.md):
// x/y wherever the node is not placed by an auto-layout parent, width/height on
// a FIXED axis, and padding, spacing and itemReverseZIndex under auto-layout
// (turning auto-layout on in Figma keeps padding 0, create makes it 10). What
// stays absent after the derived values are removed is then always the default.
const NEVER_DROPPED = new Set([
  "name", "text", "textAutoResize", "pathData", "componentKey", "componentId", "componentSetKey", "componentSetId",
  "x", "y", "width", "height", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "itemSpacing", "counterAxisSpacing",
  "itemReverseZIndex",
]);
const DEFAULT_NAMES: Partial<Record<SpecType, string>> = { frame: "Frame", rectangle: "Rectangle", vector: "Vector" };
const COLOR_KEYS = new Set(["fillColor", "strokeColor", "fontColor"]);
const BOOLEAN_KEYS = new Set(["visible", "clipsContent", "itemReverseZIndex"]);
const NUMBER_KEYS = new Set([
  "x", "y", "width", "height", "opacity", "strokeWeight", "cornerRadius", "paddingTop", "paddingRight", "paddingBottom",
  "paddingLeft", "itemSpacing", "counterAxisSpacing", "fontSize", "lineHeight", "letterSpacing",
]);

// Order of keys in a written Spec node, so diffs of the file stay readable.
const KEY_ORDER = [
  "type", "name", "nodeType", "truncated", "reason", "componentKey", "componentId", "componentSetKey", "componentSetId", "text",
  "visible", "x", "y", "width", "height",
  "layoutPositioning", ...SIZING, "layoutMode", ...AUTO_LAYOUT, "clipsContent", "fillColor", "strokeColor", "strokeWeight",
  "strokeAlign", "strokeCap", "cornerRadius", "opacity", "effects", "fontFamily", "fontStyle", "fontSize", "fontColor",
  "lineHeight", "letterSpacing", "textCase", "textAlignHorizontal", "textAutoResize", "pathData", "pathHash", "properties", UNREAD_KEY,
];

// Errors quote user input; every value, key list and type string in one is
// bounded so a pathological Spec cannot produce a huge message.
export const MAX_SHOWN_CHARS = 80;
export const MAX_SHOWN_ITEMS = 10;

export function clip(text: string, max: number = MAX_SHOWN_CHARS): string {
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

// A value as JSON, clipped.
export function showValue(value: unknown): string {
  let text: string;
  try { text = JSON.stringify(value) ?? String(value); } catch { text = String(value); }
  return clip(text);
}

// Up to MAX_SHOWN_ITEMS items, each clipped, then "and N more".
export function showList(items: readonly unknown[]): string {
  const shown = items.slice(0, MAX_SHOWN_ITEMS).map(item => clip(String(item))).join(", ");
  return items.length > MAX_SHOWN_ITEMS ? `${shown} and ${items.length - MAX_SHOWN_ITEMS} more` : shown;
}

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

// A variable-bound paint below full opacity: {"$var": "Collection/Name", opacity}.
// At opacity 1 the plain "$var:Collection/Name" string is the canonical form.
export interface VarPaint { $var: string; opacity: number }

export function isVarPaint(value: unknown): value is VarPaint {
  return !!value && typeof value === "object" && typeof (value as any).$var === "string";
}

// Any colour form create_node_tree accepts, as canonical hex (#RRGGBB, or
// #RRGGBBAA below full alpha, or NO_PAINT at alpha 0). `$var:` references stay
// references; {"$var", opacity} stays an object below opacity 1 and becomes
// "$var:Name" at 1. Strings that are not hex (a gradient) are returned unchanged.
export function canonicalColor(value: unknown): string | VarPaint | undefined {
  if (isVarPaint(value)) {
    const name = value.$var.startsWith("$var:") ? value.$var.slice(5) : value.$var;
    const raw = value.opacity === undefined ? 1 : Number(value.opacity);
    if (!name || !isFinite(raw)) return undefined;
    const opacity = round2(Math.min(1, Math.max(0, raw)));
    return opacity >= 1 ? `$var:${name}` : { $var: name, opacity };
  }
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

// One property's value in canonical form (undefined when it cannot be written).
export function canonicalValue(key: string, value: unknown): unknown {
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

export interface NormalizeOptions {
  // For user input (a Spec file): throw, naming each one, instead of silently
  // dropping a key the type cannot write or a value the write path cannot take.
  // Otherwise such a key would read as "deleted" and reset to its default.
  // Reads from Figma are normalised without it (the plugin already left out
  // what it cannot express and listed it in $unread).
  strict?: boolean;
}

// Keys a Spec node may carry besides its type's writable vocabulary.
const STRUCTURAL_KEYS = new Set(["id", "type", "children", UNREAD_KEY]);
// create_node_tree shorthands the normaliser resolves (fontWeight -> fontStyle).
const SHORTHANDS: Partial<Record<SpecType, readonly string[]>> = { text: ["fontWeight"] };
const OPAQUE_KEYS = new Set(["id", "type", "name", "nodeType", "truncated", "reason", "children"]);

// What strict normalisation refuses in a raw Spec node, as one message, or null.
function strictProblem(node: Record<string, any>): string | null {
  const type = node.type;
  if (type === OPAQUE_TYPE) {
    const stray = Object.keys(node).filter(k => !OPAQUE_KEYS.has(k));
    return stray.length ? `${showList(stray)} cannot be written on a ${OPAQUE_TYPE} node` : null;
  }
  if (!SPEC_TYPES.includes(type)) return `Unknown Spec node type: ${showValue(type)}`;
  const allowed = new Set([...SPEC_VOCABULARY[type as SpecType], ...(SHORTHANDS[type as SpecType] ?? [])]);
  const stray = Object.keys(node).filter(k => !STRUCTURAL_KEYS.has(k) && !allowed.has(k));
  if (stray.length) return `${showList(stray)} cannot be written on a ${type} node`;
  const bad: string[] = [];
  const unread = node[UNREAD_KEY];
  if (unread !== undefined && (!Array.isArray(unread) || unread.some(k => typeof k !== "string"))) {
    bad.push(`${UNREAD_KEY} ${showValue(unread)} must be the list of keys the pull recorded`);
  }
  for (const key of SPEC_VOCABULARY[type as SpecType]) {
    const value = node[key];
    if (value === undefined) continue;
    if (value === null) { bad.push(`${key} is null (delete the key to mean its default)`); continue; }
    if (COLOR_KEYS.has(key) && typeof value === "object" && !isVarPaint(value) && !("r" in (value as object))) {
      bad.push(`${key} ${showValue(value)} is not a colour`);
    } else if (canonicalValue(key, value) === undefined) {
      bad.push(`${key} ${showValue(value)} cannot be written`);
    } else if (key === "fontSize" && !Number.isInteger(canonicalValue(key, value))) {
      bad.push(`fontSize ${showValue(value)} must be a whole number of pixels`);
    }
  }
  if (!bad.length) return null;
  const more = bad.length > MAX_SHOWN_ITEMS ? `; and ${bad.length - MAX_SHOWN_ITEMS} more` : "";
  return bad.slice(0, MAX_SHOWN_ITEMS).join("; ") + more;
}

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
export function normalizeNode(node: Record<string, any>, parent: ParentLayout = {}, options: NormalizeOptions = {}): Record<string, unknown> {
  if (options.strict) {
    const problem = strictProblem(node);
    if (problem) throw new Error(problem);
  }
  if (node.type === OPAQUE_TYPE) {
    return orderKeys({
      type: OPAQUE_TYPE, name: node.name, nodeType: node.nodeType, truncated: node.truncated === true ? true : undefined,
      reason: typeof node.reason === "string" ? node.reason : undefined,
    });
  }
  const type = node.type as SpecType;
  if (!SPEC_TYPES.includes(type)) throw new Error(`Unknown Spec node type: ${showValue(node.type)}`);

  // Shorthands create_node_tree accepts, resolved the way create resolves them.
  const src: Record<string, any> = { ...node };
  if (type === "text") {
    if (src.fontStyle === undefined && src.fontWeight !== undefined) src.fontStyle = fontWeightToStyle(Number(src.fontWeight));
    if (src.text === undefined) src.text = "Text";
    if (src.textAutoResize === undefined) src.textAutoResize = src.width !== undefined ? "HEIGHT" : "WIDTH_AND_HEIGHT";
    // No name default: a text node with autoRename is exported without one (it
    // follows its characters), so an absent name means "named by its text".
    if (src.name === "") delete src.name;
  } else if (src.name === undefined && DEFAULT_NAMES[type]) {
    src.name = DEFAULT_NAMES[type];
  }

  const out: Record<string, any> = { type };
  for (const key of SPEC_VOCABULARY[type]) {
    if (src[key] === undefined || src[key] === null) continue;
    const value = canonicalValue(key, src[key]);
    if (value !== undefined) out[key] = value;
  }
  const unread = Array.isArray(src[UNREAD_KEY]) ? [...new Set(src[UNREAD_KEY].filter((k: unknown) => typeof k === "string") as string[])].sort() : [];
  if (unread.length) out[UNREAD_KEY] = unread;

  // Values Figma derives from layout: comparing them would report untouched nodes.
  if (isAutoLayout(parent.layoutMode) && out.layoutPositioning !== "ABSOLUTE") { delete out.x; delete out.y; }
  if (type === "text") {
    // The box: width is set by HEIGHT, NONE and TRUNCATE; height only by NONE and TRUNCATE.
    const fixedBox = out.textAutoResize === "NONE" || out.textAutoResize === "TRUNCATE";
    if (out.textAutoResize !== "HEIGHT" && !fixedBox) delete out.width;
    if (!fixedBox) delete out.height;
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

  // A value given for a key Figma holds unexpressed is a request to change it,
  // never "the default": it is kept so plan_spec can report it.
  const defaults = SPEC_DEFAULTS[type];
  for (const key of Object.keys(out)) {
    if (key === "type" || NEVER_DROPPED.has(key) || !(key in defaults) || unread.includes(key)) continue;
    if (stableStringify(out[key]) === stableStringify(defaults[key])) delete out[key];
  }
  return orderKeys(out);
}

// A Spec tree in canonical form: ids kept, every frame given a children array,
// each child normalised against its parent's layout.
export function normalizeSpecTree(node: Record<string, any>, parent: ParentLayout = {}, options: NormalizeOptions = {}): Record<string, any> {
  const props = normalizeNode(node, parent, options);
  const out: Record<string, any> = node.id !== undefined ? { id: node.id, ...props } : { ...props };
  if (props.type === "frame") {
    const layout = { layoutMode: typeof node.layoutMode === "string" ? node.layoutMode : "NONE" };
    out.children = (Array.isArray(node.children) ? node.children : []).map((child: any) => normalizeSpecTree(child, layout, options));
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

// The form a node's canonical properties take in a SpecLock: the same, except a
// vector's pathData is replaced by pathHash (hashString of the canonical
// pathData), so a lock stays small. propsHash is hashProps(lockProps(props));
// compare a live or Spec node against a lock entry through lockProps too.
export function lockProps(props: Record<string, unknown>): Record<string, unknown> {
  if (typeof props.pathData !== "string") return props;
  const { pathData, ...rest } = props;
  return orderKeys({ ...rest, pathHash: hashString(pathData) });
}

// One SpecLock entry: the node's canonical properties as Figma held them at the
// last pull (the base of the three-way comparison, in lockProps form), its
// hash, and its place. Child order lives in `children`, never in propsHash, so
// a reorder is a move.
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
    const stored = lockProps(props);
    nodes[id] = { props: stored, propsHash: hashProps(stored), parentId, children: kids.map(child => child.id) };
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
