// Spec sync (L2F_SPEC_SYNC): export_spec reads a subtree into Spec form. Reading
// is the inverse of createNode / updateNodeProperties (node-tree.ts): every
// property here is in SPEC_VOCABULARY, which both can write back. What cannot
// be read faithfully is left out here (figma.mixed values, paint lists with
// more than one visible paint or a non-solid paint, ambiguous variables,
// non-pixel line height and letter spacing, fractional font sizes, disagreeing
// stroke caps, multi-path vectors) and its key listed in the node's `$unread`,
// so an absent key is never mistaken for its default; text with more than one
// style is an OpaqueNode. The shared normaliser (src/shared/spec.ts) then drops
// derived values and defaults.
// `figma` is a global provided by the Figma plugin runtime.

import { WALK_LIMITS } from "../../shared/walk";
import { NO_PAINT, OPAQUE_TYPE, UNREAD_KEY, colorToHex, hashProps, lockNodesFromTree, lockProps, normalizeNode, round2, type ParentLayout, type SpecLockNode, type SpecType } from "../../shared/spec";
import { getVariableByName, sendProgressUpdate } from "./utils";

const SPEC_TYPE_OF: Record<string, SpecType> = {
  FRAME: "frame", TEXT: "text", RECTANGLE: "rectangle", VECTOR: "vector", INSTANCE: "instance",
};
const PROGRESS_EVERY = 50;
// The most serialised Spec one export_spec returns; past it the rest of the
// tree is truncated the same way as by the node budget.
export const MAX_SPEC_BYTES = 8 * 1024 * 1024;

const isMixed = (value: unknown) => typeof value === "symbol";
const isRotated = (node: any) => typeof node.rotation === "number" && Math.abs(node.rotation) > 0.01;

// Text styles the format writes for the whole node; any of them figma.mixed
// means the characters carry more than one style, which the format cannot write.
const TEXT_STYLE_KEYS = ["fontName", "fontSize", "fills", "letterSpacing", "lineHeight", "textDecoration", "textCase"];

// Why the format cannot write this node, or null when it can. Rotation is not in
// the format (and x/y are ambiguous on a rotated node); a GRID frame's tracks
// are not either; nor is text with more than one style. Instances are editable
// as leaves.
export function opaqueReason(node: any): string | null {
  if (!SPEC_TYPE_OF[node.type]) return "unsupported type";
  if (isRotated(node)) return "rotated";
  if (node.type === "FRAME" && node.layoutMode === "GRID") return "grid layout";
  if (node.type === "TEXT" && TEXT_STYLE_KEYS.some(key => isMixed(node[key]))) return "mixed-style text";
  return null;
}

export interface SpecExpectation {
  fileKey?: string | null;
  fileName?: string | null;
  pageId?: string | null;
}

function pageOf(node: any): any {
  let current = node;
  while (current && current.type !== "PAGE") current = current.parent;
  return current || null;
}

// Node ids repeat in a duplicated file, so every spec-sync command checks it
// has the file and page it expects. The file key is compared when both sides
// have one, otherwise the file name. The page is loaded by id, never taken from
// figma.currentPage.
export async function resolveSpecTarget(nodeId: string, expect: SpecExpectation = {}) {
  const fileKey: string | null = (figma as any).fileKey ?? null;
  const fileName: string | null = figma.root ? figma.root.name : null;
  if (expect.fileKey && fileKey) {
    if (expect.fileKey !== fileKey) throw new Error(`Wrong file: expected file key ${expect.fileKey}, but the connected file's key is ${fileKey}.`);
  } else if (expect.fileName != null && expect.fileName !== fileName) {
    throw new Error(`Wrong file: expected "${expect.fileName}", but the connected file is "${fileName}".`);
  }
  let page: any = null;
  if (expect.pageId) {
    page = await figma.getNodeByIdAsync(expect.pageId);
    if (!page || page.type !== "PAGE") throw new Error(`Wrong file or page: page ${expect.pageId} is not in the connected file.`);
    if (typeof page.loadAsync === "function") await page.loadAsync();
  }
  const node: any = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error(`Node not found with ID: ${nodeId}`);
  const nodePage = pageOf(node);
  if (!nodePage) throw new Error(`Node ${nodeId} is not on a page.`);
  if (page && nodePage.id !== page.id) throw new Error(`Wrong page: node ${nodeId} is on page ${nodePage.id}, expected ${page.id}.`);
  if (!page) {
    page = nodePage;
    if (typeof page.loadAsync === "function") await page.loadAsync();
  }
  return { node, page, fileKey, fileName };
}

