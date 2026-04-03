import { appendOrInsertChild, resolveColorValue, bindVariableToColor, applyColorPaint } from './utils';

export function normalizeSvgPath(pathData: any) {
  // First, insert spaces between command letters and numbers where missing
  // e.g., "M16.8504" → "M 16.8504", "L10-5" → "L 10 -5"
  var normalized = pathData
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/([a-zA-Z])(-)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2");

  // Tokenize
  var tokens = normalized.match(/[a-zA-Z]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
  if (!tokens) return pathData;

  var result: string[] = [];
  var cx = 0, cy = 0; // current point
  var sx = 0, sy = 0; // start of subpath
  var i = 0;

  function num() {
    if (i >= tokens.length) return 0;
    return parseFloat(tokens[i++]);
  }

  while (i < tokens.length) {
    var cmd = tokens[i];

    // If it's a number, it's an implicit repeat of the previous command
    if (/^[+-]?\d/.test(cmd) || cmd === ".") {
      // implicit repeat — reuse last command
      i--; // back up so the number is consumed by the loop below
      cmd = result.length > 0 ? "L" : "M"; // default to L, or M if first
      // Actually we need to handle implicit repeats properly
      // For now just skip
      i++;
      continue;
    }

    i++; // consume command

    switch (cmd) {
      case "M": cx = num(); cy = num(); sx = cx; sy = cy; result.push("M " + cx + " " + cy); break;
      case "m": cx += num(); cy += num(); sx = cx; sy = cy; result.push("M " + cx + " " + cy); break;
      case "L": cx = num(); cy = num(); result.push("L " + cx + " " + cy); break;
      case "l": cx += num(); cy += num(); result.push("L " + cx + " " + cy); break;
      case "H": cx = num(); result.push("L " + cx + " " + cy); break;
      case "h": cx += num(); result.push("L " + cx + " " + cy); break;
      case "V": cy = num(); result.push("L " + cx + " " + cy); break;
      case "v": cy += num(); result.push("L " + cx + " " + cy); break;
      case "C": {
        var x1 = num(), y1 = num(), x2 = num(), y2 = num(); cx = num(); cy = num();
        result.push("C " + x1 + " " + y1 + " " + x2 + " " + y2 + " " + cx + " " + cy);
        break;
      }
      case "c": {
        var x1 = cx+num(), y1 = cy+num(), x2 = cx+num(), y2 = cy+num();
        cx += num(); cy += num();
        result.push("C " + x1 + " " + y1 + " " + x2 + " " + y2 + " " + cx + " " + cy);
        break;
      }
      case "S": case "s": {
        // Smooth cubic — reflect previous control point
        // For simplicity, treat as cubic with first control = current point
        var abs = cmd === "S";
        var x2 = abs ? num() : cx+num();
        var y2 = abs ? num() : cy+num();
        var ex = abs ? num() : cx+num();
        var ey = abs ? num() : cy+num();
        result.push("C " + cx + " " + cy + " " + x2 + " " + y2 + " " + ex + " " + ey);
        cx = ex; cy = ey;
        break;
      }
      case "Q": {
        var qx = num(), qy = num(); cx = num(); cy = num();
        result.push("Q " + qx + " " + qy + " " + cx + " " + cy);
        break;
      }
      case "q": {
        var qx = cx+num(), qy = cy+num(); cx += num(); cy += num();
        result.push("Q " + qx + " " + qy + " " + cx + " " + cy);
        break;
      }
      case "T": case "t": {
        // Smooth quadratic — reflect previous control
        var abs = cmd === "T";
        cx = abs ? num() : cx+num();
        cy = abs ? num() : cy+num();
        result.push("L " + cx + " " + cy); // approximate as line
        break;
      }
      case "A": case "a": {
        // Arc — approximate as line to endpoint
        var abs = cmd === "A";
        num(); num(); num(); num(); num(); // rx, ry, rotation, large-arc, sweep
        cx = abs ? num() : cx+num();
        cy = abs ? num() : cy+num();
        result.push("L " + cx + " " + cy);
        break;
      }
      case "Z": case "z":
        cx = sx; cy = sy;
        result.push("Z");
        break;
      default:
        // Unknown command — skip
        break;
    }
  }

  return result.join(" ");
}

export async function createVector(params: any) {
  const { pathData: rawPathData, x = 0, y = 0, width, height, name = "Vector", parentId, fillColor, strokeColor, strokeWeight, strokeCap } = params || {};

  if (!rawPathData) {
    throw new Error("Missing pathData parameter");
  }

  // Normalize SVG path to Figma-compatible commands
  const pathData = normalizeSvgPath(rawPathData);

  const vector = figma.createVector();
  vector.name = name;

  // Set the vector paths
  vector.vectorPaths = [{
    windingRule: "NONZERO",
    data: pathData,
  }];

  // Resize to desired dimensions
  if (width && height) {
    vector.resize(width, height);
  }

  vector.x = x;
  vector.y = y;

  // Set fill color if provided
  if (fillColor) {
    applyColorPaint(vector, "fills", fillColor);
  }

  // Set inline stroke if provided (eliminates separate set_stroke_color call)
  if (strokeColor) {
    applyColorPaint(vector, "strokes", strokeColor);
    vector.strokeWeight = strokeWeight || 1;

    // Set stroke cap on vector network vertices if specified
    if (strokeCap) {
      try {
        const network = vector.vectorNetwork;
        if (network && network.vertices && network.vertices.length > 0) {
          const updatedVertices = network.vertices.map(function(v: any) {
            return Object.assign({}, v, { strokeCap: strokeCap });
          });
          await (vector as any).setVectorNetworkAsync(Object.assign({}, network, { vertices: updatedVertices }));
        }
      } catch (e) {
        // strokeCap on vertices may not be supported for all vector types; fall back silently
      }
    }
  } else if (strokeWeight) {
    vector.strokeWeight = strokeWeight;
  }

  // Set opacity if provided
  if (params.opacity !== undefined) {
    vector.opacity = params.opacity;
  }

  // Append to parent or current page
  await appendOrInsertChild(vector, parentId, params.insertAt);

  return {
    id: vector.id,
    name: vector.name,
    x: vector.x,
    y: vector.y,
    width: vector.width,
    height: vector.height,
  };
}

// Create Line (vector with per-vertex stroke caps)
export async function createLine(params: any) {
  var startX = params.startX !== undefined ? params.startX : 0;
  var startY = params.startY !== undefined ? params.startY : 0;
  var endX = params.endX !== undefined ? params.endX : 100;
  var endY = params.endY !== undefined ? params.endY : 0;
  var strokeWeight = params.strokeWeight || 2;
  var strokeColor = params.strokeColor;
  var startCap = params.startCap || "NONE";
  var endCap = params.endCap || "NONE";
  var name = params.name || "Line";
  var parentId = params.parentId;

  // Compute the vector node position (top-left of bounding box)
  var originX = Math.min(startX, endX);
  var originY = Math.min(startY, endY);

  // Vertices use local coordinates relative to the vector node's origin
  var v0x = startX - originX;
  var v0y = startY - originY;
  var v1x = endX - originX;
  var v1y = endY - originY;

  var vec = figma.createVector();
  vec.name = name;
  vec.x = originX;
  vec.y = originY;

  // Set the vector network with per-vertex stroke caps
  await (vec as any).setVectorNetworkAsync({
    vertices: [
      { x: v0x, y: v0y, strokeCap: startCap },
      { x: v1x, y: v1y, strokeCap: endCap },
    ],
    segments: [{ start: 0, end: 1 }],
    regions: [],
  });

  // Resolve stroke color
  var resolvedColor: any = null;
  var varRef: any = null;
  if (strokeColor) {
    var resolved = resolveColorValue(strokeColor);
    resolvedColor = resolved.color;
    varRef = resolved.varRef;
  }

  // Apply stroke paint
  if (resolvedColor) {
    vec.strokes = [
      {
        type: "SOLID",
        color: {
          r: resolvedColor.r !== undefined ? resolvedColor.r : 0,
          g: resolvedColor.g !== undefined ? resolvedColor.g : 0,
          b: resolvedColor.b !== undefined ? resolvedColor.b : 0,
        },
        opacity: resolvedColor.a !== undefined ? resolvedColor.a : 1,
      },
    ];
  } else if (!varRef) {
    // Default black stroke
    vec.strokes = [
      {
        type: "SOLID",
        color: { r: 0, g: 0, b: 0 },
        opacity: 1,
      },
    ];
  }

  // Bind variable if provided
  if (varRef) {
    await bindVariableToColor(vec, "strokes", varRef);
  }

  // Remove default fills (vectors get a default fill)
  vec.fills = [];

  vec.strokeWeight = strokeWeight;

  // Append to parent or current page
  await appendOrInsertChild(vec, parentId, undefined);

  return {
    id: vec.id,
    name: vec.name,
    x: vec.x,
    y: vec.y,
    width: vec.width,
    height: vec.height,
  };
}

export async function setVectorPath(params: any) {
  const { nodeId, pathData, width, height } = params;

  const node: any = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error("Node not found with ID: " + nodeId);
  }
  if (node.type !== "VECTOR") {
    throw new Error("Node is not a VECTOR (type: " + node.type + ")");
  }

  node.vectorPaths = [{
    windingRule: "NONZERO",
    data: normalizeSvgPath(pathData),
  }];

  // Optionally resize to new dimensions (useful when path changes shape)
  if (width !== undefined && height !== undefined) {
    node.resize(width, height);
  }

  return {
    id: node.id,
    name: node.name,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };
}

