import { sendProgressUpdate, generateCommandId, safeMixed, hexToFigmaColor } from './utils';

export async function setFillColor(params: any) {
  console.log("setFillColor", params);
  const {
    nodeId,
    color: { r, g, b, a },
  } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  if (!("fills" in node)) {
    throw new Error(`Node does not support fills: ${nodeId}`);
  }

  // Alpha 0 means "no fill" — clear the fills array
  if (a !== undefined && parseFloat(a) === 0) {
    node.fills = [];
    return {
      id: node.id,
      name: node.name,
      fills: [],
    };
  }

  // Create RGBA color
  const rgbColor = {
    r: parseFloat(r) || 0,
    g: parseFloat(g) || 0,
    b: parseFloat(b) || 0,
    a: a !== undefined ? parseFloat(a) : 1,
  };

  // Set fill
  const paintStyle = {
    type: "SOLID",
    color: {
      r: parseFloat(rgbColor.r),
      g: parseFloat(rgbColor.g),
      b: parseFloat(rgbColor.b),
    },
    opacity: rgbColor.a !== undefined ? parseFloat(rgbColor.a) : 1,
  };

  console.log("paintStyle", paintStyle);

  node.fills = [paintStyle];

  return {
    id: node.id,
    name: node.name,
    fills: [paintStyle],
  };
}