// Per-run caches: one variable and collection lookup per id, however many
// paints share it; one getMainComponentAsync per instance, and one source
// (key or id, set or component) per main component.
export class SpecReadCache {
  private refs = new Map<string, Promise<string | null>>();
  private collections = new Map<string, Promise<any>>();
  private mains = new Map<string, Promise<any>>();
  private sources = new Map<string, Record<string, string>>();

  mainComponent(instance: any): Promise<any> {
    if (!this.mains.has(instance.id)) this.mains.set(instance.id, Promise.resolve().then(() => instance.getMainComponentAsync()).catch(() => null));
    return this.mains.get(instance.id)!;
  }

  // How a Spec names an instance's main component. A variant is named by its
  // set (componentSetKey, or componentSetId for a local set, which has no
  // importable key), with the VARIANT values in `properties` choosing the
  // variant; any other component by componentKey (library) or componentId (local).
  componentSource(main: any): Record<string, string> {
    if (!this.sources.has(main.id)) {
      const parent = main.parent;
      const set = parent && parent.type === "COMPONENT_SET" ? parent : null;
      const source = set
        ? (main.remote ? { componentSetKey: set.key } : { componentSetId: set.id })
        : (main.remote ? { componentKey: main.key } : { componentId: main.id });
      this.sources.set(main.id, source);
    }
    return this.sources.get(main.id)!;
  }

  // The `Collection/Name` that resolves back to exactly this variable through
  // the same lookup a write uses (getVariableByName), or null when it does not
  // (another variable shares the name, or the name is ambiguous).
  variableRef(id: string): Promise<string | null> {
    if (!this.refs.has(id)) this.refs.set(id, this.resolveRef(id));
    return this.refs.get(id)!;
  }

  private collection(id: string): Promise<any> {
    if (!this.collections.has(id)) this.collections.set(id, figma.variables.getVariableCollectionByIdAsync(id).catch(() => null));
    return this.collections.get(id)!;
  }

  private async resolveRef(id: string): Promise<string | null> {
    try {
      const variable: any = await figma.variables.getVariableByIdAsync(id);
      if (!variable || !variable.variableCollectionId) return null;
      const collection = await this.collection(variable.variableCollectionId);
      if (!collection) return null;
      const ref = `${collection.name}/${variable.name}`;
      const resolved: any = await getVariableByName(ref);
      return resolved && resolved.id === id ? ref : null;
    } catch {
      return null;
    }
  }
}

// One visible solid paint as hex or `$var:` (or {"$var", opacity} for a bound
// paint below full opacity); an empty list as NO_PAINT; anything else (several
// paints, a hidden, non-solid or blended paint, a mixed value, an unresolvable
// variable) is left out.
async function solidColor(paints: any, cache: SpecReadCache): Promise<unknown> {
  if (isMixed(paints) || !Array.isArray(paints)) return undefined;
  if (paints.length === 0) return NO_PAINT;
  if (paints.length !== 1) return undefined;
  const paint = paints[0];
  if (paint.type !== "SOLID" || paint.visible === false || (paint.blendMode && paint.blendMode !== "NORMAL")) return undefined;
  const alias = paint.boundVariables && paint.boundVariables.color;
  if (alias && alias.id) {
    const ref = await cache.variableRef(alias.id);
    if (!ref) return undefined;
    const opacity = round2(paint.opacity ?? 1);
    return opacity < 1 ? { $var: ref, opacity } : `$var:${ref}`;
  }
  return colorToHex(paint.color, paint.opacity ?? 1);
}

