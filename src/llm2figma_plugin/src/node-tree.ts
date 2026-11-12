import { loadFontCached, sendProgressUpdate, generateCommandId, resolveColorValue, hexToFigmaColor, getVariableByName, bindVariableToColor, appendOrInsertChild, loadAllFonts, fontWeightToStyle, applyColorPaint, buildFigmaEffects, applyCornerRadii, applyLayoutPositioning, applyImageFill } from './utils';
import { setCharacters } from './text';
import { createFrame, createText, createRectangle } from './creation';
import { createVector, normalizeSvgPath } from './vectors';
import { createComponentInstance, applyTextOverrides } from './components';

function expandRepeats(node: any): any {
  if (!node || typeof node !== "object") return node;

  // If this node has children, process them
  if (node.children && Array.isArray(node.children)) {
    const expandedChildren: any[] = [];
    for (const child of node.children) {
      if (child && child.$repeat) {
        // This is a repeat directive — expand it
        const { data, template } = child.$repeat;
        if (!Array.isArray(data) || !template) continue;
        for (const row of data) {
          const expanded = substituteTemplate(template, row);
          expandedChildren.push(expandRepeats(expanded));
        }
      } else {
        expandedChildren.push(expandRepeats(child));
      }
    }
    return Object.assign({}, node, { children: expandedChildren });
  }

  return node;
}

// Deep-clone a template, substituting $[N] or $key placeholders in string values
function substituteTemplate(template: any, row: any): any {
  if (typeof template === "string") {
    return substituteString(template, row);
  }
  if (Array.isArray(template)) {
    return template.map(item => substituteTemplate(item, row));
  }
  if (template && typeof template === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(template)) {
      result[key] = substituteTemplate(value, row);
    }
    return result;
  }
  return template;
}

function substituteString(str: string, row: any): string {
  if (Array.isArray(row)) {
    // Replace $[0], $[1], etc.
    return str.replace(/\$\[(\d+)\]/g, (match, idx) => {
      const i = parseInt(idx, 10);
      return i < row.length ? String(row[i]) : match;
    });
  }
  if (row && typeof row === "object") {
    // Replace $key patterns — longest keys first to avoid partial matches
    const keys = Object.keys(row).sort((a, b) => b.length - a.length);
    let result = str;
    for (const key of keys) {
      // Replace $key when followed by a non-word char or end of string
      result = result.replace(
        new RegExp("\\$" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=\\W|$)", "g"),
        String(row[key])
      );
    }
    return result;
  }
  return str;
}

// Map of color property names to their Figma setBoundVariable field names
const COLOR_FIELDS: Record<string, string> = {
  fillColor: "fills",
  strokeColor: "strokes",
  fontColor: "fills", // text fill color
};

// State one create_node_tree run (or one spec apply) accumulates across the
// recursive createNode / syncNode calls.
export interface NodeTreeContext {
  counters: { created: number; updated: number; unchanged: number; pruned: number; errors: number };
  errors: any[];
  nodes: any[];
  nodeTypeCounts: Record<string, number>;
  maxDepthSeen: number;
  totalNodes: number;
  firstOnTop: boolean;
  commandId?: string;
  prune?: boolean;
}

export function createNodeTreeContext(options: { totalNodes: number; firstOnTop?: boolean; commandId?: string; prune?: boolean }): NodeTreeContext {
  return {
    counters: { created: 0, updated: 0, unchanged: 0, pruned: 0, errors: 0 },
    errors: [],
    nodes: [],
    nodeTypeCounts: {},
    maxDepthSeen: 0,
    totalNodes: options.totalNodes,
    firstOnTop: options.firstOnTop === undefined ? true : !!options.firstOnTop,
    commandId: options.commandId,
    prune: options.prune,
  };
}

// "remove" deletes a created node whose $var: binding failed (create_node_tree);
// "keep" leaves it, renamed "<name> (failed)", so its id can still be recorded.
export type BindFailure = "remove" | "keep";

// A node createNode made, with the index path of its spec node (children
// indexes from the spec passed in, prefixed by options.path).
export interface CreatedNode {
  path: number[];
  id: string;
  failed?: boolean;
}

export interface ResolvedColors {
  resolved: any;
  bindings: { colorProp: string; figmaField: string; varRef: string }[];
  bind(node: any): Promise<void>;
}