export async function batchSetFillColor(params: any) {
  const { nodeIds, color, commandId = generateCommandId() } = params || {};

  if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
    throw new Error("Missing or empty nodeIds array");
  }

  const { r, g, b, a } = color || {};
  const totalItems = nodeIds.length;
  const useProgress = totalItems >= 10;

  if (useProgress) {
    sendProgressUpdate(
      commandId,
      "batch_set_fill_color",
      "started",
      0,
      totalItems,
      0,
      `Starting batch fill color for ${totalItems} nodes`
    );
  }

  const results: any[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < nodeIds.length; i++) {
    const nodeId = nodeIds[i];
    try {
      const result = await setFillColor({ nodeId, color: { r, g, b, a } });
      results.push({ nodeId, success: true, name: result.name });
      successCount++;
    } catch (error) {
      results.push({
        nodeId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      failureCount++;
    }

    if (useProgress && (i + 1) % 5 === 0) {
      const progress = Math.round(((i + 1) / totalItems) * 100);
      sendProgressUpdate(
        commandId,
        "batch_set_fill_color",
        "in_progress",
        progress,
        totalItems,
        i + 1,
        `Processed ${i + 1}/${totalItems} nodes (${successCount} succeeded, ${failureCount} failed)`
      );
    }
  }

  if (useProgress) {
    sendProgressUpdate(
      commandId,
      "batch_set_fill_color",
      "completed",
      100,
      totalItems,
      totalItems,
      `Completed: ${successCount} succeeded, ${failureCount} failed`
    );
  }

  return {
    successCount,
    failureCount,
    totalItems,
    results,
  };
}

export async function setStrokeColor(params: any) {
  const {
    nodeId,
    color: { r, g, b, a },
    weight = 1,
  } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  if (!("strokes" in node)) {
    throw new Error(`Node does not support strokes: ${nodeId}`);
  }

  // Create RGBA color
  const rgbColor = {
    r: r !== undefined ? r : 0,
    g: g !== undefined ? g : 0,
    b: b !== undefined ? b : 0,
    a: a !== undefined ? a : 1,
  };

  // Set stroke
  const paintStyle = {
    type: "SOLID",
    color: {
      r: rgbColor.r,
      g: rgbColor.g,
      b: rgbColor.b,
    },
    opacity: rgbColor.a,
  };

  node.strokes = [paintStyle];

  // Set stroke weight if available
  if ("strokeWeight" in node) {
    node.strokeWeight = weight;
  }

  return {
    id: node.id,
    name: node.name,
    strokes: node.strokes,
    strokeWeight: "strokeWeight" in node ? safeMixed(node.strokeWeight) : undefined,
  };
}

export async function setCornerRadius(params: any) {
  const { nodeId, radius, corners } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  if (radius === undefined) {
    throw new Error("Missing radius parameter");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  // Check if node supports corner radius
  if (!("cornerRadius" in node)) {
    throw new Error(`Node does not support corner radius: ${nodeId}`);
  }

  // If corners array is provided, set individual corner radii
  if (corners && Array.isArray(corners) && corners.length === 4) {
    if ("topLeftRadius" in node) {
      // Node supports individual corner radii — set each explicitly
      node.topLeftRadius = corners[0] ? radius : 0;
      node.topRightRadius = corners[1] ? radius : 0;
      node.bottomRightRadius = corners[2] ? radius : 0;
      node.bottomLeftRadius = corners[3] ? radius : 0;
    } else {
      // Node only supports uniform corner radius
      node.cornerRadius = radius;
    }
  } else {
    // Set uniform corner radius
    node.cornerRadius = radius;
  }

  return {
    id: node.id,
    name: node.name,
    cornerRadius: safeMixed("cornerRadius" in node ? node.cornerRadius : undefined),
    topLeftRadius: "topLeftRadius" in node ? node.topLeftRadius : undefined,
    topRightRadius: "topRightRadius" in node ? node.topRightRadius : undefined,
    bottomRightRadius:
      "bottomRightRadius" in node ? node.bottomRightRadius : undefined,
    bottomLeftRadius:
      "bottomLeftRadius" in node ? node.bottomLeftRadius : undefined,
  };
}

export async function removeFill(params: any) {
  const { nodeId } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  if (!("fills" in node)) {
    throw new Error(`Node does not support fills: ${nodeId}`);
  }

  node.fills = [];

  return {
    id: node.id,
    name: node.name,
  };
}

export async function setStrokeDash(params: any) {
  const { nodeId, dashPattern } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  if (!("dashPattern" in node)) {
    throw new Error(`Node does not support dash pattern: ${nodeId}`);
  }

  node.dashPattern = dashPattern;

  return {
    id: node.id,
    name: node.name,
    dashPattern: node.dashPattern,
  };
}

// Set Stroke Properties
export async function setStrokeProperties(params: any) {
  const { nodeId, weight, cap, join, align, dashPattern } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  if (!("strokes" in node)) {
    throw new Error(`Node does not support strokes: ${nodeId}`);
  }

  if (weight !== undefined) {
    node.strokeWeight = weight;
  }
  if (cap !== undefined) {
    node.strokeCap = cap;
  }
  if (join !== undefined) {
    node.strokeJoin = join;
  }
  if (align !== undefined) {
    node.strokeAlign = align;
  }
  if (dashPattern !== undefined) {
    node.dashPattern = dashPattern;
  }

  return {
    id: node.id,
    name: node.name,
    strokeWeight: safeMixed(node.strokeWeight),
    strokeCap: safeMixed(node.strokeCap),
    strokeJoin: safeMixed(node.strokeJoin),
    strokeAlign: node.strokeAlign,
    dashPattern: safeMixed(node.dashPattern),
  };
}

export async function setClipsContent(params: any) {
  var nodeId = params.nodeId;
  var clipsContent = params.clipsContent;

  var node = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found with ID: " + nodeId);
  if (!("clipsContent" in node)) throw new Error("Node does not support clipsContent (type: " + node.type + ")");

  node.clipsContent = !!clipsContent;

  return {
    id: node.id,
    name: node.name,
    clipsContent: node.clipsContent,
  };
}

// --- set_effects: Set effects (shadows, blurs) on a node ---
export async function setEffects(params: any) {
  var nodeId = params.nodeId;
  var node = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found with ID: " + nodeId);
  if (!("effects" in node)) throw new Error("Node does not support effects (type: " + node.type + ")");

  var effects = params.effects;
  if (!effects || !Array.isArray(effects)) throw new Error("Missing or invalid effects array");

  var figmaEffects: any[] = [];
  for (var i = 0; i < effects.length; i++) {
    var e = effects[i];
    var effect: any = {
      type: e.type,
      visible: e.visible !== false,
    };

    if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
      var color = e.color || { r: 0, g: 0, b: 0, a: 0.25 };
      if (typeof color === "string") {
        var parsed = hexToFigmaColor(color);
        if (parsed) color = parsed;
        else color = { r: 0, g: 0, b: 0, a: 0.25 };
      }
      effect.color = { r: color.r || 0, g: color.g || 0, b: color.b || 0, a: color.a !== undefined ? color.a : 0.25 };
      effect.offset = { x: (e.offset && e.offset.x) || 0, y: (e.offset && e.offset.y) || 4 };
      effect.radius = e.radius !== undefined ? e.radius : 4;
      effect.spread = e.spread !== undefined ? e.spread : 0;
      if (e.blendMode) effect.blendMode = e.blendMode;
    } else if (e.type === "LAYER_BLUR" || e.type === "BACKGROUND_BLUR") {
      effect.radius = e.radius !== undefined ? e.radius : 4;
    }

    figmaEffects.push(effect);
  }

  node.effects = figmaEffects;

  return {
    id: node.id,
    name: node.name,
    effectCount: figmaEffects.length,
    effects: figmaEffects,
  };
}

// --- set_opacity: Set node opacity ---
export async function setOpacity(params: any) {
  var nodeId = params.nodeId;
  var node = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found with ID: " + nodeId);
  if (!("opacity" in node)) throw new Error("Node does not support opacity (type: " + node.type + ")");

  node.opacity = params.opacity;

  return {
    id: node.id,
    name: node.name,
    opacity: node.opacity,
  };
}

// --- set_blend_mode: Set node blend mode ---
export async function setBlendMode(params: any) {
  var nodeId = params.nodeId;
  var node = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found with ID: " + nodeId);
  if (!("blendMode" in node)) throw new Error("Node does not support blendMode (type: " + node.type + ")");

  node.blendMode = params.blendMode;

  return {
    id: node.id,
    name: node.name,
    blendMode: node.blendMode,
  };
}

export async function setRotation(params: any) {
  var nodeId = params.nodeId;
  var node = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found with ID: " + nodeId);
  if (!("rotation" in node)) throw new Error("Node does not support rotation (type: " + node.type + ")");

  node.rotation = params.rotation;

  return {
    id: node.id,
    name: node.name,
    rotation: node.rotation,
  };
}

export async function setConstraints(params: any) {
  var nodeId = params.nodeId;
  var node = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found with ID: " + nodeId);
  if (!("constraints" in node)) throw new Error("Node does not support constraints (type: " + node.type + ")");

  var c: any = {};
  var current = node.constraints;
  c.horizontal = params.horizontal || current.horizontal;
  c.vertical = params.vertical || current.vertical;
  node.constraints = c;

  return {
    id: node.id,
    name: node.name,
    constraints: node.constraints,
  };
}

// --- set_min_max_size: Set min/max width/height on auto-layout children ---
export async function setMinMaxSize(params: any) {
  var nodeId = params.nodeId;
  var node = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found with ID: " + nodeId);

  if (params.minWidth !== undefined) node.minWidth = params.minWidth;
  if (params.maxWidth !== undefined) node.maxWidth = params.maxWidth;
  if (params.minHeight !== undefined) node.minHeight = params.minHeight;
  if (params.maxHeight !== undefined) node.maxHeight = params.maxHeight;

  return {
    id: node.id,
    name: node.name,
    minWidth: node.minWidth,
    maxWidth: node.maxWidth,
    minHeight: node.minHeight,
    maxHeight: node.maxHeight,
  };
}

// --- set_mask: Set a node as a mask for its siblings ---
export async function setMask(params: any) {
  var nodeId = params.nodeId;
  var isMask = params.isMask !== false; // default true

  var node = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found with ID: " + nodeId);
  if (!("isMask" in node)) throw new Error("Node does not support isMask (type: " + node.type + ")");

  // If enabling mask and shouldGroup is requested, group the mask with its siblings
  if (isMask && params.groupWithIds && Array.isArray(params.groupWithIds)) {
    var siblings: any[] = [node];
    for (var i = 0; i < params.groupWithIds.length; i++) {
      var sibling = await figma.getNodeByIdAsync(params.groupWithIds[i]);
      if (sibling) siblings.push(sibling);
    }
    if (siblings.length > 1) {
      var group = figma.group(siblings, node.parent);
      if (params.groupName) group.name = params.groupName;
      // The mask node is now inside the group — set isMask on it
      // After grouping, node reference may be stale, refetch
      var maskNode = await figma.getNodeByIdAsync(nodeId);
      if (maskNode && "isMask" in maskNode) {
        maskNode.isMask = true;
      }
      return {
        maskNodeId: nodeId,
        isMask: true,
        groupId: group.id,
        groupName: group.name,
        childCount: group.children.length,
      };
    }
  }

  node.isMask = isMask;

  return {
    id: node.id,
    name: node.name,
    isMask: node.isMask,
  };
}