// Effects buildFigmaEffects can write back without losing anything.
function readEffects(effects: any): any[] | undefined {
  if (isMixed(effects) || !Array.isArray(effects)) return undefined;
  for (const e of effects) {
    if (!["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"].includes(e.type)) return undefined;
    if (e.boundVariables && Object.keys(e.boundVariables).length) return undefined;
    if (e.showShadowBehindNode === true || (e.blurType && e.blurType !== "NORMAL")) return undefined;
  }
  return effects;
}

const notMixed = (value: unknown) => (isMixed(value) ? undefined : value);
const pixels = (value: any) => (value && value.unit === "PIXELS" ? value.value : undefined);

function common(node: any, type: SpecType): Record<string, unknown> {
  return {
    type, name: node.name, visible: node.visible, x: node.x, y: node.y, opacity: node.opacity, layoutPositioning: node.layoutPositioning,
    layoutSizingHorizontal: node.layoutSizingHorizontal, layoutSizingVertical: node.layoutSizingVertical,
  };
}

// Records a key whose Figma value the format cannot express: `value` is
// undefined because it could not be read, not because it is absent.
type Unread = (key: string, value: unknown) => unknown;
function unreadList(): { unread: string[]; mark: Unread } {
  const unread: string[] = [];
  return { unread, mark: (key, value) => { if (value === undefined) unread.push(key); return value; } };
}

async function paintedProps(node: any, cache: SpecReadCache, mark: Unread): Promise<Record<string, unknown>> {
  return {
    width: node.width, height: node.height,
    fillColor: mark("fillColor", await solidColor(node.fills, cache)), strokeColor: mark("strokeColor", await solidColor(node.strokes, cache)),
    strokeWeight: mark("strokeWeight", notMixed(node.strokeWeight)), strokeAlign: node.strokeAlign, effects: mark("effects", readEffects(node.effects)),
  };
}

// The stroke cap every vertex shares, or undefined when they disagree.
function sharedStrokeCap(node: any): string | undefined {
  try {
    const vertices = node.vectorNetwork && node.vectorNetwork.vertices;
    if (!Array.isArray(vertices) || !vertices.length) return undefined;
    const caps = new Set(vertices.map((v: any) => v.strokeCap || "NONE"));
    return caps.size === 1 ? [...caps][0] as string : undefined;
  } catch {
    return undefined;
  }
}

// The write path sets one NONZERO path; anything else would be lost on write.
function singlePath(node: any): string | undefined {
  const paths = node.vectorPaths;
  if (!Array.isArray(paths) || paths.length !== 1) return undefined;
  if (paths[0].windingRule && paths[0].windingRule !== "NONZERO") return undefined;
  return paths[0].data;
}

// Component properties as {"Name#id": value}. INSTANCE_SWAP values are node ids,
// which the format does not carry in v1.
function flatProperties(node: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const props = node.componentProperties || {};
  for (const key of Object.keys(props)) {
    if (props[key] && props[key].type !== "INSTANCE_SWAP") out[key] = props[key].value;
  }
  return out;
}

export type SpecRead = { props: Record<string, unknown> } | { opaque: string };

// A node's properties in Spec vocabulary, before normalisation, or the reason
// it is an OpaqueNode. Keys left out because their value cannot be expressed
// are listed, sorted, in `$unread`.
export async function readSpecNode(node: any, cache: SpecReadCache): Promise<SpecRead> {
  const read = await readSpecValues(node, cache);
  if ("props" in read && read.unread.length) read.props[UNREAD_KEY] = [...read.unread].sort();
  return "props" in read ? { props: read.props } : read;
}

async function readSpecValues(node: any, cache: SpecReadCache): Promise<{ props: Record<string, unknown>; unread: string[] } | { opaque: string }> {
  const reason = opaqueReason(node);
  if (reason) return { opaque: reason };
  const type = SPEC_TYPE_OF[node.type];
  const { unread, mark } = unreadList();
  const props = await readByType(node, type, cache, mark);
  return props ? { props, unread } : { opaque: "main component missing" };
}