// Resolve colour strings (hex/#RGB, $var:) in a copy of `props` to RGBA objects
// the setters accept, and queue each $var: reference for binding once the node
// exists. A $var: whose first-mode value cannot be read is dropped from the
// copy, so applyColorPaint never sees a "$var:" string. Call bind(node) after
// the write to create the real variable bindings; it throws on a bad ref.
export async function resolveAndBind(props: any): Promise<ResolvedColors> {
  const resolved: any = Object.assign({}, props);
  const bindings: { colorProp: string; figmaField: string; varRef: string }[] = [];
  for (const [colorProp, figmaField] of Object.entries(COLOR_FIELDS)) {
    if (resolved[colorProp] != null) {
      const colorValue = resolveColorValue(resolved[colorProp]);
      if (colorValue.varRef) {
        // For $var: refs, use the first mode's value as the written colour,
        // and queue the binding for after the write
        const variable = await getVariableByName(colorValue.varRef);
        if (variable && variable.resolvedType === "COLOR") {
          const modeIds = Object.keys(variable.valuesByMode);
          if (modeIds.length > 0) {
            const val = variable.valuesByMode[modeIds[0]];
            if (val && typeof val === "object" && "r" in val) {
              resolved[colorProp] = val;
            } else {
              delete resolved[colorProp];
            }
          } else {
            delete resolved[colorProp];
          }
        } else {
          delete resolved[colorProp];
        }
        bindings.push({ colorProp, figmaField, varRef: colorValue.varRef });
      } else if (colorValue.color) {
        resolved[colorProp] = colorValue.color;
      }
    }
  }
  return {
    resolved,
    bindings,
    async bind(node: any) {
      for (const binding of bindings) {
        await bindVariableToColor(node, binding.figmaField, binding.varRef);
      }
    },
  };
}

// Text properties whose setters need the node's font loaded.
const TEXT_FONT_DEPENDENT = ["text", "fontSize", "lineHeight", "letterSpacing", "textCase", "textAlignHorizontal", "width"];