// --- get_vector_network: Read a vector's vertices, segments, and regions ---
export async function getVectorNetwork(params: any) {
  var nodeId = params.nodeId;

  var node: any = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error("Node not found with ID: " + nodeId);
  }
  if (node.type !== "VECTOR") {
    throw new Error("Node is not a VECTOR (type: " + node.type + ")");
  }

  var network = node.vectorNetwork;
  // Serialize vertices with all relevant properties
  var vertices = network.vertices.map(function(v: any, i: number) {
    var vertex: any = {
      index: i,
      x: v.x,
      y: v.y,
    };
    if (v.strokeCap && v.strokeCap !== "NONE") {
      vertex.strokeCap = v.strokeCap;
    }
    if (v.cornerRadius !== undefined && v.cornerRadius !== 0) {
      vertex.cornerRadius = v.cornerRadius;
    }
    return vertex;
  });

  var segments = network.segments.map(function(s: any, i: number) {
    var segment: any = {
      index: i,
      start: s.start,
      end: s.end,
    };
    // Include tangents if they exist and aren't zero
    if (s.tangentStart && (s.tangentStart.x !== 0 || s.tangentStart.y !== 0)) {
      segment.tangentStart = { x: s.tangentStart.x, y: s.tangentStart.y };
    }
    if (s.tangentEnd && (s.tangentEnd.x !== 0 || s.tangentEnd.y !== 0)) {
      segment.tangentEnd = { x: s.tangentEnd.x, y: s.tangentEnd.y };
    }
    return segment;
  });

  var regions = (network.regions || []).map(function(r: any, i: number) {
    return {
      index: i,
      windingRule: r.windingRule,
      loops: r.loops,
    };
  });

  return {
    id: node.id,
    name: node.name,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    vertexCount: vertices.length,
    segmentCount: segments.length,
    regionCount: regions.length,
    vertices: vertices,
    segments: segments,
    regions: regions,
  };
}