async function readByType(node: any, type: SpecType, cache: SpecReadCache, mark: Unread): Promise<Record<string, unknown> | null> {
  switch (type) {
    case "frame":
      return {
        ...common(node, type), ...(await paintedProps(node, cache, mark)),
        cornerRadius: mark("cornerRadius", notMixed(node.cornerRadius)), clipsContent: node.clipsContent, layoutMode: node.layoutMode,
        layoutWrap: node.layoutWrap, paddingTop: node.paddingTop, paddingRight: node.paddingRight,
        paddingBottom: node.paddingBottom, paddingLeft: node.paddingLeft, primaryAxisAlignItems: node.primaryAxisAlignItems,
        counterAxisAlignItems: node.counterAxisAlignItems, itemSpacing: node.itemSpacing,
        counterAxisSpacing: node.counterAxisSpacing, itemReverseZIndex: node.itemReverseZIndex,
      };
    case "rectangle":
      return { ...common(node, type), ...(await paintedProps(node, cache, mark)), cornerRadius: mark("cornerRadius", notMixed(node.cornerRadius)) };
    case "vector":
      return {
        ...common(node, type), ...(await paintedProps(node, cache, mark)),
        strokeCap: mark("strokeCap", sharedStrokeCap(node)), pathData: mark("pathData", singlePath(node)),
      };
    case "text": {
      const letterSpacing = node.letterSpacing && node.letterSpacing.unit === "PERCENT" && node.letterSpacing.value === 0
        ? 0 : pixels(node.letterSpacing);
      // AUTO line height is the absent default; any other non-pixel value is unread.
      const lineHeight = node.lineHeight && node.lineHeight.unit === "AUTO" ? undefined : mark("lineHeight", pixels(node.lineHeight));
      // The write path is whole pixels only.
      const fontSize = typeof node.fontSize === "number" && Number.isInteger(round2(node.fontSize)) ? node.fontSize : mark("fontSize", undefined);
      return {
        ...common(node, type),
        // An auto-renamed layer follows its characters: its name is not its own.
        name: node.autoRename === true ? undefined : node.name,
        text: node.characters, textAlignHorizontal: node.textAlignHorizontal, textAutoResize: node.textAutoResize,
        width: node.width, height: node.height, effects: mark("effects", readEffects(node.effects)),
        fontFamily: node.fontName && node.fontName.family, fontStyle: node.fontName && node.fontName.style,
        fontSize, fontColor: mark("fontColor", await solidColor(node.fills, cache)), lineHeight,
        letterSpacing: mark("letterSpacing", letterSpacing), textCase: node.textCase,
      };
    }
    case "instance": {
      const main: any = await cache.mainComponent(node);
      if (!main) return null;
      return {
        ...common(node, type), ...cache.componentSource(main), properties: flatProperties(node), width: node.width, height: node.height,
      };
    }
  }
}

// readSpecNode's properties, or null for an OpaqueNode.
export async function readSpecProps(node: any, cache: SpecReadCache): Promise<Record<string, unknown> | null> {
  const read = await readSpecNode(node, cache);
  return "props" in read ? read.props : null;
}

function opaqueNode(node: any, reason: string, truncated = false): Record<string, unknown> {
  return { id: node.id, type: OPAQUE_TYPE, name: node.name, nodeType: node.type, ...(truncated ? { truncated: true } : {}), reason };
}

function countNodes(node: any): number {
  return 1 + (Array.isArray(node.children) ? node.children.reduce((n: number, child: any) => n + countNodes(child), 0) : 0);
}

const clamp = (value: unknown, fallback: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.floor(typeof value === "number" && isFinite(value) ? value : fallback)));