// Update an existing node's properties to match the spec (without creating a new node).
// Colours must already be resolved (see resolveAndBind). With `only`, every
// branch whose spec key is not in the set is skipped: no setter fires for it,
// and the text font is left as it is unless fontFamily, fontStyle or fontWeight
// is named. The size branches run when either width or height is named, and
// still need both in the spec.
export async function updateNodeProperties(existingNode: any, spec: any, only?: Set<string>) {
  const changedProps: string[] = [];
  const type = existingNode.type.toLowerCase();
  const want = (key: string) => !only || only.has(key);

  // --- Common properties for all node types ---
  if (want("name") && spec.name !== undefined && existingNode.name !== spec.name) {
    existingNode.name = spec.name;
    changedProps.push("name");
  }
  if (want("x") && spec.x !== undefined && existingNode.x !== spec.x) {
    existingNode.x = spec.x;
    changedProps.push("x");
  }
  if (want("y") && spec.y !== undefined && existingNode.y !== spec.y) {
    existingNode.y = spec.y;
    changedProps.push("y");
  }
  if (want("opacity") && spec.opacity !== undefined && existingNode.opacity !== spec.opacity) {
    existingNode.opacity = spec.opacity;
    changedProps.push("opacity");
  }
  if (want("effects") && spec.effects !== undefined && "effects" in existingNode) {
    existingNode.effects = buildFigmaEffects(spec.effects);
    changedProps.push("effects");
  }
  if (want("strokeAlign") && spec.strokeAlign !== undefined && "strokeAlign" in existingNode && existingNode.strokeAlign !== spec.strokeAlign) {
    existingNode.strokeAlign = spec.strokeAlign;
    changedProps.push("strokeAlign");
  }
  if (want("layoutPositioning") && spec.layoutPositioning !== undefined && "layoutPositioning" in existingNode && existingNode.layoutPositioning !== spec.layoutPositioning) {
    // ABSOLUTE restores spec x/y; with `only`, only the named ones
    applyLayoutPositioning(existingNode, only ? { layoutPositioning: spec.layoutPositioning, x: want("x") ? spec.x : undefined, y: want("y") ? spec.y : undefined } : spec);
    changedProps.push("layoutPositioning");
  }

  // --- Frame properties ---
  if (type === "frame") {
    if ((want("width") || want("height")) && spec.width !== undefined && spec.height !== undefined) {
      if (existingNode.width !== spec.width || existingNode.height !== spec.height) {
        existingNode.resize(spec.width, spec.height);
        changedProps.push("size");
      }
    }
    if (want("fillColor") && spec.fillColor !== undefined) {
      applyColorPaint(existingNode, "fills", spec.fillColor);
      changedProps.push("fillColor");
    }
    if (want("strokeColor") && spec.strokeColor !== undefined) {
      applyColorPaint(existingNode, "strokes", spec.strokeColor);
      changedProps.push("strokeColor");
    }
    if (want("strokeWeight") && spec.strokeWeight !== undefined && existingNode.strokeWeight !== spec.strokeWeight) {
      existingNode.strokeWeight = spec.strokeWeight;
      changedProps.push("strokeWeight");
    }
    if (want("cornerRadius") && spec.cornerRadius !== undefined && existingNode.cornerRadius !== spec.cornerRadius) {
      existingNode.cornerRadius = spec.cornerRadius;
      changedProps.push("cornerRadius");
    }
    if (want("clipsContent") && spec.clipsContent !== undefined && existingNode.clipsContent !== !!spec.clipsContent) {
      existingNode.clipsContent = !!spec.clipsContent;
      changedProps.push("clipsContent");
    }
    if (want("layoutMode") && spec.layoutMode !== undefined && existingNode.layoutMode !== spec.layoutMode) {
      existingNode.layoutMode = spec.layoutMode;
      changedProps.push("layoutMode");
    }
    if (want("layoutWrap") && spec.layoutWrap !== undefined && existingNode.layoutWrap !== spec.layoutWrap) {
      existingNode.layoutWrap = spec.layoutWrap;
      changedProps.push("layoutWrap");
    }
    if (want("paddingTop") && spec.paddingTop !== undefined && existingNode.paddingTop !== spec.paddingTop) {
      existingNode.paddingTop = spec.paddingTop;
      changedProps.push("paddingTop");
    }
    if (want("paddingRight") && spec.paddingRight !== undefined && existingNode.paddingRight !== spec.paddingRight) {
      existingNode.paddingRight = spec.paddingRight;
      changedProps.push("paddingRight");
    }
    if (want("paddingBottom") && spec.paddingBottom !== undefined && existingNode.paddingBottom !== spec.paddingBottom) {
      existingNode.paddingBottom = spec.paddingBottom;
      changedProps.push("paddingBottom");
    }
    if (want("paddingLeft") && spec.paddingLeft !== undefined && existingNode.paddingLeft !== spec.paddingLeft) {
      existingNode.paddingLeft = spec.paddingLeft;
      changedProps.push("paddingLeft");
    }
    if (want("primaryAxisAlignItems") && spec.primaryAxisAlignItems !== undefined && existingNode.primaryAxisAlignItems !== spec.primaryAxisAlignItems) {
      existingNode.primaryAxisAlignItems = spec.primaryAxisAlignItems;
      changedProps.push("primaryAxisAlignItems");
    }
    if (want("counterAxisAlignItems") && spec.counterAxisAlignItems !== undefined && existingNode.counterAxisAlignItems !== spec.counterAxisAlignItems) {
      existingNode.counterAxisAlignItems = spec.counterAxisAlignItems;
      changedProps.push("counterAxisAlignItems");
    }
    if (want("itemSpacing") && spec.itemSpacing !== undefined && existingNode.itemSpacing !== spec.itemSpacing) {
      existingNode.itemSpacing = spec.itemSpacing;
      changedProps.push("itemSpacing");
    }
    if (want("counterAxisSpacing") && spec.counterAxisSpacing !== undefined && existingNode.counterAxisSpacing !== spec.counterAxisSpacing) {
      existingNode.counterAxisSpacing = spec.counterAxisSpacing;
      changedProps.push("counterAxisSpacing");
    }
    if (want("itemReverseZIndex") && spec.itemReverseZIndex !== undefined && existingNode.itemReverseZIndex !== !!spec.itemReverseZIndex) {
      existingNode.itemReverseZIndex = !!spec.itemReverseZIndex;
      changedProps.push("itemReverseZIndex");
    }
    // Defer FILL sizing — applied after children reconciliation (syncNode)
    if (want("layoutSizingHorizontal") && spec.layoutSizingHorizontal !== undefined && spec.layoutSizingHorizontal !== "FILL") {
      if (existingNode.layoutSizingHorizontal !== spec.layoutSizingHorizontal) {
        existingNode.layoutSizingHorizontal = spec.layoutSizingHorizontal;
        changedProps.push("layoutSizingHorizontal");
      }
    }
    if (want("layoutSizingVertical") && spec.layoutSizingVertical !== undefined && spec.layoutSizingVertical !== "FILL") {
      if (existingNode.layoutSizingVertical !== spec.layoutSizingVertical) {
        existingNode.layoutSizingVertical = spec.layoutSizingVertical;
        changedProps.push("layoutSizingVertical");
      }
    }
  }

  // --- Text properties ---
  if (type === "text") {
    if (want("fontFamily") || want("fontStyle") || want("fontWeight")) {
      const userFontFamily = spec.fontFamily || "Inter";
      const userFontStyle = spec.fontStyle || fontWeightToStyle(spec.fontWeight || 400);
      const currentFontName = existingNode.fontName;

      // Load and set font if changed
      if (!currentFontName || typeof currentFontName === "symbol" ||
          currentFontName.family !== userFontFamily || currentFontName.style !== userFontStyle) {
        try {
          await loadFontCached({ family: userFontFamily, style: userFontStyle });
          existingNode.fontName = { family: userFontFamily, style: userFontStyle };
          changedProps.push("fontName");
        } catch (err) {
          try {
            await loadFontCached({ family: "Inter", style: fontWeightToStyle(spec.fontWeight || 400) });
            existingNode.fontName = { family: "Inter", style: fontWeightToStyle(spec.fontWeight || 400) };
            changedProps.push("fontName");
          } catch (e2) { /* ignore */ }
        }
      } else {
        // Font unchanged, but still need to load it for setText/fontSize changes
        try {
          await loadFontCached({ family: userFontFamily, style: userFontStyle });
        } catch (e) { /* ignore */ }
      }
    } else if (TEXT_FONT_DEPENDENT.some(key => only.has(key))) {
      // Font not named: keep the node's own font(s), loaded for the setters below
      await loadAllFonts(existingNode);
    }

    if (want("text") && spec.text !== undefined && existingNode.characters !== spec.text) {
      await setCharacters(existingNode, spec.text);
      changedProps.push("characters");
    }
    if (want("fontSize") && spec.fontSize !== undefined && existingNode.fontSize !== parseInt(spec.fontSize)) {
      existingNode.fontSize = parseInt(spec.fontSize);
      changedProps.push("fontSize");
    }
    if (want("fontColor") && spec.fontColor !== undefined) {
      applyColorPaint(existingNode, "fills", spec.fontColor);
      changedProps.push("fontColor");
    }
    if (want("textAlignHorizontal") && spec.textAlignHorizontal !== undefined && existingNode.textAlignHorizontal !== spec.textAlignHorizontal) {
      existingNode.textAlignHorizontal = spec.textAlignHorizontal;
      changedProps.push("textAlignHorizontal");
    }
    if (want("lineHeight") && spec.lineHeight !== undefined) {
      existingNode.lineHeight = { value: spec.lineHeight, unit: "PIXELS" };
      changedProps.push("lineHeight");
    }
    if (want("letterSpacing") && spec.letterSpacing !== undefined) {
      existingNode.letterSpacing = { value: spec.letterSpacing, unit: "PIXELS" };
      changedProps.push("letterSpacing");
    }
    if (want("textCase") && spec.textCase !== undefined && existingNode.textCase !== spec.textCase) {
      existingNode.textCase = spec.textCase;
      changedProps.push("textCase");
    }
    if (want("width") && spec.width !== undefined) {
      existingNode.resize(spec.width, existingNode.height);
      existingNode.textAutoResize = "HEIGHT";
      changedProps.push("width");
    }
  }

  // --- Rectangle properties ---
  if (type === "rectangle") {
    if ((want("width") || want("height")) && spec.width !== undefined && spec.height !== undefined) {
      if (existingNode.width !== spec.width || existingNode.height !== spec.height) {
        existingNode.resize(spec.width, spec.height);
        changedProps.push("size");
      }
    }
    if (want("fillColor") && spec.fillColor !== undefined) {
      applyColorPaint(existingNode, "fills", spec.fillColor);
      changedProps.push("fillColor");
    }
    if (want("strokeColor") && spec.strokeColor !== undefined) {
      applyColorPaint(existingNode, "strokes", spec.strokeColor);
      changedProps.push("strokeColor");
    }
    if (want("strokeWeight") && spec.strokeWeight !== undefined && existingNode.strokeWeight !== spec.strokeWeight) {
      existingNode.strokeWeight = spec.strokeWeight;
      changedProps.push("strokeWeight");
    }
    if (want("cornerRadius") && spec.cornerRadius !== undefined && existingNode.cornerRadius !== spec.cornerRadius) {
      existingNode.cornerRadius = spec.cornerRadius;
      changedProps.push("cornerRadius");
    }
  }

  // --- Vector properties ---
  if (type === "vector") {
    if ((want("width") || want("height")) && spec.width !== undefined && spec.height !== undefined) {
      if (existingNode.width !== spec.width || existingNode.height !== spec.height) {
        existingNode.resize(spec.width, spec.height);
        changedProps.push("size");
      }
    }
    if (want("fillColor") && spec.fillColor !== undefined) {
      applyColorPaint(existingNode, "fills", spec.fillColor);
      changedProps.push("fillColor");
    }
    if (want("strokeColor") && spec.strokeColor !== undefined) {
      applyColorPaint(existingNode, "strokes", spec.strokeColor);
      changedProps.push("strokeColor");
    }
    if (want("strokeWeight") && spec.strokeWeight !== undefined && existingNode.strokeWeight !== spec.strokeWeight) {
      existingNode.strokeWeight = spec.strokeWeight;
      changedProps.push("strokeWeight");
    }
    if (want("pathData") && spec.pathData !== undefined) {
      existingNode.vectorPaths = [{ windingRule: "NONZERO", data: normalizeSvgPath(spec.pathData) }];
      changedProps.push("pathData");
    }
    if (want("strokeCap") && spec.strokeCap !== undefined) {
      var network = existingNode.vectorNetwork;
      if (network && network.vertices) {
        var updatedVertices = network.vertices.map(function(v: any) {
          return Object.assign({}, v, { strokeCap: spec.strokeCap });
        });
        existingNode.vectorNetwork = Object.assign({}, network, { vertices: updatedVertices });
        changedProps.push("strokeCap");
      }
    }
  }

  // --- Instance properties ---
  if (type === "instance") {
    if (want("componentKey") && spec.componentKey) {
      const mainComponent = await existingNode.getMainComponentAsync();
      if (!mainComponent || mainComponent.key !== spec.componentKey) {
        const component = await figma.importComponentByKeyAsync(spec.componentKey);
        existingNode.swapComponent(component);
        changedProps.push("componentKey");
      }
    }
    if (want("properties") && spec.properties !== undefined) {
      existingNode.setProperties(spec.properties);
      changedProps.push("properties");
    }
    if (want("textOverrides") && spec.textOverrides !== undefined) {
      await applyTextOverrides(existingNode, spec.textOverrides);
      changedProps.push("textOverrides");
    }
    if (want("layoutSizingHorizontal") && spec.layoutSizingHorizontal !== undefined && existingNode.layoutSizingHorizontal !== spec.layoutSizingHorizontal) {
      try {
        existingNode.layoutSizingHorizontal = spec.layoutSizingHorizontal;
        changedProps.push("layoutSizingHorizontal");
      } catch (e) {
        console.error("Error setting layoutSizingHorizontal during sync:", e);
      }
    }
    if (want("layoutSizingVertical") && spec.layoutSizingVertical !== undefined && existingNode.layoutSizingVertical !== spec.layoutSizingVertical) {
      try {
        existingNode.layoutSizingVertical = spec.layoutSizingVertical;
        changedProps.push("layoutSizingVertical");
      } catch (e) {
        console.error("Error setting layoutSizingVertical during sync:", e);
      }
    }
  }

  var cornerProps = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"];
  for (var ci = 0; ci < cornerProps.length; ci++) {
    var cp = cornerProps[ci];
    if (want(cp) && spec[cp] !== undefined && cp in existingNode && existingNode[cp] !== spec[cp]) {
      existingNode[cp] = spec[cp];
      changedProps.push(cp);
    }
  }
  if (want("fillImage") && spec.fillImage && spec.fillImage.base64 && "fills" in existingNode) {
    applyImageFill(existingNode, spec.fillImage);
    changedProps.push("fillImage");
  }
  return { changed: changedProps.length > 0, changedProps };
}

