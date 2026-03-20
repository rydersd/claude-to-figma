// analysis.ts — Analysis, introspection, batch mutation, design query, and component migration
// Extracted from code.js as part of the plugin modularization refactor.

import { sendProgressUpdate, generateCommandId, loadAllFonts, customBase64Encode, safeMixed, hexToFigmaColor, appendOrInsertChild, getVariableByName, bindVariableToColor, resolveColorValue } from './utils';
import { setCharacters } from './text';
import { normalizeSvgPath } from './vectors';

export async function screenshotRegion(params: any) {
  var x = params.x;
  var y = params.y;
  var width = params.width;
  var height = params.height;
  var scale = params.scale || 1;

  // exportAsync only renders a node's own children, so we must clone
  // all visible nodes intersecting the region into a temporary clip frame.

  // Find all top-level children that intersect the target region
  var page = figma.currentPage;
  var candidates: any[] = [];
  for (var i = 0; i < page.children.length; i++) {
    var child = page.children[i];
    if (child.visible === false) continue;
    if (child.name === "__screenshot_temp__") continue;
    // AABB intersection test using absoluteBoundingBox or x/y/width/height
    var bb = child.absoluteBoundingBox || { x: child.x, y: child.y, width: child.width, height: child.height };
    var intersects = !(bb.x + bb.width < x || bb.x > x + width ||
                       bb.y + bb.height < y || bb.y > y + height);
    if (intersects) {
      candidates.push(child);
    }
  }

  // Create a clip frame at the region bounds
  var clipFrame = figma.createFrame();
  clipFrame.name = "__screenshot_temp__";
  clipFrame.x = x;
  clipFrame.y = y;
  clipFrame.resize(width, height);
  clipFrame.clipsContent = true;
  clipFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 1 }]; // white background

  page.appendChild(clipFrame);

  try {
    // Clone intersecting nodes into the frame, preserving visual position
    for (var j = 0; j < candidates.length; j++) {
      var node = candidates[j];
      var clone = node.clone();
      clipFrame.appendChild(clone);
      // Position relative to the clip frame origin
      var nodeBB = node.absoluteBoundingBox || { x: node.x, y: node.y };
      clone.x = nodeBB.x - x;
      clone.y = nodeBB.y - y;
    }

    // Export the assembled clip frame
    var settings: any = {
      format: "PNG",
      constraint: { type: "SCALE", value: scale },
    };

    var bytes = await clipFrame.exportAsync(settings);
    var base64 = customBase64Encode(bytes);

    return {
      imageData: base64,
      mimeType: "image/png",
      region: { x: x, y: y, width: width, height: height },
      scale: scale,
      nodesCaptured: candidates.length,
    };
  } finally {
    // Always clean up the temp frame and all its cloned children
    clipFrame.remove();
  }
}

// --- batch_mutate: Execute mixed operations in one round-trip ---
export async function batchMutate(params: any) {
  var operations = params.operations;
  var results: any[] = [];
  var successCount = 0;
  var failureCount = 0;

  for (var i = 0; i < operations.length; i++) {
    var op = operations[i];
    try {
      var result: any = null;

      switch (op.op) {
        case "rename":
          var renameNode: any = await figma.getNodeByIdAsync(op.nodeId);
          if (!renameNode) throw new Error("Node not found: " + op.nodeId);
          var oldName = renameNode.name;
          renameNode.name = op.name;
          result = { op: "rename", nodeId: op.nodeId, oldName: oldName, newName: op.name };
          break;

        case "set_fill":
          var fillNode: any = await figma.getNodeByIdAsync(op.nodeId);
          if (!fillNode) throw new Error("Node not found: " + op.nodeId);
          if (!("fills" in fillNode)) throw new Error("Node does not support fills: " + op.nodeId);
          var fillColor = op.color;
          if (fillColor.a !== undefined && parseFloat(fillColor.a) === 0) {
            fillNode.fills = [];
          } else {
            fillNode.fills = [{
              type: "SOLID",
              color: { r: fillColor.r || 0, g: fillColor.g || 0, b: fillColor.b || 0 },
              opacity: fillColor.a !== undefined ? fillColor.a : 1,
            }];
          }
          result = { op: "set_fill", nodeId: op.nodeId, name: fillNode.name };
          break;

        case "set_stroke":
          var strokeNode: any = await figma.getNodeByIdAsync(op.nodeId);
          if (!strokeNode) throw new Error("Node not found: " + op.nodeId);
          if (!("strokes" in strokeNode)) throw new Error("Node does not support strokes: " + op.nodeId);
          var strokeColor = op.color;
          strokeNode.strokes = [{
            type: "SOLID",
            color: { r: strokeColor.r || 0, g: strokeColor.g || 0, b: strokeColor.b || 0 },
            opacity: strokeColor.a !== undefined ? strokeColor.a : 1,
          }];
          if (op.weight !== undefined) {
            strokeNode.strokeWeight = op.weight;
          }
          result = { op: "set_stroke", nodeId: op.nodeId, name: strokeNode.name };
          break;

        case "move":
          var moveNode: any = await figma.getNodeByIdAsync(op.nodeId);
          if (!moveNode) throw new Error("Node not found: " + op.nodeId);
          if (op.x !== undefined) moveNode.x = op.x;
          if (op.y !== undefined) moveNode.y = op.y;
          result = { op: "move", nodeId: op.nodeId, name: moveNode.name, x: moveNode.x, y: moveNode.y };
          break;

        case "resize":
          var resizeNode: any = await figma.getNodeByIdAsync(op.nodeId);
          if (!resizeNode) throw new Error("Node not found: " + op.nodeId);
          if (!("resize" in resizeNode) && !("resizeWithoutConstraints" in resizeNode)) throw new Error("Node does not support resize: " + op.nodeId);
          if ("resize" in resizeNode) {
            resizeNode.resize(op.width, op.height);
          } else {
            resizeNode.resizeWithoutConstraints(op.width, op.height);
          }
          result = { op: "resize", nodeId: op.nodeId, name: resizeNode.name, width: op.width, height: op.height };
          break;

        case "delete":
          var deleteNode: any = await figma.getNodeByIdAsync(op.nodeId);
          if (!deleteNode) throw new Error("Node not found: " + op.nodeId);
          var deletedName = deleteNode.name;
          deleteNode.remove();
          result = { op: "delete", nodeId: op.nodeId, name: deletedName };
          break;

        case "set_text":
          var textNode: any = await figma.getNodeByIdAsync(op.nodeId);
          if (!textNode) throw new Error("Node not found: " + op.nodeId);
          if (textNode.type !== "TEXT") throw new Error("Node is not TEXT: " + op.nodeId);
          await loadAllFonts(textNode);
          textNode.characters = op.text;
          result = { op: "set_text", nodeId: op.nodeId, name: textNode.name };
          break;

        case "set_visible":
          var visNode: any = await figma.getNodeByIdAsync(op.nodeId);
          if (!visNode) throw new Error("Node not found: " + op.nodeId);
          visNode.visible = !!op.visible;
          result = { op: "set_visible", nodeId: op.nodeId, name: visNode.name, visible: visNode.visible };
          break;

        case "set_font":
          var fontNode: any = await figma.getNodeByIdAsync(op.nodeId);
          if (!fontNode) throw new Error("Node not found: " + op.nodeId);
          if (fontNode.type !== "TEXT") throw new Error("Node is not TEXT: " + op.nodeId);
          var batchFontFamily = op.fontFamily || "Inter";
          var batchFontStyle = op.fontStyle || "Regular";
          await figma.loadFontAsync({ family: batchFontFamily, style: batchFontStyle });
          fontNode.fontName = { family: batchFontFamily, style: batchFontStyle };
          result = { op: "set_font", nodeId: op.nodeId, name: fontNode.name, fontFamily: batchFontFamily, fontStyle: batchFontStyle };
          break;

        case "set_text_align":
          var alignNode: any = await figma.getNodeByIdAsync(op.nodeId);
          if (!alignNode) throw new Error("Node not found: " + op.nodeId);
          if (alignNode.type !== "TEXT") throw new Error("Node is not TEXT: " + op.nodeId);
          if (op.horizontal !== undefined) alignNode.textAlignHorizontal = op.horizontal;
          if (op.vertical !== undefined) alignNode.textAlignVertical = op.vertical;
          result = { op: "set_text_align", nodeId: op.nodeId, name: alignNode.name, horizontal: alignNode.textAlignHorizontal, vertical: alignNode.textAlignVertical };
          break;

        case "set_vector_path":
          var vpNode: any = await figma.getNodeByIdAsync(op.nodeId);
          if (!vpNode) throw new Error("Node not found: " + op.nodeId);
          if (vpNode.type !== "VECTOR") throw new Error("Node is not a VECTOR (type: " + vpNode.type + ")");
          vpNode.vectorPaths = [{ windingRule: "NONZERO", data: normalizeSvgPath(op.pathData) }];
          if (op.width !== undefined && op.height !== undefined) {
            vpNode.resize(op.width, op.height);
          }
          result = { op: "set_vector_path", nodeId: op.nodeId, name: vpNode.name, width: vpNode.width, height: vpNode.height };
          break;

        default:
          throw new Error("Unknown operation: " + op.op);
      }

      results.push(Object.assign({ success: true }, result));
      successCount++;
    } catch (e: any) {
      results.push({
        success: false,
        op: op.op,
        nodeId: op.nodeId,
        error: e.message || String(e),
      });
      failureCount++;
    }
  }

  return {
    totalOperations: operations.length,
    successCount: successCount,
    failureCount: failureCount,
    results: results,
  };
}