interface ReadOptions {
  // The command name progress updates are reported under.
  commandType: string;
  // Nodes to read as truncated OpaqueNodes without entering them, with the
  // reason the SpecLock recorded: the nodes the pull cut off, so a larger
  // budget never reads them as edited. Not counted as truncated by this read.
  forced?: ReadonlyMap<string, string>;
}

// The walk export_spec and read_spec_nodes share, {nodeId, expect, maxNodes,
// maxDepth, maxBytes}: the subtree as a canonical Spec tree (every node with its id). The walk is breadth-first and
// never enters an instance or an OpaqueNode. maxNodes counts the nodes read,
// maxBytes (at most MAX_SPEC_BYTES) the serialised tree, placeholders included
// (only a root whose own children's placeholders exceed it can go over). A node the walk could
// not read (node budget, depth limit or byte budget) is an OpaqueNode with
// truncated: true and a reason in its parent's children, so every frame's child
// list is complete. Only a root that cannot be read fails the export.
async function readSubtree(params: any, options: ReadOptions) {
  const { nodeId, expect, maxNodes, maxDepth, maxBytes, commandId } = params || {};
  const { commandType } = options;
  const forced = options.forced ?? new Map<string, string>();
  if (!nodeId || typeof nodeId !== "string") throw new Error("Missing nodeId parameter");
  if (nodeId.includes(";")) throw new Error(`Cannot pull ${nodeId}: it is inside an instance. Pull a node outside the instance; instances are exported as leaves.`);
  const { node: root, page, fileKey, fileName } = await resolveSpecTarget(nodeId, expect || {});
  const rootReason = opaqueReason(root);
  if (rootReason) {
    throw new Error(`Cannot pull ${nodeId}: a Spec root must be a frame, text, rectangle, vector or instance without rotation, grid layout or mixed text styles (this node: ${root.type}, ${rootReason}).`);
  }

  const nodeBudget = clamp(maxNodes, WALK_LIMITS.defaultNodes, 1, WALK_LIMITS.maxNodes);
  const depthLimit = clamp(maxDepth, WALK_LIMITS.defaultDepth, 0, WALK_LIMITS.maxDepth);
  const byteBudget = clamp(maxBytes, MAX_SPEC_BYTES, 1, MAX_SPEC_BYTES);
  const cache = new SpecReadCache();
  let read = 0;
  let bytes = 0;
  let opaqueCount = 0;
  let truncatedCount = 0;
  if (commandId) await sendProgressUpdate(commandId, commandType, "started", 0, nodeBudget, 0, `Reading up to ${nodeBudget} nodes`);

  const placeholder = (node: any, reason: string) => {
    opaqueCount++;
    truncatedCount++;
    return opaqueNode(node, reason, true);
  };
  // One node in canonical form, with its serialised size.
  const readOne = async (node: any, parent: ParentLayout) => {
    read++;
    if (commandId && read % PROGRESS_EVERY === 0) {
      await sendProgressUpdate(commandId, commandType, "in_progress", Math.min(99, Math.round((read / nodeBudget) * 100)), nodeBudget, read, `Read ${read} nodes`);
    }
    const result = await readSpecNode(node, cache);
    const raw = "props" in result ? result.props : opaqueNode(node, result.opaque);
    const out: Record<string, any> = { id: node.id, ...normalizeNode(raw, parent) };
    const frame = out.type === "frame";
    // + 1 for the separating comma, + `,"children":[]` for a frame
    return { out, frame, layoutMode: "props" in result ? (result.props.layoutMode as string | undefined) : undefined, size: JSON.stringify(out).length + 1 + (frame ? 14 : 0) };
  };
  // Bytes kept for the placeholders of children not read yet, so the whole
  // Spec, placeholders included, stays within the byte budget. Every reason is
  // 11 characters, so one size fits all three.
  const placeholderSize = (node: any) => JSON.stringify(opaqueNode(node, "node budget", true)).length + 1;
  const childrenSize = (node: any) => (node.children || []).reduce((sum: number, child: any) => sum + placeholderSize(child), 0);
  let reserved = 0;

  const parent = root.parent;
  const top = await readOne(root, { layoutMode: parent && parent.type !== "PAGE" ? parent.layoutMode : undefined });
  if (top.size > byteBudget) throw new Error(`Cannot pull ${nodeId}: the node alone is larger than the ${byteBudget}-byte Spec budget.`);
  if (top.out.type === OPAQUE_TYPE) throw new Error(`Cannot pull ${nodeId}: ${top.out.reason}.`);
  bytes = top.size;
  if (top.frame) reserved = childrenSize(root);

  const queue: Array<{ node: any; out: Record<string, any>; depth: number; layoutMode?: string }> = [];
  if (top.frame) queue.push({ node: root, out: top.out, depth: 0, layoutMode: top.layoutMode });
  let stoppedBy: string | null = null;
  for (let i = 0; i < queue.length; i++) {
    const { node, out, depth, layoutMode } = queue[i];
    out.children = [];
    for (const child of node.children || []) {
      const recorded = forced.get(child.id);
      if (recorded !== undefined) { opaqueCount++; out.children.push(opaqueNode(child, recorded, true)); continue; }
      if (depth >= depthLimit) { out.children.push(placeholder(child, "depth limit")); continue; }
      if (!stoppedBy && read >= nodeBudget) stoppedBy = "node budget";
      if (stoppedBy) { out.children.push(placeholder(child, stoppedBy)); continue; }
      const one = await readOne(child, { layoutMode: layoutMode ?? "NONE" });
      const own = placeholderSize(child);
      const below = one.frame ? childrenSize(child) : 0;
      if (bytes + reserved - own + one.size + below > byteBudget) {
        stoppedBy = "byte budget";
        out.children.push(placeholder(child, stoppedBy));
        continue;
      }
      bytes += one.size;
      reserved += below - own;
      if (one.out.type === OPAQUE_TYPE) opaqueCount++;
      out.children.push(one.out);
      if (one.frame) queue.push({ node: child, out: one.out, depth: depth + 1, layoutMode: one.layoutMode });
    }
  }
  const tree = top.out;

  if (commandId) await sendProgressUpdate(commandId, commandType, "completed", 100, nodeBudget, read, `Read ${read} nodes`);
  return {
    root, fileKey, fileName, pageId: page.id as string, rootId: root.id as string, rootParentId: parent ? parent.id as string : null,
    rootParentLayoutMode: (parent && parent.type !== "PAGE" ? parent.layoutMode : null) as string | null,
    tree, opaqueCount, truncated: truncatedCount > 0,
  };
}