// Recursive sync: reconcile spec against existing node tree
export async function syncNode(spec: any, existingNode: any, depth: number, ctx: NodeTreeContext) {
  depth = depth || 0;
  if (depth > ctx.maxDepthSeen) ctx.maxDepthSeen = depth;
  var type = spec.type;
  ctx.nodeTypeCounts[type] = (ctx.nodeTypeCounts[type] || 0) + 1;

  // 1. Type check
  if (existingNode.type.toLowerCase() !== type) {
    ctx.counters.errors++;
    ctx.errors.push({
      type,
      name: spec.name || "(unnamed)",
      error: "Type mismatch: spec=" + type + " existing=" + existingNode.type.toLowerCase(),
    });
    return; // skip, don't delete
  }

  // 2. Resolve color strings in a copy of the spec
  var props: any = Object.assign({}, spec);
  delete props.type;
  delete props.children;
  var colors: ResolvedColors;

  try {
    colors = await resolveAndBind(props);

    // 3. Update properties
    var result = await updateNodeProperties(existingNode, colors.resolved);
    if (result.changed) {
      ctx.counters.updated++;
    } else {
      ctx.counters.unchanged++;
    }
  } catch (err: any) {
    ctx.counters.errors++;
    ctx.errors.push({
      type,
      name: spec.name || "(unnamed)",
      error: "Update failed: " + (err.message || String(err)),
    });
    return;
  }

  // 4. Bind $var: references. An unresolvable token now throws, so keep it
  // inside this function's error contract: unwinding here would abandon the
  // run mid-write with nodes already mutated and no ids reported back.
  if (colors.bindings.length > 0) {
    try {
      await colors.bind(existingNode);
    } catch (err: any) {
      ctx.counters.errors++;
      ctx.errors.push({
        type,
        name: spec.name || "(unnamed)",
        nodeId: existingNode.id,
        error: "Variable binding failed: " + (err.message || String(err)),
      });
      return;
    }
  }

  // Track node
  ctx.nodes.push({
    id: existingNode.id,
    name: existingNode.name,
    type,
    parentId: existingNode.parent ? existingNode.parent.id : null,
  });

  // 5. Reconcile children (frames only)
  var specChildren = spec.children;
  if (specChildren && Array.isArray(specChildren) && type === "frame") {
    // Build match map from existing children: "name::type" → [node, ...]
    var existingChildren: any[] = [];
    for (var i = 0; i < existingNode.children.length; i++) {
      existingChildren.push(existingNode.children[i]);
    }
    var matchMap: any = {};
    for (var child of existingChildren) {
      var key = (child.name || "") + "::" + child.type.toLowerCase();
      if (!matchMap[key]) matchMap[key] = [];
      matchMap[key].push(child);
    }

    var matchedExistingIds = new Set();

    for (var specChild of specChildren) {
      var specName = specChild.name || "";
      var specType = specChild.type;
      var matchKey = specName + "::" + specType;

      if (matchMap[matchKey] && matchMap[matchKey].length > 0) {
        // Matched — recurse
        var matchedNode = matchMap[matchKey].shift();
        matchedExistingIds.add(matchedNode.id);
        await syncNode(specChild, matchedNode, depth + 1, ctx);
      } else {
        // Unmatched spec child — create new
        await createNode(specChild, existingNode.id, depth + 1, ctx);
      }
    }

    // Handle unmatched existing children
    if (ctx.prune) {
      for (var existChild of existingChildren) {
        if (!matchedExistingIds.has(existChild.id)) {
          existChild.remove();
          ctx.counters.pruned++;
        }
      }
    }
  }

  // Apply deferred FILL sizing after children reconciliation
  if (type === "frame" && existingNode.layoutMode && existingNode.layoutMode !== "NONE") {
    if (spec.layoutSizingHorizontal === "FILL") {
      try { existingNode.layoutSizingHorizontal = "FILL"; } catch (e) { /* ignore */ }
    }
    if (spec.layoutSizingVertical === "FILL") {
      try { existingNode.layoutSizingVertical = "FILL"; } catch (e) { /* ignore */ }
    }
  }

  // Send progress every 5 nodes
  var processedCount = ctx.counters.updated + ctx.counters.unchanged + ctx.counters.created;
  if (ctx.commandId && processedCount % 5 === 0) {
    var progress = Math.round((processedCount / ctx.totalNodes) * 100);
    await sendProgressUpdate(
      ctx.commandId,
      "create_node_tree",
      "in_progress",
      progress,
      ctx.totalNodes,
      processedCount,
      "Synced " + processedCount + "/" + ctx.totalNodes + " nodes"
    );
  }
}

