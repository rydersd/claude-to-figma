// Spec sync (L2F_SPEC_SYNC): export_spec reads a subtree into Spec form. Reading
// is the inverse of updateNodeProperties (node-tree.ts): every property here is
// one that function can write back. What cannot be read faithfully is left out
// here (figma.mixed values, paint lists with more than one visible paint or a
// non-solid paint, ambiguous variables, non-pixel line height and letter
// spacing, disagreeing stroke caps, multi-path vectors); the shared normaliser
// (src/shared/spec.ts) then drops derived values and defaults.
// `figma` is a global provided by the Figma plugin runtime.

import { walkTree, type WalkOptions } from "../../shared/walk";
import { NO_PAINT, OPAQUE_TYPE, colorToHex, normalizeSpecTree, type SpecType } from "../../shared/spec";
import { getVariableByName, sendProgressUpdate } from "./utils";

const SPEC_TYPE_OF: Record<string, SpecType> = {
  FRAME: "frame", TEXT: "text", RECTANGLE: "rectangle", VECTOR: "vector", INSTANCE: "instance",
};
const PROGRESS_EVERY = 50;

const isMixed = (value: unknown) => typeof value === "symbol";
const isRotated = (node: any) => typeof node.rotation === "number" && Math.abs(node.rotation) > 0.01;