// export_spec {nodeId, expect, maxNodes, maxDepth, maxBytes}: the subtree as a
// canonical Spec tree, for pull_spec to write.
export async function exportSpec(params: any) {
  const read = await readSubtree(params, { commandType: "export_spec" });
  return {
    fileKey: read.fileKey, fileName: read.fileName, pageId: read.pageId, rootId: read.rootId, rootParentId: read.rootParentId,
    tree: read.tree, nodeCount: countNodes(read.tree), opaqueCount: read.opaqueCount, truncated: read.truncated,
  };
}

// Width and height as Figma holds them, rounded like every other number.
function liveSize(node: any): { width: number; height: number } | undefined {
  return node && typeof node.width === "number" && typeof node.height === "number"
    ? { width: round2(node.width), height: round2(node.height) } : undefined;
}

// read_spec_nodes {rootId, expect, baseHashes, truncated, sizeIds, maxNodes,
// maxDepth, maxBytes}: for plan_spec, every live node under the root as
// {propsHash, parentId, children}, read by the same walk as export_spec, so an
// untouched node hashes the same as its SpecLock entry. `truncated` maps the
// ids the SpecLock recorded as cut off to their recorded reason; they are read
// as those placeholders whatever the budget. `props` (in SpecLock form) is
// included only when propsHash differs from the baseHashes entry (or there is
// none), so an unchanged design costs a hash per node. `size` is the live width
// and height of the nodes in sizeIds (an update naming one dimension needs the
// other). Writes nothing.
export async function readSpecNodes(params: any) {
  const { rootId, expect, baseHashes, truncated, sizeIds, maxNodes, maxDepth, maxBytes, commandId } = params || {};
  if (!rootId || typeof rootId !== "string") throw new Error("Missing rootId parameter");
  const bases: Record<string, string> = baseHashes && typeof baseHashes === "object" ? baseHashes : {};
  const forced = new Map<string, string>();
  if (truncated && typeof truncated === "object") {
    for (const [id, reason] of Object.entries(truncated)) if (typeof reason === "string") forced.set(id, reason);
  }
  const read = await readSubtree(
    { nodeId: rootId, expect, maxNodes, maxDepth, maxBytes, commandId },
    { commandType: "read_spec_nodes", forced },
  );
  const entries = lockNodesFromTree(read.tree, read.rootParentId);
  const nodes: Record<string, Record<string, unknown>> = {};
  for (const [id, entry] of Object.entries(entries)) {
    const out: Record<string, unknown> = { propsHash: entry.propsHash, parentId: entry.parentId, children: entry.children };
    if (bases[id] !== entry.propsHash) out.props = entry.props;
    nodes[id] = out;
  }
  for (const id of Array.isArray(sizeIds) ? sizeIds : []) {
    if (!nodes[id]) continue;
    const size = liveSize(id === read.rootId ? read.root : await figma.getNodeByIdAsync(id));
    if (size) nodes[id].size = size;
  }
  return {
    fileKey: read.fileKey, fileName: read.fileName, pageId: read.pageId, rootId: read.rootId, rootParentId: read.rootParentId,
    rootParentLayoutMode: read.rootParentLayoutMode, truncated: read.truncated, nodeCount: Object.keys(nodes).length, nodes,
  };
}