export async function scanNodeStyles(params: any) {
  var rootId = params.nodeId;
  var maxDepth = params.maxDepth !== undefined ? params.maxDepth : 10;

  var root = await figma.getNodeByIdAsync(rootId);
  if (!root) {
    throw new Error("Node not found with ID: " + rootId);
  }

  var results: any[] = [];

  function hasBoundVariable(node: any, field: any) {
    try {
      var bindings = node.boundVariables;
      if (bindings && bindings[field]) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  function extractFills(node: any) {
    if (!("fills" in node) || !Array.isArray(node.fills)) return null;
    var fills: any[] = [];
    for (var i = 0; i < node.fills.length; i++) {
      var f = node.fills[i];
      if (f.type === "SOLID") {
        fills.push({
          type: "SOLID",
          color: { r: f.color.r, g: f.color.g, b: f.color.b },
          opacity: f.opacity !== undefined ? f.opacity : 1,
          visible: f.visible !== false,
          boundVariable: hasBoundVariable(node, "fills"),
        });
      } else {
        fills.push({ type: f.type, visible: f.visible !== false });
      }
    }
    return fills.length > 0 ? fills : null;
  }

  function extractStrokes(node: any) {
    if (!("strokes" in node) || !Array.isArray(node.strokes)) return null;
    var strokes: any[] = [];
    for (var i = 0; i < node.strokes.length; i++) {
      var s = node.strokes[i];
      if (s.type === "SOLID") {
        strokes.push({
          type: "SOLID",
          color: { r: s.color.r, g: s.color.g, b: s.color.b },
          opacity: s.opacity !== undefined ? s.opacity : 1,
          visible: s.visible !== false,
          boundVariable: hasBoundVariable(node, "strokes"),
        });
      } else {
        strokes.push({ type: s.type, visible: s.visible !== false });
      }
    }
    return strokes.length > 0 ? strokes : null;
  }

  function extractFont(node: any) {
    if (node.type !== "TEXT") return null;
    try {
      return {
        fontSize: safeMixed(node.fontSize),
        fontFamily: typeof node.fontName === "object" ? node.fontName.family : null,
        fontStyle: typeof node.fontName === "object" ? node.fontName.style : null,
        fontWeight: safeMixed(node.fontWeight),
        lineHeight: safeMixed(node.lineHeight),
        letterSpacing: safeMixed(node.letterSpacing),
        textAlignHorizontal: node.textAlignHorizontal,
        textAlignVertical: node.textAlignVertical,
      };
    } catch (e) {
      return { fontSize: safeMixed(node.fontSize) };
    }
  }

  async function walkNode(node: any, depth: any, parentId: any) {
    if (depth > maxDepth) return;

    var entry: any = {
      id: node.id,
      name: node.name,
      type: node.type,
      parentId: parentId,
      bbox: { x: node.x, y: node.y, width: node.width, height: node.height },
      visible: node.visible !== false,
    };

    // Fills and strokes
    var fills = extractFills(node);
    if (fills) entry.fills = fills;
    var strokes = extractStrokes(node);
    if (strokes) entry.strokes = strokes;
    if ("strokeWeight" in node && node.strokeWeight) entry.strokeWeight = safeMixed(node.strokeWeight);

    // Corner radius
    if ("cornerRadius" in node && node.cornerRadius !== undefined && node.cornerRadius !== 0) {
      entry.cornerRadius = safeMixed(node.cornerRadius);
    }

    // Auto layout
    if ("layoutMode" in node && node.layoutMode && node.layoutMode !== "NONE") {
      entry.layoutMode = node.layoutMode;
      entry.itemSpacing = node.itemSpacing;
      entry.paddingTop = node.paddingTop;
      entry.paddingRight = node.paddingRight;
      entry.paddingBottom = node.paddingBottom;
      entry.paddingLeft = node.paddingLeft;
    }

    // Font properties for text
    var font = extractFont(node);
    if (font) entry.font = font;

    // Is it an instance?
    if (node.type === "INSTANCE") {
      entry.isInstance = true;
      try {
        var mainComp = await node.getMainComponentAsync();
        if (mainComp) {
          entry.componentName = mainComp.name;
          entry.componentId = mainComp.id;
        }
      } catch (e) {}
    }

    results.push(entry);

    // Recurse into children
    if ("children" in node && node.children) {
      for (var i = 0; i < node.children.length; i++) {
        await walkNode(node.children[i], depth + 1, node.id);
      }
    }
  }

  await walkNode(root, 0, null);

  return {
    rootId: rootId,
    totalNodes: results.length,
    nodes: results,
  };
}

// --- introspect_node: Discover the full manipulation surface of a component/frame ---
export async function introspectNode(params: any) {
  var nodeId = params.nodeId;
  var maxDepth = params.maxDepth !== undefined ? params.maxDepth : 20;

  var root = await figma.getNodeByIdAsync(nodeId);
  if (!root) {
    throw new Error("Node not found with ID: " + nodeId);
  }

  var properties: any = {};
  var wrapperFrameCount = 0;
  var nameCollisions: any = {};
  var treeDepth = 0;
  var componentName: any = null;

  // Generic names to skip when building semantic keys
  var GENERIC_NAMES = new Set([
    "Frame", "Group", "Rectangle", "Ellipse", "Vector", "Component",
    "Instance", "frame", "group", "rectangle", "ellipse", "vector",
  ]);

  function isGenericName(name: any) {
    if (GENERIC_NAMES.has(name)) return true;
    // Pure numbers like "1", "42"
    if (/^\d+$/.test(name)) return true;
    // "Frame 123" style
    if (/^(Frame|Group|Rectangle|Ellipse|Vector|Component|Instance)\s+\d+$/i.test(name)) return true;
    return false;
  }

  function isWrapperFrame(node: any) {
    if (node.type !== "FRAME") return false;
    if (!("children" in node) || node.children.length !== 1) return false;
    // Has visible fills?
    if ("fills" in node && Array.isArray(node.fills)) {
      for (var i = 0; i < node.fills.length; i++) {
        if (node.fills[i].visible !== false && node.fills[i].type === "SOLID") return false;
      }
    }
    // Has layout mode?
    if ("layoutMode" in node && node.layoutMode && node.layoutMode !== "NONE") return false;
    // Has effects?
    if ("effects" in node && Array.isArray(node.effects) && node.effects.length > 0) {
      for (var i = 0; i < node.effects.length; i++) {
        if (node.effects[i].visible !== false) return false;
      }
    }
    return true;
  }

  function hasBoundVariable(node: any, field: any) {
    try {
      var bindings = node.boundVariables;
      if (bindings && bindings[field]) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  async function resolveBoundVariableName(node: any, field: any) {
    try {
      var bindings = node.boundVariables;
      if (!bindings || !bindings[field]) return null;
      var binding = bindings[field];
      // fills/strokes are arrays of bindings
      var varId: any = null;
      if (Array.isArray(binding) && binding.length > 0) {
        varId = binding[0].id;
      } else if (binding && binding.id) {
        varId = binding.id;
      }
      if (!varId) return null;
      var variable = await figma.variables.getVariableByIdAsync(varId);
      if (!variable) return null;
      var collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
      var collectionName = collection ? collection.name : "Unknown";
      return collectionName + "/" + variable.name;
    } catch (e) {
      return null;
    }
  }

  function rgbToHex(r: any, g: any, b: any) {
    var rr = Math.round(r * 255).toString(16).padStart(2, "0");
    var gg = Math.round(g * 255).toString(16).padStart(2, "0");
    var bb = Math.round(b * 255).toString(16).padStart(2, "0");
    return "#" + rr + gg + bb;
  }

  function buildSemanticKey(pathSegments: any) {
    // Filter out generic names, take last 2-3 meaningful ones
    var meaningful: any[] = [];
    for (var i = 0; i < pathSegments.length; i++) {
      if (!isGenericName(pathSegments[i])) {
        meaningful.push(pathSegments[i]);
      }
    }
    if (meaningful.length === 0) {
      // All generic — use last segment
      meaningful = [pathSegments[pathSegments.length - 1] || "node"];
    }
    // Take last 2-3
    var start = Math.max(0, meaningful.length - 3);
    var parts = meaningful.slice(start);
    // Clean up each part: lowercase, replace spaces with camelCase
    for (var i = 0; i < parts.length; i++) {
      parts[i] = parts[i]
        .replace(/[^a-zA-Z0-9_ -]/g, "")
        .replace(/\s+(.)/g, function(_: any, c: any) { return c.toUpperCase(); })
        .replace(/^\s+/, "");
      if (parts[i].length === 0) parts[i] = "node";
    }
    return parts.join(".");
  }

  function addProperty(baseKey: any, propSuffix: any, propDef: any) {
    var key = propSuffix ? baseKey + "." + propSuffix : baseKey;

    // Handle collisions
    if (properties[key]) {
      // Track collision on base name
      var baseName = baseKey.split(".").pop();
      nameCollisions[baseName] = (nameCollisions[baseName] || 1) + 1;
      key = key + "_" + nameCollisions[baseName];
    }

    properties[key] = propDef;
  }

  async function walkNode(node: any, depth: any, pathSegments: any) {
    if (depth > maxDepth) return;
    if (depth > treeDepth) treeDepth = depth;

    var currentPath = pathSegments.concat([node.name]);

    // Check for wrapper frame
    if (depth > 0 && isWrapperFrame(node)) {
      wrapperFrameCount++;
    }

    var baseKey = buildSemanticKey(currentPath);

    // 1. TEXT nodes
    if (node.type === "TEXT") {
      var textExtra: any = { fontSize: null, fontFamily: null };
      try {
        if (node.fontSize !== figma.mixed) textExtra.fontSize = node.fontSize;
        if (node.fontName !== figma.mixed && typeof node.fontName === "object") {
          textExtra.fontFamily = node.fontName.family;
        }
      } catch (e) {}
      addProperty(baseKey, "text", {
        type: "text",
        value: node.characters,
        nodeId: node.id,
        fontSize: textExtra.fontSize,
        fontFamily: textExtra.fontFamily,
      });
    }

    // 2. INSTANCE nodes
    if (node.type === "INSTANCE") {
      try {
        var mainComp = await node.getMainComponentAsync();
        if (mainComp) {
          var variants: any[] = [];
          if (mainComp.parent && mainComp.parent.type === "COMPONENT_SET") {
            var siblings = mainComp.parent.children;
            for (var i = 0; i < siblings.length; i++) {
              if (siblings[i].type === "COMPONENT") {
                variants.push(siblings[i].name);
              }
            }
          }
          addProperty(baseKey, "instance", {
            type: "instance",
            value: mainComp.name,
            nodeId: node.id,
            componentId: mainComp.id,
            variants: variants.length > 0 ? variants : undefined,
          });
        }
      } catch (e) {}
    }

    // 3. Visible solid fills
    if ("fills" in node && Array.isArray(node.fills)) {
      for (var fi = 0; fi < node.fills.length; fi++) {
        var fill = node.fills[fi];
        if (fill.visible !== false && fill.type === "SOLID") {
          var fillBound = hasBoundVariable(node, "fills");
          var fillVarName = fillBound ? await resolveBoundVariableName(node, "fills") : null;
          var fillProp: any = {
            type: "color",
            value: rgbToHex(fill.color.r, fill.color.g, fill.color.b),
            nodeId: node.id,
            target: "fill",
            boundVariable: fillBound,
          };
          if (fillVarName) fillProp.boundVariableName = fillVarName;
          addProperty(baseKey, "fill", fillProp);
          break; // Only first visible solid fill
        }
      }
    }

    // 4. Visible solid strokes
    if ("strokes" in node && Array.isArray(node.strokes)) {
      for (var si = 0; si < node.strokes.length; si++) {
        var stroke = node.strokes[si];
        if (stroke.visible !== false && stroke.type === "SOLID") {
          var strokeBound = hasBoundVariable(node, "strokes");
          var strokeVarName = strokeBound ? await resolveBoundVariableName(node, "strokes") : null;
          var strokeProp: any = {
            type: "color",
            value: rgbToHex(stroke.color.r, stroke.color.g, stroke.color.b),
            nodeId: node.id,
            target: "stroke",
            boundVariable: strokeBound,
          };
          if (strokeVarName) strokeProp.boundVariableName = strokeVarName;
          addProperty(baseKey, "stroke", strokeProp);
          break;
        }
      }
    }

    // 5. Hidden nodes (visibility toggle)
    if (depth > 0 && node.visible === false) {
      addProperty(baseKey, "visible", {
        type: "boolean",
        value: false,
        nodeId: node.id,
      });
    }

    // 6. Component properties (on INSTANCE nodes)
    if (node.type === "INSTANCE" && node.componentProperties) {
      var compProps = node.componentProperties;
      for (var propName in compProps) {
        if (compProps.hasOwnProperty(propName)) {
          var prop = compProps[propName];
          addProperty(baseKey, "prop." + propName.split("#")[0], {
            type: "component_property",
            value: prop.value,
            nodeId: node.id,
            propertyType: prop.type,
            key: propName,
          });
        }
      }
    }

    // Recurse into children
    if ("children" in node && node.children) {
      for (var ci = 0; ci < node.children.length; ci++) {
        await walkNode(node.children[ci], depth + 1, currentPath);
      }
    }
  }

  // Get component name if root is an instance or component
  if (root.type === "INSTANCE") {
    try {
      var mc = await (root as any).getMainComponentAsync();
      if (mc) componentName = mc.name;
    } catch (e) {}
  } else if (root.type === "COMPONENT") {
    componentName = root.name;
  } else if (root.type === "COMPONENT_SET") {
    componentName = root.name;
  }

  await walkNode(root, 0, []);

  var propertyCount = 0;
  for (var k in properties) {
    if (properties.hasOwnProperty(k)) propertyCount++;
  }

  return {
    id: root.id,
    name: root.name,
    component: componentName,
    depth: treeDepth,
    wrapperFrames: wrapperFrameCount,
    nameCollisions: nameCollisions,
    propertyCount: propertyCount,
    properties: properties,
  };
}

// --- set_properties: Modify multiple properties by semantic key ---
export async function setProperties(params: any) {
  var nodeId = params.nodeId;
  var newValues = params.properties;
  var propertyMap = params.propertyMap;

  // If no property map provided, introspect to discover it
  if (!propertyMap) {
    var introspection = await introspectNode({ nodeId: nodeId });
    propertyMap = introspection.properties;
  }

  var results: any[] = [];
  var successCount = 0;
  var failureCount = 0;

  for (var key in newValues) {
    if (!newValues.hasOwnProperty(key)) continue;

    var newValue = newValues[key];
    var propDef = propertyMap[key];

    if (!propDef) {
      results.push({ key: key, success: false, error: "Property key not found in property map" });
      failureCount++;
      continue;
    }

    try {
      var targetNode: any = await figma.getNodeByIdAsync(propDef.nodeId);
      if (!targetNode) {
        throw new Error("Node not found: " + propDef.nodeId);
      }

      var oldValue = propDef.value;

      switch (propDef.type) {
        case "text":
          if (targetNode.type !== "TEXT") throw new Error("Node is not TEXT");
          await loadAllFonts(targetNode);
          await setCharacters(targetNode, String(newValue));
          results.push({ key: key, success: true, oldValue: oldValue, newValue: String(newValue) });
          break;

        case "color":
          var hexColor = String(newValue);
          var parsed = hexToFigmaColor(hexColor);
          if (!parsed) throw new Error("Invalid hex color: " + hexColor);
          if (propDef.target === "stroke") {
            if (!("strokes" in targetNode)) throw new Error("Node does not support strokes");
            targetNode.strokes = [{
              type: "SOLID",
              color: { r: parsed.r, g: parsed.g, b: parsed.b },
              opacity: parsed.a !== undefined ? parsed.a : 1,
            }];
          } else {
            if (!("fills" in targetNode)) throw new Error("Node does not support fills");
            targetNode.fills = [{
              type: "SOLID",
              color: { r: parsed.r, g: parsed.g, b: parsed.b },
              opacity: parsed.a !== undefined ? parsed.a : 1,
            }];
          }
          results.push({ key: key, success: true, oldValue: oldValue, newValue: hexColor });
          break;

        case "instance":
          if (targetNode.type !== "INSTANCE") throw new Error("Node is not an INSTANCE");
          var variantName = String(newValue);
          var mainComp = await targetNode.getMainComponentAsync();
          if (!mainComp) throw new Error("Could not get main component");

          var swapTarget: any = null;
          if (mainComp.parent && mainComp.parent.type === "COMPONENT_SET") {
            var siblings = mainComp.parent.children;
            for (var si = 0; si < siblings.length; si++) {
              if (siblings[si].type === "COMPONENT") {
                // Use indexOf match to handle "Type=Dashboard" style names
                if (siblings[si].name === variantName || siblings[si].name.indexOf(variantName) !== -1) {
                  swapTarget = siblings[si];
                  break;
                }
              }
            }
          }
          if (!swapTarget) throw new Error("Variant not found: " + variantName);
          targetNode.swapComponent(swapTarget);
          results.push({ key: key, success: true, oldValue: oldValue, newValue: variantName });
          break;

        case "boolean":
          targetNode.visible = !!newValue;
          results.push({ key: key, success: true, oldValue: oldValue, newValue: !!newValue });
          break;

        case "component_property":
          // Need to find the instance node that owns this property
          if (targetNode.type !== "INSTANCE") throw new Error("Node is not an INSTANCE");
          var propKey = propDef.key;
          var propObj: any = {};
          propObj[propKey] = newValue;
          targetNode.setProperties(propObj);
          results.push({ key: key, success: true, oldValue: oldValue, newValue: newValue });
          break;

        default:
          throw new Error("Unknown property type: " + propDef.type);
      }

      successCount++;
    } catch (e: any) {
      results.push({
        key: key,
        success: false,
        error: e.message || String(e),
      });
      failureCount++;
    }
  }

  return {
    nodeId: nodeId,
    totalProperties: results.length,
    successCount: successCount,
    failureCount: failureCount,
    results: results,
  };
}

// --- optimize_structure: Analyze and optionally restructure for AI efficiency ---
export async function optimizeStructure(params: any) {
  var nodeId = params.nodeId;
  var options = params.options || {};
  var dryRun = options.dryRun !== false; // default true
  var maxDepth = options.maxDepth !== undefined ? options.maxDepth : 20;
  var doFlatten = options.flatten !== false; // default true
  var doRename = options.rename !== false; // default true
  var doExposeProperties = options.exposeProperties === true; // default false
  var doExtractComponents = options.extractComponents === true; // default false

  var root = await figma.getNodeByIdAsync(nodeId);
  if (!root) {
    throw new Error("Node not found with ID: " + nodeId);
  }

  var changes: any[] = [];
  var appliedCount = 0;

  function isWrapperFrame(node: any) {
    if (node.type !== "FRAME") return false;
    if (!("children" in node) || node.children.length !== 1) return false;
    if ("fills" in node && Array.isArray(node.fills)) {
      for (var i = 0; i < node.fills.length; i++) {
        if (node.fills[i].visible !== false && node.fills[i].type === "SOLID") return false;
      }
    }
    if ("layoutMode" in node && node.layoutMode && node.layoutMode !== "NONE") return false;
    if ("effects" in node && Array.isArray(node.effects) && node.effects.length > 0) {
      for (var i = 0; i < node.effects.length; i++) {
        if (node.effects[i].visible !== false) return false;
      }
    }
    return true;
  }

  // Pass 1: Find wrapper frames to flatten (collect bottom-up)
  var wrappers: any[] = [];
  if (doFlatten) {
    async function findWrappers(node: any, depth: any) {
      if (depth > maxDepth) return;
      // Recurse first (bottom-up processing)
      if ("children" in node && node.children) {
        for (var i = 0; i < node.children.length; i++) {
          await findWrappers(node.children[i], depth + 1);
        }
      }
      if (depth > 0 && isWrapperFrame(node)) {
        wrappers.push(node);
      }
    }
    await findWrappers(root, 0);

    for (var wi = 0; wi < wrappers.length; wi++) {
      var wrapper = wrappers[wi];
      var childName = ("children" in wrapper && wrapper.children.length > 0) ? wrapper.children[0].name : "unknown";
      changes.push({
        action: "flatten",
        nodeId: wrapper.id,
        nodeName: wrapper.name,
        description: "Remove wrapper, promote child '" + childName + "'",
      });
    }
  }

  // Pass 2: Find text nodes to rename
  var textNodesToRename: any[] = [];
  if (doRename) {
    async function findTextNodes(node: any, depth: any) {
      if (depth > maxDepth) return;
      if (node.type === "TEXT" && !node.name.startsWith("_")) {
        textNodesToRename.push(node);
      }
      if ("children" in node && node.children) {
        for (var i = 0; i < node.children.length; i++) {
          await findTextNodes(node.children[i], depth + 1);
        }
      }
    }
    await findTextNodes(root, 0);

    for (var ti = 0; ti < textNodesToRename.length; ti++) {
      var textNode = textNodesToRename[ti];
      changes.push({
        action: "rename",
        nodeId: textNode.id,
        oldName: textNode.name,
        newName: "_" + textNode.name,
      });
    }
  }

  // Pass 3: Expose properties (report-only for v1)
  if (doExposeProperties && (root.type === "COMPONENT" || root.type === "COMPONENT_SET")) {
    async function findExposeCandidates(node: any, depth: any) {
      if (depth > maxDepth) return;
      if (node.type === "TEXT") {
        changes.push({
          action: "expose_property",
          nodeId: node.id,
          nodeName: node.name,
          description: "TEXT node could be exposed as a component text property",
          propertyType: "TEXT",
        });
      }
      if (node.type === "INSTANCE") {
        changes.push({
          action: "expose_property",
          nodeId: node.id,
          nodeName: node.name,
          description: "INSTANCE node could be exposed as an instance-swap property",
          propertyType: "INSTANCE_SWAP",
        });
      }
      if ("children" in node && node.children) {
        for (var i = 0; i < node.children.length; i++) {
          await findExposeCandidates(node.children[i], depth + 1);
        }
      }
    }
    await findExposeCandidates(root, 0);
  }

  // Pass 4: Extract components (stubbed for v2)
  // doExtractComponents is accepted but returns no results in v1

  // Apply changes if not dry run
  if (!dryRun) {
    // Apply flattening (bottom-up order — wrappers array is already bottom-up)
    if (doFlatten) {
      for (var ai = 0; ai < wrappers.length; ai++) {
        var w: any = wrappers[ai];
        try {
          // Verify wrapper still exists and is still a wrapper
          if (w.removed) continue;
          if (!isWrapperFrame(w)) continue;
          var parent = w.parent;
          if (!parent || !("children" in parent)) continue;

          var child = w.children[0];
          // Find wrapper's index in parent
          var wrapperIndex = -1;
          for (var pi = 0; pi < parent.children.length; pi++) {
            if (parent.children[pi].id === w.id) {
              wrapperIndex = pi;
              break;
            }
          }
          if (wrapperIndex === -1) continue;

          // Preserve child's absolute position
          child.x = child.x + w.x;
          child.y = child.y + w.y;

          // Reparent child to wrapper's parent at wrapper's position
          parent.insertChild(wrapperIndex, child);
          // Remove wrapper (now empty)
          w.remove();
          appliedCount++;
        } catch (e) {
          // Skip failures silently — node may have been removed
        }
      }
    }

    // Apply renaming
    if (doRename) {
      for (var ri = 0; ri < textNodesToRename.length; ri++) {
        try {
          var tn = textNodesToRename[ri];
          if (tn.removed) continue;
          tn.name = "_" + tn.name;
          appliedCount++;
        } catch (e) {}
      }
    }
  }

  return {
    nodeId: nodeId,
    dryRun: dryRun,
    totalChanges: changes.length,
    changes: changes,
    appliedCount: appliedCount,
  };
}

export async function designQuery(params: any) {
  var select = params.select;
  var update = params.update;
  var limit = params.limit;
  var includeProperties = params.includeProperties === true;

  // Determine root
  var rootNode: any;
  if (select.parentId) {
    rootNode = await figma.getNodeByIdAsync(select.parentId);
    if (!rootNode) throw new Error("Parent node not found: " + select.parentId);
  } else {
    rootNode = figma.currentPage;
  }

  // Prepare filters
  var typeFilter: any = null;
  if (select.type) {
    if (Array.isArray(select.type)) {
      typeFilter = new Set(select.type);
    } else {
      typeFilter = new Set([select.type]);
    }
  }

  var nameFilter = select.name || null;
  var nameRegex: any = null;
  if (select.nameRegex) {
    try {
      nameRegex = new RegExp(select.nameRegex);
    } catch (e: any) {
      throw new Error("Invalid regex pattern: " + e.message);
    }
  }

  var componentFilter = select.component || null;
  var whereFilter = select.where || null;
  var maxDepth = select.maxDepth || 100;

  if (!typeFilter && !nameFilter && !nameRegex && !componentFilter && !whereFilter && !select.parentId) {
    throw new Error("At least one selection filter is required to prevent unintended bulk operations");
  }

  var matches: any[] = [];
  var totalScanned = 0;
  var startTime = Date.now();
  var TIMEOUT_MS = 120000;

  async function walkTree(node: any, depth: any) {
    if (depth > maxDepth) return;
    if (limit && matches.length >= limit) return;
    if (Date.now() - startTime > TIMEOUT_MS) return;

    totalScanned++;

    // Send progress every 50 nodes
    if (totalScanned % 50 === 0) {
      figma.ui.postMessage({
        type: "command_progress",
        status: "in_progress",
        message: "Scanned " + totalScanned + " nodes, " + matches.length + " matches so far...",
      });
      await new Promise(function(r: any) { setTimeout(r, 0); });
    }

    // Skip the root node itself (depth 0 is the container)
    if (depth > 0 || !select.parentId) {
      var passed = true;

      // Type filter
      if (passed && typeFilter) {
        if (!typeFilter.has(node.type)) passed = false;
      }

      // Name filter (substring)
      if (passed && nameFilter) {
        if (!node.name || node.name.indexOf(nameFilter) === -1) passed = false;
      }

      // Name regex filter
      if (passed && nameRegex) {
        if (!node.name || !nameRegex.test(node.name)) passed = false;
      }

      // Component filter (for INSTANCE nodes only)
      if (passed && componentFilter) {
        if (node.type !== "INSTANCE") {
          passed = false;
        } else {
          try {
            var mainComp = await node.getMainComponentAsync();
            if (!mainComp || mainComp.name.indexOf(componentFilter) === -1) {
              passed = false;
            }
          } catch (e) {
            passed = false;
          }
        }
      }

      // Where filter (introspect + match properties)
      if (passed && whereFilter) {
        try {
          var intro = await introspectNode({ nodeId: node.id, maxDepth: 5 });
          var props = intro.properties;
          for (var wKey in whereFilter) {
            if (!whereFilter.hasOwnProperty(wKey)) continue;
            var expectedVal = whereFilter[wKey];
            var found = false;
            for (var pKey in props) {
              if (!props.hasOwnProperty(pKey)) continue;
              if (pKey === wKey || pKey.indexOf(wKey) !== -1) {
                if (props[pKey].value === expectedVal) {
                  found = true;
                  break;
                }
              }
            }
            if (!found) {
              passed = false;
              break;
            }
          }
        } catch (e) {
          passed = false;
        }
      }

      if (passed && depth > 0) {
        if (!limit || matches.length < limit) {
          matches.push(node);
        }
      }
    }

    // Recurse into children
    if ("children" in node && node.children) {
      for (var i = 0; i < node.children.length; i++) {
        if (limit && matches.length >= limit) break;
        await walkTree(node.children[i], depth + 1);
      }
    }
  }

  await walkTree(rootNode, 0);

  // Process results
  var results: any[] = [];
  var updatedCount = 0;
  var failedCount = 0;

  for (var mi = 0; mi < matches.length; mi++) {
    var matchNode = matches[mi];
    var resultEntry: any = {
      id: matchNode.id,
      name: matchNode.name,
      type: matchNode.type,
    };

    // Include properties if requested
    if (includeProperties) {
      try {
        var introResult = await introspectNode({ nodeId: matchNode.id, maxDepth: 5 });
        resultEntry.properties = introResult.properties;
      } catch (e: any) {
        resultEntry.properties = { error: e.message || String(e) };
      }
    }

    // Apply updates if provided
    if (update) {
      try {
        var setResult = await setProperties({
          nodeId: matchNode.id,
          properties: update,
        });
        resultEntry.updateResult = {
          successCount: setResult.successCount,
          failureCount: setResult.failureCount,
        };
        if (setResult.successCount > 0) updatedCount++;
        if (setResult.failureCount > 0) failedCount++;
      } catch (e: any) {
        resultEntry.updateResult = {
          successCount: 0,
          failureCount: 1,
          error: e.message || String(e),
        };
        failedCount++;
      }
    }

    results.push(resultEntry);
  }

  return {
    totalScanned: totalScanned,
    matched: matches.length,
    updated: update ? updatedCount : undefined,
    failed: update ? failedCount : undefined,
    results: results,
  };
}

export function safeSerialize(value: any, depth?: any): any {
  if (depth === undefined) depth = 0;
  if (depth > 20) return "[max depth]";
  if (value === null || value === undefined) return value;
  var t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return value;
  // Figma node detection
  if (value.id && value.type && typeof value.remove === "function") {
    return { __nodeRef: true, id: value.id, name: value.name, type: value.type };
  }
  if (value instanceof Uint8Array) {
    return { __binary: true, length: value.length };
  }
  if (Array.isArray(value)) {
    return value.map(function(item: any) { return safeSerialize(item, depth + 1); });
  }
  if (t === "object") {
    var result: any = {};
    for (var key in value) {
      if (value.hasOwnProperty(key)) result[key] = safeSerialize(value[key], depth + 1);
    }
    return result;
  }
  return String(value);
}

export async function figmaEval(params: any) {
  var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  var fn = new AsyncFunction("figma", "hexToFigmaColor", "appendOrInsertChild",
    "loadAllFonts", "getVariableByName", "bindVariableToColor",
    "resolveColorValue", "sendProgressUpdate", "introspectNode", "setProperties",
    params.code);
  try {
    var rawResult = await fn(figma, hexToFigmaColor, appendOrInsertChild,
      loadAllFonts, getVariableByName, bindVariableToColor,
      resolveColorValue, sendProgressUpdate, introspectNode, setProperties);
    return { success: true, result: safeSerialize(rawResult) };
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
}

// --- autoMapProperties: 4-pass matching algorithm for property mapping ---
export function autoMapProperties(sourceProps: any, targetProps: any, strategy?: any) {
  if (!strategy) strategy = "auto";

  var mapping: any = {};
  var usedTargetKeys: any = {};

  var sourceKeys = Object.keys(sourceProps);
  var targetKeys = Object.keys(targetProps);

  function lastSegment(key: any) {
    var parts = key.split(".");
    return parts[parts.length - 1];
  }

  function propType(props: any, key: any) {
    return props[key] ? props[key].type : null;
  }

  // Similarity score between two strings (Sorensen-Dice coefficient on character bigrams)
  function similarity(a: any, b: any) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    if (a === b) return 1.0;
    if (a.length < 2 || b.length < 2) return 0;
    var aBigrams: any = {};
    var bBigrams: any = {};
    var aCount = 0;
    var bCount = 0;
    for (var i = 0; i < a.length - 1; i++) {
      var bg = a.substring(i, i + 2);
      aBigrams[bg] = (aBigrams[bg] || 0) + 1;
      aCount++;
    }
    for (var i = 0; i < b.length - 1; i++) {
      var bg = b.substring(i, i + 2);
      bBigrams[bg] = (bBigrams[bg] || 0) + 1;
      bCount++;
    }
    var intersection = 0;
    for (var bg in aBigrams) {
      if (bBigrams[bg]) {
        intersection += Math.min(aBigrams[bg], bBigrams[bg]);
      }
    }
    return (2.0 * intersection) / (aCount + bCount);
  }

  function tryAssign(sourceKey: any, targetKey: any, confidence: any, matchType: any) {
    if (usedTargetKeys[targetKey]) return false;
    if (mapping[sourceKey]) return false;
    mapping[sourceKey] = {
      targetKey: targetKey,
      confidence: confidence,
      matchType: matchType,
    };
    usedTargetKeys[targetKey] = true;
    return true;
  }

  // Pass 1: Exact key match (confidence 1.0)
  if (strategy === "auto" || strategy === "name") {
    for (var i = 0; i < sourceKeys.length; i++) {
      var sk = sourceKeys[i];
      if (targetProps[sk] && propType(sourceProps, sk) === propType(targetProps, sk)) {
        tryAssign(sk, sk, 1.0, "exact");
      }
    }
  }

  // Pass 2: Suffix match — last segment (confidence 0.8)
  if (strategy === "auto" || strategy === "name") {
    for (var i = 0; i < sourceKeys.length; i++) {
      var sk = sourceKeys[i];
      if (mapping[sk]) continue;
      var sSuffix = lastSegment(sk);
      var sType = propType(sourceProps, sk);
      for (var j = 0; j < targetKeys.length; j++) {
        var tk = targetKeys[j];
        if (usedTargetKeys[tk]) continue;
        if (propType(targetProps, tk) !== sType) continue;
        if (lastSegment(tk) === sSuffix) {
          tryAssign(sk, tk, 0.8, "suffix");
          break;
        }
      }
    }
  }

  // Pass 3: Type + name similarity within type groups (confidence 0.6)
  if (strategy === "auto" || strategy === "name") {
    for (var i = 0; i < sourceKeys.length; i++) {
      var sk = sourceKeys[i];
      if (mapping[sk]) continue;
      var sType = propType(sourceProps, sk);
      var bestScore = 0;
      var bestTarget: any = null;
      for (var j = 0; j < targetKeys.length; j++) {
        var tk = targetKeys[j];
        if (usedTargetKeys[tk]) continue;
        if (propType(targetProps, tk) !== sType) continue;
        var score = similarity(sk, tk);
        if (score > bestScore && score > 0.3) {
          bestScore = score;
          bestTarget = tk;
        }
      }
      if (bestTarget) {
        tryAssign(sk, bestTarget, 0.6, "similarity");
      }
    }
  }

  // Pass 4: Positional fallback — nth text to nth text, etc. (confidence 0.3)
  if (strategy === "auto" || strategy === "position") {
    var sourceByType: any = {};
    var targetByType: any = {};
    for (var i = 0; i < sourceKeys.length; i++) {
      var sk = sourceKeys[i];
      if (mapping[sk]) continue;
      var t = propType(sourceProps, sk);
      if (!sourceByType[t]) sourceByType[t] = [];
      sourceByType[t].push(sk);
    }
    for (var j = 0; j < targetKeys.length; j++) {
      var tk = targetKeys[j];
      if (usedTargetKeys[tk]) continue;
      var t = propType(targetProps, tk);
      if (!targetByType[t]) targetByType[t] = [];
      targetByType[t].push(tk);
    }
    for (var t in sourceByType) {
      if (!targetByType[t]) continue;
      var sArr = sourceByType[t];
      var tArr = targetByType[t];
      var len = Math.min(sArr.length, tArr.length);
      for (var k = 0; k < len; k++) {
        tryAssign(sArr[k], tArr[k], 0.3, "position");
      }
    }
  }

  return mapping;
}

// --- diff_components: Compare two components and produce a mapping ---
export async function diffComponents(params: any) {
  var sourceId = params.sourceId;
  var targetId = params.targetId;
  var strategy = params.matchStrategy || "auto";
  var manualMappings = params.manualMappings;

  var sourceResult = await introspectNode({ nodeId: sourceId });
  var targetResult = await introspectNode({ nodeId: targetId });

  var mapping: any;

  if (strategy === "manual" && manualMappings) {
    mapping = {};
    for (var sk in manualMappings) {
      if (manualMappings.hasOwnProperty(sk)) {
        mapping[sk] = {
          targetKey: manualMappings[sk],
          confidence: 1.0,
          matchType: "manual",
        };
      }
    }
  } else {
    mapping = autoMapProperties(sourceResult.properties, targetResult.properties, strategy);

    if (manualMappings) {
      for (var sk in manualMappings) {
        if (manualMappings.hasOwnProperty(sk)) {
          mapping[sk] = {
            targetKey: manualMappings[sk],
            confidence: 1.0,
            matchType: "manual",
          };
        }
      }
    }
  }

  var mappedSourceKeys: any = {};
  var mappedTargetKeys: any = {};
  for (var sk in mapping) {
    if (mapping.hasOwnProperty(sk)) {
      mappedSourceKeys[sk] = true;
      mappedTargetKeys[mapping[sk].targetKey] = true;
    }
  }

  var unmappedSource: any[] = [];
  for (var sk in sourceResult.properties) {
    if (sourceResult.properties.hasOwnProperty(sk) && !mappedSourceKeys[sk]) {
      unmappedSource.push(sk);
    }
  }

  var unmappedTarget: any[] = [];
  for (var tk in targetResult.properties) {
    if (targetResult.properties.hasOwnProperty(tk) && !mappedTargetKeys[tk]) {
      unmappedTarget.push(tk);
    }
  }

  return {
    sourceComponent: sourceResult.component || sourceResult.name,
    targetComponent: targetResult.component || targetResult.name,
    mapping: mapping,
    unmappedSource: unmappedSource,
    unmappedTarget: unmappedTarget,
    structuralChanges: {
      depthChange: {
        source: sourceResult.depth,
        target: targetResult.depth,
      },
      wrapperFramesDelta: targetResult.wrapperFrames - sourceResult.wrapperFrames,
      sourcePropertyCount: sourceResult.propertyCount,
      targetPropertyCount: targetResult.propertyCount,
    },
  };
}

// --- migrateInstance: Swap one instance with override preservation ---
export async function migrateInstance(params: any) {
  var instanceId = params.instanceId;
  var targetComponentId = params.targetComponentId;
  var propertyMapping = params.propertyMapping;
  var preservePosition = params.preservePosition !== undefined ? params.preservePosition : true;
  var preserveSize = params.preserveSize !== undefined ? params.preserveSize : false;
  var dryRun = params.dryRun !== undefined ? params.dryRun : false;

  // 1. Get the instance node
  var instance: any = await figma.getNodeByIdAsync(instanceId);
  if (!instance) throw new Error("Instance not found: " + instanceId);
  if (instance.type !== "INSTANCE") throw new Error("Node is not an INSTANCE: " + instanceId);

  // 2. Get the target component
  var targetComponent: any = await figma.getNodeByIdAsync(targetComponentId);
  if (!targetComponent) throw new Error("Target component not found: " + targetComponentId);
  if (targetComponent.type !== "COMPONENT" && targetComponent.type !== "COMPONENT_SET") {
    throw new Error("Target is not a COMPONENT or COMPONENT_SET: " + targetComponentId);
  }
  if (targetComponent.type === "COMPONENT_SET") {
    if (!targetComponent.children || targetComponent.children.length === 0) {
      throw new Error("COMPONENT_SET has no children");
    }
    targetComponent = targetComponent.children[0];
  }

  // 3. Introspect current instance to capture override values
  var sourceIntrospection = await introspectNode({ nodeId: instanceId });
  var sourceProps = sourceIntrospection.properties;

  // 4. If no mapping provided, auto-generate by introspecting target
  if (!propertyMapping) {
    var targetIntrospection = await introspectNode({ nodeId: targetComponentId });
    var autoMapping = autoMapProperties(sourceProps, targetIntrospection.properties, "auto");
    propertyMapping = {};
    for (var sk in autoMapping) {
      if (autoMapping.hasOwnProperty(sk)) {
        propertyMapping[sk] = autoMapping[sk].targetKey;
      }
    }
  }

  // 5. Build the override values to apply
  var overridesToApply: any = {};
  var mappedCount = 0;
  var unmappedKeys: any[] = [];
  for (var sk in sourceProps) {
    if (!sourceProps.hasOwnProperty(sk)) continue;
    if (propertyMapping[sk]) {
      overridesToApply[propertyMapping[sk]] = sourceProps[sk].value;
      mappedCount++;
    } else {
      unmappedKeys.push(sk);
    }
  }

  // 6. Capture position/size info
  var position = { x: instance.x, y: instance.y };
  var size = { width: instance.width, height: instance.height };
  var parentNode = instance.parent;
  var childIndex = parentNode ? Array.prototype.indexOf.call(parentNode.children, instance) : 0;

  if (dryRun) {
    return {
      dryRun: true,
      instanceId: instanceId,
      instanceName: instance.name,
      targetComponent: targetComponent.name,
      position: position,
      size: size,
      overridesToApply: overridesToApply,
      mappedCount: mappedCount,
      unmappedKeys: unmappedKeys,
    };
  }

  // 7. Detect if instance is nested inside another instance
  var isNested = false;
  var checkParent = instance.parent;
  while (checkParent) {
    if (checkParent.type === "INSTANCE") {
      isNested = true;
      break;
    }
    checkParent = checkParent.parent;
  }

  var newInstanceId: any;
  var errorResults: any[] = [];

  if (isNested) {
    try {
      instance.swapComponent(targetComponent);
      newInstanceId = instance.id;
    } catch (e: any) {
      throw new Error("Failed to swap nested instance: " + (e.message || String(e)));
    }
  } else {
    var newInstance = targetComponent.createInstance();
    newInstanceId = newInstance.id;

    if (parentNode && "insertChild" in parentNode) {
      parentNode.insertChild(childIndex, newInstance);
    }

    if (preservePosition) {
      newInstance.x = position.x;
      newInstance.y = position.y;
    }

    if (preserveSize) {
      newInstance.resize(size.width, size.height);
    }

    instance.remove();
  }

  // 8. Apply mapped overrides via setProperties
  var applyResult: any = { successCount: 0, failureCount: 0, results: [] };
  if (Object.keys(overridesToApply).length > 0) {
    try {
      applyResult = await setProperties({
        nodeId: newInstanceId,
        properties: overridesToApply,
      });
    } catch (e: any) {
      errorResults.push("Failed to apply overrides: " + (e.message || String(e)));
    }
  }

  return {
    success: true,
    instanceId: newInstanceId,
    targetComponent: targetComponent.name,
    isNested: isNested,
    mappedCount: mappedCount,
    unmappedKeys: unmappedKeys,
    overridesApplied: applyResult.successCount || 0,
    overridesFailed: applyResult.failureCount || 0,
    errors: errorResults.length > 0 ? errorResults : undefined,
  };
}

// --- batchMigrate: Apply migration across entire file ---
export async function batchMigrate(params: any) {
  var commandId = params.commandId || generateCommandId();
  var sourceComponentName = params.sourceComponentName;
  var sourceComponentId = params.sourceComponentId;
  var targetComponentId = params.targetComponentId;
  var propertyMapping = params.propertyMapping;
  var parentId = params.parentId;
  var limit = params.limit;
  var dryRun = params.dryRun !== undefined ? params.dryRun : false;

  var searchRoot: any;
  if (parentId) {
    searchRoot = await figma.getNodeByIdAsync(parentId);
    if (!searchRoot) throw new Error("Parent node not found: " + parentId);
  } else {
    searchRoot = figma.currentPage;
  }

  var instances: any[] = [];

  async function findInstances(node: any) {
    if (limit && instances.length >= limit) return;

    if (node.type === "INSTANCE") {
      var match = false;
      var mainComp: any = null;
      try {
        mainComp = await node.getMainComponentAsync();
      } catch (e) {
        console.error("Error checking instance:", e);
      }
      if (mainComp) {
        if (sourceComponentId) {
          if (mainComp.id === sourceComponentId) match = true;
          if (!match && mainComp.parent && mainComp.parent.type === "COMPONENT_SET" && mainComp.parent.id === sourceComponentId) match = true;
        }
        if (!match && sourceComponentName) {
          if (mainComp.name.indexOf(sourceComponentName) !== -1) match = true;
          if (!match && mainComp.parent && mainComp.parent.type === "COMPONENT_SET" && mainComp.parent.name.indexOf(sourceComponentName) !== -1) match = true;
        }
      }
      if (match) {
        instances.push(node);
      }
    }

    if ("children" in node && node.children) {
      for (var i = 0; i < node.children.length; i++) {
        if (limit && instances.length >= limit) break;
        await findInstances(node.children[i]);
      }
    }
  }

  await findInstances(searchRoot);

  if (dryRun) {
    var dryResults: any[] = [];
    for (var i = 0; i < instances.length; i++) {
      dryResults.push({
        instanceId: instances[i].id,
        instanceName: instances[i].name,
        success: true,
      });
    }
    return {
      totalFound: instances.length,
      migrated: 0,
      failed: 0,
      dryRun: true,
      results: dryResults,
    };
  }

  var results: any[] = [];
  var migratedCount = 0;
  var failedCount = 0;

  for (var i = 0; i < instances.length; i++) {
    var inst = instances[i];
    try {
      if (typeof sendProgressUpdate === "function") {
        sendProgressUpdate(
          commandId,
          "batch_migrate",
          "in_progress",
          Math.round((i / instances.length) * 100),
          instances.length,
          i,
          "Migrating instance " + (i + 1) + " of " + instances.length + ": " + inst.name
        );
      }

      var result = await migrateInstance({
        instanceId: inst.id,
        targetComponentId: targetComponentId,
        propertyMapping: propertyMapping,
        preservePosition: true,
        preserveSize: false,
        dryRun: false,
      });

      results.push({
        instanceId: result.instanceId,
        instanceName: inst.name,
        success: true,
        mappedCount: result.mappedCount,
        overridesApplied: result.overridesApplied,
      });
      migratedCount++;
    } catch (e: any) {
      results.push({
        instanceId: inst.id,
        instanceName: inst.name,
        success: false,
        error: e.message || String(e),
      });
      failedCount++;
    }
  }

  return {
    totalFound: instances.length,
    migrated: migratedCount,
    failed: failedCount,
    dryRun: false,
    results: results,
  };
}