// Why the format cannot write this node, or null when it can. Rotation is not in
// the format (and x/y are ambiguous on a rotated node); a GRID frame's tracks
// are not either. Instances are editable as leaves.
export function opaqueReason(node: any): string | null {
  if (!SPEC_TYPE_OF[node.type]) return node.type;
  if (isRotated(node)) return "rotated";
  if (node.type === "FRAME" && node.layoutMode === "GRID") return "grid layout";
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
// paints share it.
export class SpecReadCache {
  private refs = new Map<string, Promise<string | null>>();
  private collections = new Map<string, Promise<any>>();

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

// One visible solid paint as hex or `$var:`; an empty list as NO_PAINT;
// anything else (several paints, a hidden, non-solid or blended paint, a mixed
// value, an unresolvable variable) is left out.
async function solidColor(paints: any, cache: SpecReadCache): Promise<string | undefined> {
  if (isMixed(paints) || !Array.isArray(paints)) return undefined;
  if (paints.length === 0) return NO_PAINT;
  if (paints.length !== 1) return undefined;
  const paint = paints[0];
  if (paint.type !== "SOLID" || paint.visible === false || (paint.blendMode && paint.blendMode !== "NORMAL")) return undefined;
  const alias = paint.boundVariables && paint.boundVariables.color;
  if (alias && alias.id) {
    const ref = await cache.variableRef(alias.id);
    return ref ? `$var:${ref}` : undefined;
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
    type, name: node.name, x: node.x, y: node.y, opacity: node.opacity, layoutPositioning: node.layoutPositioning,
    layoutSizingHorizontal: node.layoutSizingHorizontal, layoutSizingVertical: node.layoutSizingVertical,
  };
}

async function paintedProps(node: any, cache: SpecReadCache): Promise<Record<string, unknown>> {
  return {
    width: node.width, height: node.height,
    fillColor: await solidColor(node.fills, cache), strokeColor: await solidColor(node.strokes, cache),
    strokeWeight: notMixed(node.strokeWeight), strokeAlign: node.strokeAlign, effects: readEffects(node.effects),
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

// A node's properties in Spec vocabulary, before normalisation. Null for an
// instance whose main component cannot be found (it cannot be recreated).
export async function readSpecProps(node: any, cache: SpecReadCache): Promise<Record<string, unknown> | null> {
  const type = SPEC_TYPE_OF[node.type];
  switch (type) {
    case "frame":
      return {
        ...common(node, type), ...(await paintedProps(node, cache)),
        cornerRadius: notMixed(node.cornerRadius), clipsContent: node.clipsContent, layoutMode: node.layoutMode,
        layoutWrap: node.layoutWrap, paddingTop: node.paddingTop, paddingRight: node.paddingRight,
        paddingBottom: node.paddingBottom, paddingLeft: node.paddingLeft, primaryAxisAlignItems: node.primaryAxisAlignItems,
        counterAxisAlignItems: node.counterAxisAlignItems, itemSpacing: node.itemSpacing,
        counterAxisSpacing: node.counterAxisSpacing, itemReverseZIndex: node.itemReverseZIndex,
      };
    case "rectangle":
      return { ...common(node, type), ...(await paintedProps(node, cache)), cornerRadius: notMixed(node.cornerRadius) };
    case "vector":
      return { ...common(node, type), ...(await paintedProps(node, cache)), strokeCap: sharedStrokeCap(node), pathData: singlePath(node) };
    case "text": {
      const props: Record<string, unknown> = {
        ...common(node, type), text: node.characters, textAlignHorizontal: node.textAlignHorizontal,
        textAutoResize: node.textAutoResize, width: node.width, effects: readEffects(node.effects),
      };
      // With mixed styles only the text itself is emitted.
      const styles = [node.fontName, node.fontSize, node.fills, node.lineHeight, node.letterSpacing, node.textCase];
      if (styles.some(isMixed)) return props;
      const letterSpacing = node.letterSpacing && node.letterSpacing.unit === "PERCENT" && node.letterSpacing.value === 0
        ? 0 : pixels(node.letterSpacing);
      return {
        ...props, fontFamily: node.fontName && node.fontName.family, fontStyle: node.fontName && node.fontName.style,
        fontSize: node.fontSize, fontColor: await solidColor(node.fills, cache), lineHeight: pixels(node.lineHeight),
        letterSpacing, textCase: node.textCase,
      };
    }
    case "instance": {
      const main: any = await node.getMainComponentAsync();
      if (!main) return null;
      // A local component has no importable key in v1's format, so it is addressed by id.
      const source = main.remote ? { componentKey: main.key } : { componentId: main.id };
      return { ...common(node, type), ...source, properties: flatProperties(node) };
    }
    default:
      return null;
  }
}

function opaqueNode(node: any, truncated: boolean): Record<string, unknown> {
  return { id: node.id, type: OPAQUE_TYPE, name: node.name, nodeType: node.type, ...(truncated ? { truncated: true } : {}) };
}

function countNodes(node: any): number {
  return 1 + (Array.isArray(node.children) ? node.children.reduce((n: number, child: any) => n + countNodes(child), 0) : 0);
}

// export_spec {nodeId, expect, maxNodes, maxDepth}: the subtree as a canonical
// Spec tree (every node with its id). The walk never enters an instance or an
// OpaqueNode; a frame whose children the budget cut off becomes an OpaqueNode
// with truncated: true, so nothing below it can look removed.
export async function exportSpec(params: any) {
  const { nodeId, expect, maxNodes, maxDepth, commandId } = params || {};
  if (!nodeId || typeof nodeId !== "string") throw new Error("Missing nodeId parameter");
  if (nodeId.includes(";")) throw new Error(`Cannot pull ${nodeId}: it is inside an instance. Pull a node outside the instance; instances are exported as leaves.`);
  const { node: root, page, fileKey, fileName } = await resolveSpecTarget(nodeId, expect || {});
  const rootReason = opaqueReason(root);
  if (rootReason) {
    const detail = rootReason === root.type ? root.type : `${root.type}, ${rootReason}`;
    throw new Error(`Cannot pull ${nodeId}: a Spec root must be a frame, text, rectangle, vector or instance without rotation or grid layout (this node: ${detail}).`);
  }

  const walk: WalkOptions = { maxNodes, maxDepth };
  const visited: any[] = [];
  const result = walkTree<any>(root, node => {
    visited.push(node);
    return opaqueReason(node) === null && node.type !== "INSTANCE";
  }, walk);
  const cutOff = new Set(result.truncatedParents);
  if (cutOff.has(root)) throw new Error(`maxNodes/maxDepth are too small to read the children of ${nodeId}.`);

  const total = visited.length;
  const cache = new SpecReadCache();
  let done = 0;
  let opaqueCount = 0;
  if (commandId) await sendProgressUpdate(commandId, "export_spec", "started", 0, total, 0, `Reading ${total} nodes`);

  const build = async (node: any): Promise<Record<string, any>> => {
    done++;
    if (commandId && done % PROGRESS_EVERY === 0) {
      await sendProgressUpdate(commandId, "export_spec", "in_progress", Math.round((done / total) * 100), total, done, `Read ${done}/${total} nodes`);
    }
    const truncated = cutOff.has(node);
    if (truncated || opaqueReason(node)) { opaqueCount++; return opaqueNode(node, truncated); }
    const props = await readSpecProps(node, cache);
    if (!props) { opaqueCount++; return opaqueNode(node, false); }
    const raw: Record<string, any> = { id: node.id, ...props };
    if (raw.type === "frame") {
      raw.children = [];
      for (const child of node.children) raw.children.push(await build(child));
    }
    return raw;
  };
  const rawTree = await build(root);
  const parent = root.parent;
  const tree = normalizeSpecTree(rawTree, { layoutMode: parent && parent.type !== "PAGE" ? parent.layoutMode : undefined });

  if (commandId) await sendProgressUpdate(commandId, "export_spec", "completed", 100, total, done, `Read ${done} nodes`);
  return {
    fileKey, fileName, pageId: page.id, rootId: root.id, rootParentId: parent ? parent.id : null,
    tree, nodeCount: countNodes(tree), opaqueCount, truncated: result.truncated,
  };
}