// Create `spec` and its children under `parentNodeId`. Returns every node it
// created with the index path of its spec node, so ids map back to the spec even
// when an earlier sibling failed.
export async function createNode(
  spec: any,
  parentNodeId: any,
  depth: number,
  ctx: NodeTreeContext,
  options: { onBindFailure?: BindFailure; path?: number[] } = {}
): Promise<CreatedNode[]> {
  const onBindFailure = options.onBindFailure || "remove";
  const path = options.path || [];
  const created: CreatedNode[] = [];
  depth = depth || 0;
  if (depth > ctx.maxDepthSeen) ctx.maxDepthSeen = depth;
  var type = spec.type;
  ctx.nodeTypeCounts[type] = (ctx.nodeTypeCounts[type] || 0) + 1;
  var children = spec.children;
  var props = Object.assign({}, spec);
  delete props.type;
  delete props.children;

  // Resolve color strings (hex/#RGB, $var:) to RGBA objects for create functions;
  // $var: references are bound after node creation
  let colors: ResolvedColors;
  let result: any;
  try {
    colors = await resolveAndBind(Object.assign({}, props, { parentId: parentNodeId }));
    const createParams: any = colors.resolved;

    // Default x/y to 0 if not provided
    if (createParams.x === undefined) createParams.x = 0;
    if (createParams.y === undefined) createParams.y = 0;

    switch (type) {
      case "frame":
        result = await createFrame(createParams, ctx.firstOnTop);
        break;
      case "text":
        result = await createText(createParams);
        break;
      case "rectangle":
        result = await createRectangle(createParams);
        break;
      case "vector":
        result = await createVector(createParams);
        break;
      case "instance":
        result = await createComponentInstance(createParams);
        break;
      default:
        throw new Error(`Unknown node type: ${type}`);
    }
  } catch (err: any) {
    ctx.counters.errors++;
    ctx.errors.push({
      type,
      name: props.name || "(unnamed)",
      error: err.message || String(err),
    });
    // If a frame fails, skip its children
    return created;
  }

  // Bind any $var: references as real Figma variables on the created node.
  // An unresolvable token now throws; keep it inside the error contract so a
  // bad ref costs one node rather than abandoning the tree with the nodes
  // already created and no ids returned to clean them up.
  if (colors.bindings.length > 0) {
    try {
      const node = await figma.getNodeByIdAsync(result.id);
      if (node) await colors.bind(node);
    } catch (err: any) {
      ctx.counters.errors++;
      ctx.errors.push({
        type,
        name: props.name || "(unnamed)",
        nodeId: result.id,
        error: "Variable binding failed: " + (err.message || String(err)),
      });
      const failedNode: any = await figma.getNodeByIdAsync(result.id);
      if (onBindFailure === "keep") {
        if (failedNode) {
          failedNode.name = failedNode.name + " (failed)";
          created.push({ path, id: result.id, failed: true });
        }
      } else if (failedNode) {
        failedNode.remove();
      }
      return created;
    }
  }

  ctx.counters.created++;
  created.push({ path, id: result.id });
  ctx.nodes.push({
    id: result.id,
    name: result.name,
    type,
    parentId: parentNodeId || null,
  });

  // Send progress every 5 nodes
  if (ctx.commandId && ctx.counters.created % 5 === 0) {
    const progress = Math.round((ctx.counters.created / ctx.totalNodes) * 100);
    await sendProgressUpdate(
      ctx.commandId,
      "create_node_tree",
      "in_progress",
      progress,
      ctx.totalNodes,
      ctx.counters.created,
      `Created ${ctx.counters.created}/${ctx.totalNodes} nodes`
    );
  }

  // Recurse into children (only frames should have them)
  if (children && Array.isArray(children)) {
    for (let i = 0; i < children.length; i++) {
      const childCreated = await createNode(children[i], result.id, depth + 1, ctx, { onBindFailure, path: path.concat(i) });
      for (const entry of childCreated) created.push(entry);
    }
  }
  return created;
}