// --- set_vector_network: Update a vector's vertices, segments, and regions ---
export async function setVectorNetwork(params: any) {
  var nodeId = params.nodeId;
  var vertices = params.vertices;
  var segments = params.segments;
  var regions = params.regions || [];

  var node: any = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error("Node not found with ID: " + nodeId);
  }
  if (node.type !== "VECTOR") {
    throw new Error("Node is not a VECTOR (type: " + node.type + ")");
  }

  // Build Figma-compatible vertex objects
  var figmaVertices = vertices.map(function(v: any) {
    var vert: any = { x: v.x, y: v.y };
    if (v.strokeCap) {
      vert.strokeCap = v.strokeCap;
    }
    if (v.cornerRadius !== undefined) {
      vert.cornerRadius = v.cornerRadius;
    }
    return vert;
  });

  // Build Figma-compatible segment objects
  var figmaSegments = segments.map(function(s: any) {
    var seg: any = { start: s.start, end: s.end };
    if (s.tangentStart) {
      seg.tangentStart = { x: s.tangentStart.x, y: s.tangentStart.y };
    }
    if (s.tangentEnd) {
      seg.tangentEnd = { x: s.tangentEnd.x, y: s.tangentEnd.y };
    }
    return seg;
  });

  // Build Figma-compatible region objects
  var figmaRegions = regions.map(function(r: any) {
    return {
      windingRule: r.windingRule || "NONZERO",
      loops: r.loops,
    };
  });

  await node.setVectorNetworkAsync({
    vertices: figmaVertices,
    segments: figmaSegments,
    regions: figmaRegions,
  });

  // Read back the result
  var updatedNetwork = node.vectorNetwork;

  return {
    id: node.id,
    name: node.name,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    vertexCount: updatedNetwork.vertices.length,
    segmentCount: updatedNetwork.segments.length,
    regionCount: (updatedNetwork.regions || []).length,
  };
}
