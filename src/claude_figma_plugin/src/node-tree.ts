import { sendProgressUpdate, generateCommandId, resolveColorValue, hexToFigmaColor, getVariableByName, bindVariableToColor, appendOrInsertChild, loadAllFonts } from './utils';
import { setCharacters } from './text';
import { createFrame, createText, createRectangle } from './creation';
import { createVector, normalizeSvgPath } from './vectors';

export function expandRepeats(node: any): any {
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
export function substituteTemplate(template: any, row: any): any {
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

export function substituteString(str: string, row: any): string {
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

export async function createNodeTree(params: any, firstOnTop: boolean = true) {
  const { tree: rawTree, parentId, rootId, prune, commandId } = params || {};
  if (!rawTree) {
    throw new Error("Missing tree parameter");
  }

  // Expand all $repeat directives into a flat tree before creation
  const tree = expandRepeats(rawTree);

  const startTime = Date.now();
  let maxDepthSeen = 0;
  const nodeTypeCounts: any = {};

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
  let createdCount = 0;
  let errorCount = 0;
  const nodes: any[] = [];
  const errors: any[] = [];

  // Map of color property names to their Figma setBoundVariable field names
  const COLOR_FIELDS: Record<string, string> = {
    fillColor: "fills",
    strokeColor: "strokes",
    fontColor: "fills", // text fill color
  };

  // --- Sync/reconciliation helpers ---

  // Map font weight number to Figma font style string (sync/reconcile path).
  // NOTE: Duplicates getFontStyle() inside createText(). Both must stay in sync
  // until code.js is refactored to hoist a single shared helper to module scope.
  function syncWeightToStyle(weight: number): string {
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

  // Apply a solid color paint to a node property (fills or strokes)
  function applyColorPaint(node: any, field: string, colorObj: any) {
    if (colorObj.a !== undefined && parseFloat(colorObj.a) === 0) {
      node[field] = [];
    } else {
      node[field] = [{
        type: "SOLID",
        color: {
          r: parseFloat(colorObj.r) || 0,
          g: parseFloat(colorObj.g) || 0,
          b: parseFloat(colorObj.b) || 0,
        },
        opacity: colorObj.a !== undefined ? parseFloat(colorObj.a) : 1,
      }];
    }
  }

  // Update an existing node's properties to match the spec (without creating a new node)
  async function updateNodeProperties(existingNode: any, spec: any) {
    const changedProps: string[] = [];
    const type = existingNode.type.toLowerCase();

    // --- Common properties for all node types ---
    if (spec.name !== undefined && existingNode.name !== spec.name) {
      existingNode.name = spec.name;
      changedProps.push("name");
    }
    if (spec.x !== undefined && existingNode.x !== spec.x) {
      existingNode.x = spec.x;
      changedProps.push("x");
    }
    if (spec.y !== undefined && existingNode.y !== spec.y) {
      existingNode.y = spec.y;
      changedProps.push("y");
    }
    if (spec.opacity !== undefined && existingNode.opacity !== spec.opacity) {
      existingNode.opacity = spec.opacity;
      changedProps.push("opacity");
    }

    // --- Frame properties ---
    if (type === "frame") {
      if (spec.width !== undefined && spec.height !== undefined) {
        if (existingNode.width !== spec.width || existingNode.height !== spec.height) {
          existingNode.resize(spec.width, spec.height);
          changedProps.push("size");
        }
      }
      if (spec.fillColor !== undefined) {
        applyColorPaint(existingNode, "fills", spec.fillColor);
        changedProps.push("fillColor");
      }
      if (spec.strokeColor !== undefined) {
        applyColorPaint(existingNode, "strokes", spec.strokeColor);
        changedProps.push("strokeColor");
      }
      if (spec.strokeWeight !== undefined && existingNode.strokeWeight !== spec.strokeWeight) {
        existingNode.strokeWeight = spec.strokeWeight;
        changedProps.push("strokeWeight");
      }
      if (spec.cornerRadius !== undefined && existingNode.cornerRadius !== spec.cornerRadius) {
        existingNode.cornerRadius = spec.cornerRadius;
        changedProps.push("cornerRadius");
      }
      if (spec.clipsContent !== undefined && existingNode.clipsContent !== !!spec.clipsContent) {
        existingNode.clipsContent = !!spec.clipsContent;
        changedProps.push("clipsContent");
      }
      if (spec.layoutMode !== undefined && existingNode.layoutMode !== spec.layoutMode) {
        existingNode.layoutMode = spec.layoutMode;
        changedProps.push("layoutMode");
      }
      if (spec.layoutWrap !== undefined && existingNode.layoutWrap !== spec.layoutWrap) {
        existingNode.layoutWrap = spec.layoutWrap;
        changedProps.push("layoutWrap");
      }
      if (spec.paddingTop !== undefined && existingNode.paddingTop !== spec.paddingTop) {
        existingNode.paddingTop = spec.paddingTop;
        changedProps.push("paddingTop");
      }
      if (spec.paddingRight !== undefined && existingNode.paddingRight !== spec.paddingRight) {
        existingNode.paddingRight = spec.paddingRight;
        changedProps.push("paddingRight");
      }
      if (spec.paddingBottom !== undefined && existingNode.paddingBottom !== spec.paddingBottom) {
        existingNode.paddingBottom = spec.paddingBottom;
        changedProps.push("paddingBottom");
      }
      if (spec.paddingLeft !== undefined && existingNode.paddingLeft !== spec.paddingLeft) {
        existingNode.paddingLeft = spec.paddingLeft;
        changedProps.push("paddingLeft");
      }
      if (spec.primaryAxisAlignItems !== undefined && existingNode.primaryAxisAlignItems !== spec.primaryAxisAlignItems) {
        existingNode.primaryAxisAlignItems = spec.primaryAxisAlignItems;
        changedProps.push("primaryAxisAlignItems");
      }
      if (spec.counterAxisAlignItems !== undefined && existingNode.counterAxisAlignItems !== spec.counterAxisAlignItems) {
        existingNode.counterAxisAlignItems = spec.counterAxisAlignItems;
        changedProps.push("counterAxisAlignItems");
      }
      if (spec.itemSpacing !== undefined && existingNode.itemSpacing !== spec.itemSpacing) {
        existingNode.itemSpacing = spec.itemSpacing;
        changedProps.push("itemSpacing");
      }
      if (spec.counterAxisSpacing !== undefined && existingNode.counterAxisSpacing !== spec.counterAxisSpacing) {
        existingNode.counterAxisSpacing = spec.counterAxisSpacing;
        changedProps.push("counterAxisSpacing");
      }
      if (spec.itemReverseZIndex !== undefined && existingNode.itemReverseZIndex !== !!spec.itemReverseZIndex) {
        existingNode.itemReverseZIndex = !!spec.itemReverseZIndex;
        changedProps.push("itemReverseZIndex");
      }
      // Defer FILL sizing — applied after children reconciliation
      if (spec.layoutSizingHorizontal !== undefined && spec.layoutSizingHorizontal !== "FILL") {
        if (existingNode.layoutSizingHorizontal !== spec.layoutSizingHorizontal) {
          existingNode.layoutSizingHorizontal = spec.layoutSizingHorizontal;
          changedProps.push("layoutSizingHorizontal");
        }
      }
      if (spec.layoutSizingVertical !== undefined && spec.layoutSizingVertical !== "FILL") {
        if (existingNode.layoutSizingVertical !== spec.layoutSizingVertical) {
          existingNode.layoutSizingVertical = spec.layoutSizingVertical;
          changedProps.push("layoutSizingVertical");
        }
      }
    }

    // --- Text properties ---
    if (type === "text") {
      const userFontFamily = spec.fontFamily || "Inter";
      const userFontStyle = spec.fontStyle || syncWeightToStyle(spec.fontWeight || 400);
      const currentFontName = existingNode.fontName;

      // Load and set font if changed
      if (!currentFontName || typeof currentFontName === "symbol" ||
          currentFontName.family !== userFontFamily || currentFontName.style !== userFontStyle) {
        try {
          await figma.loadFontAsync({ family: userFontFamily, style: userFontStyle });
          existingNode.fontName = { family: userFontFamily, style: userFontStyle };
          changedProps.push("fontName");
        } catch (err) {
          try {
            await figma.loadFontAsync({ family: "Inter", style: syncWeightToStyle(spec.fontWeight || 400) });
            existingNode.fontName = { family: "Inter", style: syncWeightToStyle(spec.fontWeight || 400) };
            changedProps.push("fontName");
          } catch (e2) { /* ignore */ }
        }
      } else {
        // Font unchanged, but still need to load it for setText/fontSize changes
        try {
          await figma.loadFontAsync({ family: userFontFamily, style: userFontStyle });
        } catch (e) { /* ignore */ }
      }

      if (spec.text !== undefined && existingNode.characters !== spec.text) {
        setCharacters(existingNode, spec.text);
        changedProps.push("characters");
      }
      if (spec.fontSize !== undefined && existingNode.fontSize !== parseInt(spec.fontSize)) {
        existingNode.fontSize = parseInt(spec.fontSize);
        changedProps.push("fontSize");
      }
      if (spec.fontColor !== undefined) {
        applyColorPaint(existingNode, "fills", spec.fontColor);
        changedProps.push("fontColor");
      }
      if (spec.textAlignHorizontal !== undefined && existingNode.textAlignHorizontal !== spec.textAlignHorizontal) {
        existingNode.textAlignHorizontal = spec.textAlignHorizontal;
        changedProps.push("textAlignHorizontal");
      }
      if (spec.lineHeight !== undefined) {
        existingNode.lineHeight = { value: spec.lineHeight, unit: "PIXELS" };
        changedProps.push("lineHeight");
      }
      if (spec.letterSpacing !== undefined) {
        existingNode.letterSpacing = { value: spec.letterSpacing, unit: "PIXELS" };
        changedProps.push("letterSpacing");
      }
      if (spec.textCase !== undefined && existingNode.textCase !== spec.textCase) {
        existingNode.textCase = spec.textCase;
        changedProps.push("textCase");
      }
      if (spec.width !== undefined) {
        existingNode.resize(spec.width, existingNode.height);
        existingNode.textAutoResize = "HEIGHT";
        changedProps.push("width");
      }
    }

    // --- Rectangle properties ---
    if (type === "rectangle") {
      if (spec.width !== undefined && spec.height !== undefined) {
        if (existingNode.width !== spec.width || existingNode.height !== spec.height) {
          existingNode.resize(spec.width, spec.height);
          changedProps.push("size");
        }
      }
      if (spec.fillColor !== undefined) {
        applyColorPaint(existingNode, "fills", spec.fillColor);
        changedProps.push("fillColor");
      }
      if (spec.strokeColor !== undefined) {
        applyColorPaint(existingNode, "strokes", spec.strokeColor);
        changedProps.push("strokeColor");
      }
      if (spec.strokeWeight !== undefined && existingNode.strokeWeight !== spec.strokeWeight) {
        existingNode.strokeWeight = spec.strokeWeight;
        changedProps.push("strokeWeight");
      }
      if (spec.cornerRadius !== undefined && existingNode.cornerRadius !== spec.cornerRadius) {
        existingNode.cornerRadius = spec.cornerRadius;
        changedProps.push("cornerRadius");
      }
    }

    // --- Vector properties ---
    if (type === "vector") {
      if (spec.width !== undefined && spec.height !== undefined) {
        if (existingNode.width !== spec.width || existingNode.height !== spec.height) {
          existingNode.resize(spec.width, spec.height);
          changedProps.push("size");
        }
      }
      if (spec.fillColor !== undefined) {
        applyColorPaint(existingNode, "fills", spec.fillColor);
        changedProps.push("fillColor");
      }
      if (spec.strokeColor !== undefined) {
        applyColorPaint(existingNode, "strokes", spec.strokeColor);
        changedProps.push("strokeColor");
      }
      if (spec.strokeWeight !== undefined && existingNode.strokeWeight !== spec.strokeWeight) {
        existingNode.strokeWeight = spec.strokeWeight;
        changedProps.push("strokeWeight");
      }
      if (spec.pathData !== undefined) {
        existingNode.vectorPaths = [{ windingRule: "NONZERO", data: normalizeSvgPath(spec.pathData) }];
        changedProps.push("pathData");
      }
      if (spec.strokeCap !== undefined) {
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

    return { changed: changedProps.length > 0, changedProps };
  }

  // Recursive sync: reconcile spec against existing node tree
  let updatedCount = 0;
  let unchangedCount = 0;
  let prunedCount = 0;

  async function syncNode(spec: any, existingNode: any, depth: number) {
    depth = depth || 0;
    if (depth > maxDepthSeen) maxDepthSeen = depth;
    var type = spec.type;
    nodeTypeCounts[type] = (nodeTypeCounts[type] || 0) + 1;

    // 1. Type check
    if (existingNode.type.toLowerCase() !== type) {
      errors.push({
        type,
        name: spec.name || "(unnamed)",
        error: "Type mismatch: spec=" + type + " existing=" + existingNode.type.toLowerCase(),
      });
      return; // skip, don't delete
    }

    // 2. Resolve color strings in a copy of the spec
    var resolvedSpec: any = Object.assign({}, spec);
    delete resolvedSpec.type;
    delete resolvedSpec.children;
    var pendingVarBindings: any[] = [];

    for (var _ref of Object.entries(COLOR_FIELDS)) {
      var colorProp = _ref[0], figmaField = _ref[1];
      if (resolvedSpec[colorProp] != null) {
        var resolved = resolveColorValue(resolvedSpec[colorProp]);
        if (resolved.varRef) {
          var variable = await getVariableByName(resolved.varRef);
          if (variable && variable.resolvedType === "COLOR") {
            var modeIds = Object.keys(variable.valuesByMode);
            if (modeIds.length > 0) {
              var val = variable.valuesByMode[modeIds[0]];
              if (val && typeof val === "object" && "r" in val) {
                resolvedSpec[colorProp] = val;
              } else {
                delete resolvedSpec[colorProp];
              }
            } else {
              delete resolvedSpec[colorProp];
            }
          } else {
            delete resolvedSpec[colorProp];
          }
          pendingVarBindings.push({ colorProp: colorProp, figmaField: figmaField, varRef: resolved.varRef });
        } else if (resolved.color) {
          resolvedSpec[colorProp] = resolved.color;
        }
      }
    }

    // 3. Update properties
    try {
      var result = await updateNodeProperties(existingNode, resolvedSpec);
      if (result.changed) {
        updatedCount++;
      } else {
        unchangedCount++;
      }
    } catch (err: any) {
      errorCount++;
      errors.push({
        type,
        name: spec.name || "(unnamed)",
        error: "Update failed: " + (err.message || String(err)),
      });
      return;
    }

    // 4. Bind $var: references
    if (pendingVarBindings.length > 0) {
      for (var binding of pendingVarBindings) {
        await bindVariableToColor(existingNode, binding.figmaField, binding.varRef);
      }
    }

    // Track node
    nodes.push({
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
          await syncNode(specChild, matchedNode, depth + 1);
        } else {
          // Unmatched spec child — create new
          await createNode(specChild, existingNode.id, depth + 1);
        }
      }

      // Handle unmatched existing children
      if (prune) {
        for (var existChild of existingChildren) {
          if (!matchedExistingIds.has(existChild.id)) {
            existChild.remove();
            prunedCount++;
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
    var processedCount = updatedCount + unchangedCount + createdCount;
    if (commandId && processedCount % 5 === 0) {
      var progress = Math.round((processedCount / totalNodes) * 100);
      await sendProgressUpdate(
        commandId,
        "create_node_tree",
        "in_progress",
        progress,
        totalNodes,
        processedCount,
        "Synced " + processedCount + "/" + totalNodes + " nodes"
      );
    }
  }

  async function createNode(spec: any, parentNodeId: any, depth: number) {
    depth = depth || 0;
    if (depth > maxDepthSeen) maxDepthSeen = depth;
    var type = spec.type;
    nodeTypeCounts[type] = (nodeTypeCounts[type] || 0) + 1;
    var children = spec.children;
    var props = Object.assign({}, spec);
    delete props.type;
    delete props.children;

    // Resolve color strings (hex/#RGB, $var:) to RGBA objects for create functions
    // Collect $var: references to bind after node creation
    const pendingVarBindings: any[] = [];
    const createParams: any = Object.assign({}, props, { parentId: parentNodeId });

    for (const [colorProp, figmaField] of Object.entries(COLOR_FIELDS)) {
      if (createParams[colorProp] != null) {
        const resolved = resolveColorValue(createParams[colorProp]);
        if (resolved.varRef) {
          // For $var: refs, try to get the resolved value to pass to create,
          // and also queue the binding for after creation
          const variable = await getVariableByName(resolved.varRef);
          if (variable && variable.resolvedType === "COLOR") {
            // Get the value from the first mode as fallback color
            const modeIds = Object.keys(variable.valuesByMode);
            if (modeIds.length > 0) {
              const val = variable.valuesByMode[modeIds[0]];
              if (val && typeof val === "object" && "r" in val) {
                createParams[colorProp] = val;
              } else {
                delete createParams[colorProp];
              }
            } else {
              delete createParams[colorProp];
            }
          } else {
            delete createParams[colorProp];
          }
          pendingVarBindings.push({ colorProp, figmaField, varRef: resolved.varRef });
        } else if (resolved.color) {
          createParams[colorProp] = resolved.color;
        }
      }
    }

    // Default x/y to 0 if not provided
    if (createParams.x === undefined) createParams.x = 0;
    if (createParams.y === undefined) createParams.y = 0;

    let result: any;
    try {
      switch (type) {
        case "frame":
          result = await createFrame(createParams, firstOnTop);
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
        default:
          throw new Error(`Unknown node type: ${type}`);
      }
    } catch (err: any) {
      errorCount++;
      errors.push({
        type,
        name: props.name || "(unnamed)",
        error: err.message || String(err),
      });
      // If a frame fails, skip its children
      return;
    }

    // Bind any $var: references as real Figma variables on the created node
    if (pendingVarBindings.length > 0) {
      const node = await figma.getNodeByIdAsync(result.id);
      if (node) {
        for (const binding of pendingVarBindings) {
          await bindVariableToColor(node, binding.figmaField, binding.varRef);
        }
      }
    }

    createdCount++;
    nodes.push({
      id: result.id,
      name: result.name,
      type,
      parentId: parentNodeId || null,
    });

    // Send progress every 5 nodes
    if (commandId && createdCount % 5 === 0) {
      const progress = Math.round((createdCount / totalNodes) * 100);
      await sendProgressUpdate(
        commandId,
        "create_node_tree",
        "in_progress",
        progress,
        totalNodes,
        createdCount,
        `Created ${createdCount}/${totalNodes} nodes`
      );
    }

    // Recurse into children (only frames should have them)
    if (children && Array.isArray(children)) {
      for (const child of children) {
        await createNode(child, result.id, depth + 1);
      }
    }
  }

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
    await syncNode(tree, rootNode, 0);
  } else {
    // CREATE mode (existing behavior)
    await createNode(tree, parentId || null, 0);
  }

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
    nodes,
    errors: errors.length > 0 ? errors : undefined,
    stats: {
      durationMs: Date.now() - startTime,
      maxDepth: maxDepthSeen,
      nodesByType: nodeTypeCounts,
    },
  };
}