// The ids a SpecLock recorded as cut off by a budget, with their reason, as
// sent by the server ({id: reason}).
export function forcedReasons(truncated: unknown): Map<string, string> {
  const forced = new Map<string, string>();
  if (truncated && typeof truncated === "object") {
    for (const [id, reason] of Object.entries(truncated)) if (typeof reason === "string") forced.set(id, reason);
  }
  return forced;
}

// One live node's SpecLock entry, read the way readSubtree reads it (same
// parent layout, same placeholder for a node the SpecLock recorded as cut off),
// so it hashes like the node's entry in read_spec_nodes. For apply_spec_ops'
// staleness check: one node, not the whole subtree.
export async function readLockEntry(node: any, cache: SpecReadCache, forced: ReadonlyMap<string, string>): Promise<SpecLockNode> {
  const parent = node.parent;
  const layout: ParentLayout = { layoutMode: parent && parent.type !== "PAGE" ? parent.layoutMode : undefined };
  const recorded = forced.get(node.id);
  let raw: Record<string, unknown>;
  if (recorded !== undefined) raw = opaqueNode(node, recorded, true);
  else {
    const result = await readSpecNode(node, cache);
    raw = "props" in result ? result.props : opaqueNode(node, result.opaque);
  }
  const props = lockProps(normalizeNode(raw, layout));
  const children = props.type === "frame" && Array.isArray(node.children) ? node.children.map((child: any) => child.id as string) : [];
  return { props, propsHash: hashProps(props), parentId: parent ? parent.id : null, children };
}

// The whole subtree as SpecLock entries (every node with its props), read by
// the same walk as read_spec_nodes: apply_spec_ops' read-back.
export async function readLiveLock(params: any, commandType: string) {
  const { rootId, expect, truncated, maxNodes, maxDepth, maxBytes, commandId } = params || {};
  const read = await readSubtree({ nodeId: rootId, expect, maxNodes, maxDepth, maxBytes, commandId }, { commandType, forced: forcedReasons(truncated) });
  return {
    rootId: read.rootId, rootParentId: read.rootParentId, rootParentLayoutMode: read.rootParentLayoutMode,
    truncated: read.truncated, nodes: lockNodesFromTree(read.tree, read.rootParentId),
  };
}
