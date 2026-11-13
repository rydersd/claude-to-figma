import { loadFontCached, sendProgressUpdate, generateCommandId, resolveColorValue, hexToFigmaColor, getVariableByName, bindVariableToColor, appendOrInsertChild, loadAllFonts, fontWeightToStyle, applyColorPaint, buildFigmaEffects, applyCornerRadii, applyLayoutPositioning, applyImageFill } from './utils';
import { setCharacters } from './text';
import { createFrame, createText, createRectangle } from './creation';
import { createVector, normalizeSvgPath } from './vectors';
import { createComponentInstance, applyTextOverrides } from './components';
import { isVarPaint } from '../../shared/spec';

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
  // Command name and interval for the in-progress updates createNode and
  // syncNode send (defaults "create_node_tree" and every 5 nodes).
  progressLabel: string;
  progressEvery: number;
}

export function createNodeTreeContext(options: {
  totalNodes: number; firstOnTop?: boolean; commandId?: string; prune?: boolean; progressLabel?: string; progressEvery?: number;
}): NodeTreeContext {
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
    progressLabel: options.progressLabel || "create_node_tree",
    progressEvery: options.progressEvery && options.progressEvery > 0 ? options.progressEvery : 5,
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
// With `only`, a colour key not in the set is left as it is in the copy: it is
// neither resolved nor bound, so a fill update never rebinds the stroke.
// {"$var": "Collection/Name", "opacity": 0.3} (a Spec's bound paint below full
// opacity) binds like "$var:Collection/Name" and writes the paint at that opacity.
export async function resolveAndBind(props: any, only?: Set<string>): Promise<ResolvedColors> {
  const resolved: any = Object.assign({}, props);
  const bindings: { colorProp: string; figmaField: string; varRef: string }[] = [];
  for (const [colorProp, figmaField] of Object.entries(COLOR_FIELDS)) {
    if (only && !only.has(colorProp)) continue;
    if (resolved[colorProp] != null) {
      const varPaint = isVarPaint(resolved[colorProp]) ? resolved[colorProp] : null;
      const colorValue = varPaint
        ? { color: null, varRef: varPaint.$var.startsWith("$var:") ? varPaint.$var.slice(5) : varPaint.$var }
        : resolveColorValue(resolved[colorProp]);
      if (colorValue.varRef) {
        // For $var: refs, use the first mode's value as the written colour,
        // and queue the binding for after the write
        const variable = await getVariableByName(colorValue.varRef);
        if (variable && variable.resolvedType === "COLOR") {
          const modeIds = Object.keys(variable.valuesByMode);
          if (modeIds.length > 0) {
            const val = variable.valuesByMode[modeIds[0]];
            if (val && typeof val === "object" && "r" in val) {
              resolved[colorProp] = varPaint && varPaint.opacity !== undefined ? Object.assign({}, val, { a: Number(varPaint.opacity) }) : val;
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

// A local component (or component set) by node id, for a swap.
async function localComponent(id: string, type: "COMPONENT" | "COMPONENT_SET"): Promise<any> {
  const node: any = await figma.getNodeByIdAsync(id);
  if (!node || node.type !== type) throw new Error(`Node ${id} is not a ${type}`);
  return node;
}

// Text properties whose setters need the node's font loaded.
const TEXT_FONT_DEPENDENT = ["text", "fontSize", "lineHeight", "letterSpacing", "textCase", "textAlignHorizontal", "width",
  "height", "textAutoResize", "layoutSizingHorizontal", "layoutSizingVertical"];

export interface UpdateResult {
  changed: boolean;
  changedProps: string[];
  // Keys of `only` no branch consumed for this node type (always [] without
  // `only`). FILL sizing on a frame is left here: apply it with applyDeferredFill.
  unhandled: string[];
}

// Update an existing node's properties to match the spec (without creating a new node).
// Colours must already be resolved (see resolveAndBind). With `only`, every
// branch whose spec key is not in the set is skipped: no setter fires for it,
// and the text font is left as it is unless fontFamily, fontStyle or fontWeight
// is named; a named font part missing from `only` is taken from the node's
// live fontName. The size branches run when either width or height is named,
// and still need both in the spec. textAutoResize, and layoutSizing* on text,
// rectangle and vector nodes, are written only when named in `only`.
export async function updateNodeProperties(existingNode: any, spec: any, only?: Set<string>): Promise<UpdateResult> {
  const changedProps: string[] = [];
  const type = existingNode.type.toLowerCase();
  const consumed = new Set<string>();
  const want = (key: string) => {
    if (!only) return true;
    if (!only.has(key)) return false;
    consumed.add(key);
    return true;
  };
  // Every key is checked (no short-circuit), so each named one is consumed.
  const wantAny = (...keys: string[]) => keys.map(want).some(Boolean);
  // layoutSizing* on a node with no children: nothing to defer, so set it now
  const setSizing = (key: string) => {
    if (only && want(key) && spec[key] !== undefined && existingNode[key] !== spec[key]) {
      try {
        existingNode[key] = spec[key];
        changedProps.push(key);
      } catch (e) {
        console.error("Error setting " + key + " during update:", e);
      }
    }
  };

  // --- Common properties for all node types ---
  // Prototype reactions first: if Figma rejects them, nothing else was written.
  if (typeof existingNode.setReactionsAsync === "function" && want("reactions") && Array.isArray(spec.reactions)) {
    await existingNode.setReactionsAsync(spec.reactions);
    changedProps.push("reactions");
  }
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
  if (want("visible") && spec.visible !== undefined && existingNode.visible !== !!spec.visible) {
    existingNode.visible = !!spec.visible;
    changedProps.push("visible");
  }
  if ("effects" in existingNode && want("effects") && spec.effects !== undefined) {
    existingNode.effects = buildFigmaEffects(spec.effects);
    changedProps.push("effects");
  }
  if ("strokeAlign" in existingNode && want("strokeAlign") && spec.strokeAlign !== undefined && existingNode.strokeAlign !== spec.strokeAlign) {
    existingNode.strokeAlign = spec.strokeAlign;
    changedProps.push("strokeAlign");
  }
  if ("layoutPositioning" in existingNode && want("layoutPositioning") && spec.layoutPositioning !== undefined && existingNode.layoutPositioning !== spec.layoutPositioning) {
    // ABSOLUTE restores spec x/y; with `only`, only the named ones
    applyLayoutPositioning(existingNode, only ? { layoutPositioning: spec.layoutPositioning, x: want("x") ? spec.x : undefined, y: want("y") ? spec.y : undefined } : spec);
    changedProps.push("layoutPositioning");
  }

  // --- Frame properties ---
  if (type === "frame") {
    if (wantAny("width", "height") && spec.width !== undefined && spec.height !== undefined) {
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
    // Defer FILL sizing — applied after children reconciliation (applyDeferredFill)
    if (spec.layoutSizingHorizontal !== "FILL" && want("layoutSizingHorizontal") && spec.layoutSizingHorizontal !== undefined) {
      if (existingNode.layoutSizingHorizontal !== spec.layoutSizingHorizontal) {
        existingNode.layoutSizingHorizontal = spec.layoutSizingHorizontal;
        changedProps.push("layoutSizingHorizontal");
      }
    }
    if (spec.layoutSizingVertical !== "FILL" && want("layoutSizingVertical") && spec.layoutSizingVertical !== undefined) {
      if (existingNode.layoutSizingVertical !== spec.layoutSizingVertical) {
        existingNode.layoutSizingVertical = spec.layoutSizingVertical;
        changedProps.push("layoutSizingVertical");
      }
    }
  }

  // --- Text properties ---
  if (type === "text") {
    if (wantAny("fontFamily", "fontStyle", "fontWeight")) {
      const currentFontName = existingNode.fontName;
      let userFontFamily = spec.fontFamily || "Inter";
      let userFontStyle = spec.fontStyle || fontWeightToStyle(spec.fontWeight || 400);
      if (only && currentFontName && typeof currentFontName !== "symbol") {
        // Change only the named part(s); the rest comes from the live font
        userFontFamily = only.has("fontFamily") && spec.fontFamily ? spec.fontFamily : currentFontName.family;
        userFontStyle = only.has("fontStyle") && spec.fontStyle ? spec.fontStyle
          : only.has("fontWeight") && spec.fontWeight ? fontWeightToStyle(spec.fontWeight)
          : currentFontName.style;
      }

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
    const fixedBox = spec.textAutoResize === "NONE" || spec.textAutoResize === "TRUNCATE";
    if (only && fixedBox && (only.has("width") || only.has("height"))) {
      // A fixed text box (NONE / TRUNCATE): width and height, the box kept as it is
      wantAny("width", "height");
      const w = spec.width !== undefined ? spec.width : existingNode.width;
      const h = spec.height !== undefined ? spec.height : existingNode.height;
      if (existingNode.width !== w || existingNode.height !== h) {
        existingNode.resize(w, h);
        changedProps.push("size");
      }
      if (existingNode.textAutoResize !== spec.textAutoResize) existingNode.textAutoResize = spec.textAutoResize;
    } else if (want("width") && spec.width !== undefined) {
      existingNode.resize(spec.width, existingNode.height);
      existingNode.textAutoResize = "HEIGHT";
      changedProps.push("width");
    }
    setSizing("layoutSizingHorizontal");
    setSizing("layoutSizingVertical");
    if (only && want("textAutoResize") && spec.textAutoResize !== undefined && existingNode.textAutoResize !== spec.textAutoResize) {
      existingNode.textAutoResize = spec.textAutoResize;
      changedProps.push("textAutoResize");
    }
  }

  // --- Rectangle properties ---
  if (type === "rectangle") {
    if (wantAny("width", "height") && spec.width !== undefined && spec.height !== undefined) {
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
    setSizing("layoutSizingHorizontal");
    setSizing("layoutSizingVertical");
  }

  // --- Vector properties ---
  if (type === "vector") {
    if (wantAny("width", "height") && spec.width !== undefined && spec.height !== undefined) {
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
        if (only && typeof existingNode.setVectorNetworkAsync === "function") {
          // The vectorNetwork setter is not available with dynamic-page access;
          // the spec path writes through setVectorNetworkAsync. create_node_tree's
          // sync mode (no `only`) keeps its old assignment.
          await existingNode.setVectorNetworkAsync(Object.assign({}, network, { vertices: updatedVertices }));
        } else {
          existingNode.vectorNetwork = Object.assign({}, network, { vertices: updatedVertices });
        }
        changedProps.push("strokeCap");
      }
    }
    setSizing("layoutSizingHorizontal");
    setSizing("layoutSizingVertical");
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
    if (want("componentId") && spec.componentId) {
      const mainComponent = await existingNode.getMainComponentAsync();
      if (!mainComponent || mainComponent.id !== spec.componentId) {
        existingNode.swapComponent(await localComponent(spec.componentId, "COMPONENT"));
        changedProps.push("componentId");
      }
    }
    // A variant is named by its set: swap only when the instance is in another
    // set, to the set's default variant; `properties` then picks the variant.
    if (wantAny("componentSetKey", "componentSetId") && (spec.componentSetKey || spec.componentSetId)) {
      const mainComponent = await existingNode.getMainComponentAsync();
      const set = mainComponent && mainComponent.parent && mainComponent.parent.type === "COMPONENT_SET" ? mainComponent.parent : null;
      const same = set && (spec.componentSetKey ? set.key === spec.componentSetKey : set.id === spec.componentSetId);
      if (!same) {
        const target = spec.componentSetKey
          ? await (figma as any).importComponentSetByKeyAsync(spec.componentSetKey)
          : await localComponent(spec.componentSetId, "COMPONENT_SET");
        existingNode.swapComponent(target.defaultVariant);
        changedProps.push(spec.componentSetKey ? "componentSetKey" : "componentSetId");
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
    // After the swap and properties, which can reset an instance's size; a
    // missing dimension keeps the live one.
    if (wantAny("width", "height") && (spec.width !== undefined || spec.height !== undefined)) {
      const w = spec.width !== undefined ? spec.width : existingNode.width;
      const h = spec.height !== undefined ? spec.height : existingNode.height;
      if (existingNode.width !== w || existingNode.height !== h) {
        existingNode.resize(w, h);
        changedProps.push("size");
      }
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
    if (cp in existingNode && want(cp) && spec[cp] !== undefined && existingNode[cp] !== spec[cp]) {
      existingNode[cp] = spec[cp];
      changedProps.push(cp);
    }
  }
  if ("fills" in existingNode && want("fillImage") && spec.fillImage && spec.fillImage.base64) {
    applyImageFill(existingNode, spec.fillImage);
    changedProps.push("fillImage");
  }
  const unhandled = only ? Array.from(only).filter(key => !consumed.has(key)) : [];
  return { changed: changedProps.length > 0, changedProps, unhandled };
}

// FILL sizing on an auto-layout frame, set after its children exist (syncNode
// runs it after reconciling children). With `only`, an axis not named is
// skipped. A setter that throws is ignored, as before. Returns the axes set.
// With {checkParent: true} (the spec path, and createNode for a frame without
// auto-layout of its own) the test is the one Figma applies: FILL needs an
// auto-layout PARENT, whatever the frame's own layoutMode; an axis already FILL
// is not written again. Without it, today's test (the frame's own layoutMode)
// is kept.
export function applyDeferredFill(node: any, spec: any, only?: Set<string>, options: { checkParent?: boolean } = {}): string[] {
  const applied: string[] = [];
  if (node.type !== "FRAME") return applied;
  if (options.checkParent) {
    const parent = node.parent;
    if (!parent || !parent.layoutMode || parent.layoutMode === "NONE" || parent.layoutMode === "GRID") return applied;
  } else if (!node.layoutMode || node.layoutMode === "NONE") {
    return applied;
  }
  for (const key of ["layoutSizingHorizontal", "layoutSizingVertical"]) {
    if (options.checkParent && node[key] === "FILL") continue;
    if ((!only || only.has(key)) && spec[key] === "FILL") {
      try {
        node[key] = "FILL";
        applied.push(key);
      } catch (e) { /* ignore */ }
    }
  }
  return applied;
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
  applyDeferredFill(existingNode, spec);

  // Send progress every ctx.progressEvery nodes
  var processedCount = ctx.counters.updated + ctx.counters.unchanged + ctx.counters.created;
  if (ctx.commandId && processedCount % ctx.progressEvery === 0) {
    var progress = Math.round((processedCount / ctx.totalNodes) * 100);
    await sendProgressUpdate(
      ctx.commandId,
      ctx.progressLabel,
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
// when an earlier sibling failed. When `path` is passed, every ctx.errors entry
// this call (and its recursion) adds carries the spec node's `path`, and with
// onBindFailure "keep" each child skipped under a failed node is reported as
// {path, error: "skipped: parent failed"}. Without `path` the error entries are
// exactly create_node_tree's.
export async function createNode(
  spec: any,
  parentNodeId: any,
  depth: number,
  ctx: NodeTreeContext,
  options: { onBindFailure?: BindFailure; path?: number[] } = {}
): Promise<CreatedNode[]> {
  if (options.onBindFailure !== undefined && options.onBindFailure !== "remove" && options.onBindFailure !== "keep") {
    throw new Error('onBindFailure must be "remove" or "keep", got ' + JSON.stringify(options.onBindFailure));
  }
  return createNodeAt(spec, parentNodeId, depth, ctx, options.onBindFailure || "remove", options.path || [], options.path !== undefined);
}

// Report every descendant of a failed node as skipped (keep mode only).
function reportSkippedChildren(children: any, path: number[], ctx: NodeTreeContext) {
  if (!children || !Array.isArray(children)) return;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] || {};
    const childPath = path.concat(i);
    ctx.counters.errors++;
    ctx.errors.push({ type: child.type, name: child.name || "(unnamed)", path: childPath, error: "skipped: parent failed" });
    reportSkippedChildren(child.children, childPath, ctx);
  }
}

async function createNodeAt(
  spec: any,
  parentNodeId: any,
  depth: number,
  ctx: NodeTreeContext,
  onBindFailure: BindFailure,
  path: number[],
  reportPaths: boolean
): Promise<CreatedNode[]> {
  const created: CreatedNode[] = [];
  const withPath = (entry: any) => reportPaths ? Object.assign(entry, { path }) : entry;
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
    ctx.errors.push(withPath({
      type,
      name: props.name || "(unnamed)",
      error: err.message || String(err),
    }));
    // If a frame fails, skip its children
    if (onBindFailure === "keep") reportSkippedChildren(children, path, ctx);
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
      ctx.errors.push(withPath({
        type,
        name: props.name || "(unnamed)",
        nodeId: result.id,
        error: "Variable binding failed: " + (err.message || String(err)),
      }));
      const failedNode: any = await figma.getNodeByIdAsync(result.id);
      if (onBindFailure === "keep") {
        if (failedNode) {
          failedNode.name = failedNode.name + " (failed)";
          created.push({ path, id: result.id, failed: true });
        }
        reportSkippedChildren(children, path, ctx);
      } else if (failedNode) {
        failedNode.remove();
      }
      return created;
    }
  }

  // Properties the per-type create functions do not take: visibility, and FILL
  // on a frame without auto-layout of its own inside an auto-layout parent.
  const noOwnLayout = type === "frame" && (!props.layoutMode || props.layoutMode === "NONE");
  const fillsParent = noOwnLayout && (props.layoutSizingHorizontal === "FILL" || props.layoutSizingVertical === "FILL");
  if (props.visible !== undefined || fillsParent) {
    const node: any = await figma.getNodeByIdAsync(result.id);
    if (node && fillsParent) applyDeferredFill(node, props, undefined, { checkParent: true });
    if (node && props.visible !== undefined) node.visible = !!props.visible;
  }
  // Prototype reactions (spec sync; create_node_tree's schema has no such key).
  // The node is kept when Figma rejects them, and the error reported.
  if (Array.isArray(props.reactions) && props.reactions.length) {
    try {
      const node: any = await figma.getNodeByIdAsync(result.id);
      if (node) await node.setReactionsAsync(props.reactions);
    } catch (err: any) {
      ctx.counters.errors++;
      ctx.errors.push(withPath({ type, name: props.name || "(unnamed)", nodeId: result.id, error: "Reactions not set: " + (err.message || String(err)) }));
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

  // Send progress every ctx.progressEvery nodes
  if (ctx.commandId && ctx.counters.created % ctx.progressEvery === 0) {
    const progress = Math.round((ctx.counters.created / ctx.totalNodes) * 100);
    await sendProgressUpdate(
      ctx.commandId,
      ctx.progressLabel,
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
      const childCreated = await createNodeAt(children[i], result.id, depth + 1, ctx, onBindFailure, path.concat(i), reportPaths);
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