export async function createNodeTree(params: any, firstOnTop: boolean = true) {
  const { tree: rawTree, parentId, rootId, prune, commandId } = params || {};
  if (!rawTree) {
    throw new Error("Missing tree parameter");
  }

  // Expand all $repeat directives into a flat tree before creation
  const tree = expandRepeats(rawTree);

  const startTime = Date.now();

  // Warn if $repeat was used inside a non-auto-layout parent
  function warnRepeatWithoutAutoLayout(node: any, hadRepeat: boolean) {
    if (!node || typeof node !== "object") return;
    if (node.children && Array.isArray(node.children)) {
      var parentHasAutoLayout = node.layoutMode && node.layoutMode !== "NONE";
      if (hadRepeat && !parentHasAutoLayout && node.children.length > 1) {
        console.warn(
          "[create_node_tree] $repeat produced " + node.children.length +
          " children inside frame \"" + (node.name || "unnamed") +
          "\" which has no auto-layout (layoutMode is NONE/missing). " +
          "Children will stack at (0,0). Add layoutMode: \"VERTICAL\" or \"HORIZONTAL\" to fix."
        );
      }
      for (var i = 0; i < node.children.length; i++) {
        warnRepeatWithoutAutoLayout(node.children[i], false);
      }
    }
  }
  // Check if the raw tree had any $repeat directives that were expanded
  function treeHadRepeat(node: any): boolean {
    if (!node || typeof node !== "object") return false;
    if (node.children && Array.isArray(node.children)) {
      for (var i = 0; i < node.children.length; i++) {
        if (node.children[i] && node.children[i].$repeat) return true;
      }
    }
    return false;
  }
  warnRepeatWithoutAutoLayout(tree, treeHadRepeat(rawTree));

  // Pre-count total nodes in the expanded tree
  function countNodes(node: any): number {
    let count = 1;
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        count += countNodes(child);
      }
    }
    return count;
  }

  const totalNodes = countNodes(tree);
  const ctx = createNodeTreeContext({ totalNodes, firstOnTop, commandId, prune });

  // Send initial progress
  if (commandId) {
    await sendProgressUpdate(
      commandId,
      "create_node_tree",
      "started",
      0,
      totalNodes,
      0,
      `Creating node tree with ${totalNodes} nodes`
    );
  }

  if (rootId) {
    // RECONCILE mode — sync existing tree against spec
    const rootNode = await figma.getNodeByIdAsync(rootId);
    if (!rootNode) throw new Error("Root node not found: " + rootId);
    await syncNode(tree, rootNode, 0, ctx);
  } else {
    // CREATE mode (existing behavior)
    await createNode(tree, parentId || null, 0, ctx);
  }

  const { created: createdCount, updated: updatedCount, unchanged: unchangedCount, pruned: prunedCount, errors: errorCount } = ctx.counters;

  // Send completion progress
  if (commandId) {
    var processedTotal = rootId ? (updatedCount + unchangedCount + createdCount) : createdCount;
    var modeLabel = rootId ? "sync" : "create";
    await sendProgressUpdate(
      commandId,
      "create_node_tree",
      "completed",
      100,
      totalNodes,
      processedTotal,
      `Completed (${modeLabel}): ${createdCount} created, ${updatedCount} updated, ${unchangedCount} unchanged, ${prunedCount} pruned, ${errorCount} errors`
    );
  }

  return {
    success: errorCount === 0,
    mode: rootId ? "sync" : "create",
    totalNodes,
    createdCount,
    updatedCount,
    unchangedCount,
    prunedCount,
    errorCount,
    nodes: ctx.nodes,
    errors: ctx.errors.length > 0 ? ctx.errors : undefined,
    stats: {
      durationMs: Date.now() - startTime,
      maxDepth: ctx.maxDepthSeen,
      nodesByType: ctx.nodeTypeCounts,
    },
  };
}
