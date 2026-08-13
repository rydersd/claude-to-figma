// Shared utility functions for the Figma plugin.
// `figma` is a global provided by the Figma plugin runtime — do NOT import it.

export async function sendProgressUpdate(
  commandId: any,
  commandType: any,
  status: any,
  progress: any,
  totalItems: any,
  processedItems: any,
  message: any,
  payload: any = null
) {
  const update: any = {
    type: "command_progress",
    commandId,
    commandType,
    status,
    progress,
    totalItems,
    processedItems,
    message,
    timestamp: Date.now(),
  };

  // Add optional chunk information if present
  if (payload) {
    if (
      payload.currentChunk !== undefined &&
      payload.totalChunks !== undefined
    ) {
      update.currentChunk = payload.currentChunk;
      update.totalChunks = payload.totalChunks;
      update.chunkSize = payload.chunkSize;
    }
    update.payload = payload;
  }

  // Send to UI
  figma.ui.postMessage(update);
  console.log(`Progress update: ${status} - ${progress}% - ${message}`);

  // Yield so the Figma plugin sandbox flushes postMessage to ui.html
  // before the next iteration begins
  await new Promise((resolve) => setTimeout(resolve, 0));

  return update;
}

// Render a thrown value as a string that keeps the stack. Figma's error toast
// shows only the message, so the throwing frame is lost exactly when it matters
// — "in get_mainComponent: Cannot call with documentAccess: dynamic-page" names
// the API but not the call site. Everything that reports an error back over the
// WebSocket should go through this.
export function formatError(error: any): string {
  if (error === null || error === undefined) return String(error);

  var message =
    typeof error.message === "string" && error.message
      ? error.message
      : String(error);
  var stack = typeof error.stack === "string" ? error.stack : "";

  if (!stack) return message;
  // V8-style stacks already lead with "Error: <message>" — don't repeat it.
  return stack.indexOf(message) !== -1 ? stack : message + "\n" + stack;
}

export function rgbaToHex(color: any) {
  var r = Math.round(color.r * 255);
  var g = Math.round(color.g * 255);
  var b = Math.round(color.b * 255);
  var a = color.a !== undefined ? Math.round(color.a * 255) : 255;

  if (a === 255) {
    return (
      "#" +
      [r, g, b]
        .map((x) => {
          return x.toString(16).padStart(2, "0");
        })
        .join("")
    );
  }

  return (
    "#" +
    [r, g, b, a]
      .map((x) => {
        return x.toString(16).padStart(2, "0");
      })
      .join("")
  );
}

function projectNode(node: any, fields: string[]): any {
  var out: any = {};
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (node[f] !== undefined) out[f] = node[f];
  }
  if (node.children && fields.indexOf("children") !== -1) {
    out.children = node.children.map(function (c: any) {
      return projectNode(c, fields);
    });
  }
  return out;
}

export function filterFigmaNode(node: any, fields?: string[]): any {
  if (node.type === "VECTOR") {
    return null;
  }

  var filtered: any = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  if (node.fills && node.fills.length > 0) {
    filtered.fills = node.fills.map((fill: any) => {
      var processedFill = Object.assign({}, fill);
      delete processedFill.boundVariables;
      delete processedFill.imageRef;

      if (processedFill.gradientStops) {
        processedFill.gradientStops = processedFill.gradientStops.map(
          (stop: any) => {
            var processedStop = Object.assign({}, stop);
            if (processedStop.color) {
              processedStop.color = rgbaToHex(processedStop.color);
            }
            delete processedStop.boundVariables;
            return processedStop;
          }
        );
      }

      if (processedFill.color) {
        processedFill.color = rgbaToHex(processedFill.color);
      }

      return processedFill;
    });
  }

  if (node.strokes && node.strokes.length > 0) {
    filtered.strokes = node.strokes.map((stroke: any) => {
      var processedStroke = Object.assign({}, stroke);
      delete processedStroke.boundVariables;
      if (processedStroke.color) {
        processedStroke.color = rgbaToHex(processedStroke.color);
      }
      return processedStroke;
    });
  }

  if (node.cornerRadius !== undefined) {
    filtered.cornerRadius = safeMixed(node.cornerRadius);
  }

  if (node.absoluteBoundingBox) {
    filtered.absoluteBoundingBox = node.absoluteBoundingBox;
  }

  if (node.characters) {
    filtered.characters = node.characters;
  }

  if (node.style) {
    filtered.style = {
      fontFamily: node.style.fontFamily,
      fontStyle: node.style.fontStyle,
      fontWeight: node.style.fontWeight,
      fontSize: node.style.fontSize,
      textAlignHorizontal: node.style.textAlignHorizontal,
      letterSpacing: node.style.letterSpacing,
      lineHeightPx: node.style.lineHeightPx,
    };
  }

  if (node.children) {
    filtered.children = node.children
      .map((child: any) => {
        return filterFigmaNode(child, fields);
      })
      .filter((child: any) => {
        return child !== null;
      });
  }

  if (fields && fields.length > 0) {
    return projectNode(filtered, fields);
  }

  return filtered;
}

export function customBase64Encode(bytes: any) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let base64 = "";

  const byteLength = bytes.byteLength;
  const byteRemainder = byteLength % 3;
  const mainLength = byteLength - byteRemainder;

  let a, b, c, d;
  let chunk;

  // Main loop deals with bytes in chunks of 3
  for (let i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048) >> 12; // 258048 = (2^6 - 1) << 12
    c = (chunk & 4032) >> 6; // 4032 = (2^6 - 1) << 6
    d = chunk & 63; // 63 = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += chars[a] + chars[b] + chars[c] + chars[d];
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder === 1) {
    chunk = bytes[mainLength];

    a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3) << 4; // 3 = 2^2 - 1

    base64 += chars[a] + chars[b] + "==";
  } else if (byteRemainder === 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];

    a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008) >> 4; // 1008 = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15) << 2; // 15 = 2^4 - 1

    base64 += chars[a] + chars[b] + chars[c] + "=";
  }

  return base64;
}

// Decode base64 to bytes — the plugin sandbox has no atob (counterpart to customBase64Encode)
export function customBase64Decode(base64: string): Uint8Array {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup: Record<string, number> = {};
  for (let i = 0; i < chars.length; i++) lookup[chars[i]] = i;

  const clean = base64.replace(/[\r\n\s]/g, "");
  let padding = 0;
  if (clean.endsWith("==")) padding = 2;
  else if (clean.endsWith("=")) padding = 1;

  const byteLength = (clean.length / 4) * 3 - padding;
  const bytes = new Uint8Array(byteLength);

  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean[i]];
    const b = lookup[clean[i + 1]];
    const c = clean[i + 2] === "=" ? 0 : lookup[clean[i + 2]];
    const d = clean[i + 3] === "=" ? 0 : lookup[clean[i + 3]];
    if (a === undefined || b === undefined) throw new Error("Invalid base64 input");

    const chunk = (a << 18) | (b << 12) | (c << 6) | d;
    if (byteIndex < byteLength) bytes[byteIndex++] = (chunk >> 16) & 255;
    if (byteIndex < byteLength) bytes[byteIndex++] = (chunk >> 8) & 255;
    if (byteIndex < byteLength) bytes[byteIndex++] = chunk & 255;
  }
  return bytes;
}

// Apply an image fill from a spec { base64, scaleMode?, opacity? }.
// Creates the Figma image from bytes and replaces the node's fills.
export function applyImageFill(node: any, imageSpec: any) {
  if (!imageSpec || !imageSpec.base64) throw new Error("Missing image base64 data");
  const bytes = customBase64Decode(imageSpec.base64);
  const image = figma.createImage(bytes); // throws on invalid/oversized (>4096px) images
  const paint: any = {
    type: "IMAGE",
    imageHash: image.hash,
    scaleMode: imageSpec.scaleMode || "FILL",
  };
  if (imageSpec.opacity !== undefined) paint.opacity = imageSpec.opacity;
  node.fills = [paint];
  return { imageHash: image.hash, scaleMode: paint.scaleMode };
}

export function delay(ms: any) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function generateCommandId() {
  return (
    "cmd_" +
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

export function hexToFigmaColor(hex: any) {
  hex = hex.replace(/^#/, "");
  var r, g, b, a = 1;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16) / 255;
    g = parseInt(hex[1] + hex[1], 16) / 255;
    b = parseInt(hex[2] + hex[2], 16) / 255;
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16) / 255;
    g = parseInt(hex.substring(2, 4), 16) / 255;
    b = parseInt(hex.substring(4, 6), 16) / 255;
  } else if (hex.length === 8) {
    r = parseInt(hex.substring(0, 2), 16) / 255;
    g = parseInt(hex.substring(2, 4), 16) / 255;
    b = parseInt(hex.substring(4, 6), 16) / 255;
    a = parseInt(hex.substring(6, 8), 16) / 255;
  } else {
    return null;
  }
  return { r: r, g: g, b: b, a: a };
}

// Resolve a color value: RGBA object passes through, hex string converts, $var: deferred
export function resolveColorValue(colorInput: any) {
  if (!colorInput) return { color: null, varRef: null };
  if (typeof colorInput === "object") {
    return { color: colorInput, varRef: null };
  }
  if (typeof colorInput === "string") {
    if (colorInput.startsWith("$var:")) {
      return { color: null, varRef: colorInput.substring(5) };
    }
    if (colorInput.startsWith("#")) {
      var parsed = hexToFigmaColor(colorInput);
      if (parsed) return { color: parsed, varRef: null };
    }
  }
  return { color: null, varRef: null };
}

// Cache for variable lookups by name path (e.g. "Colors/Primary")
var _variableCache: any = null;
export async function getVariableByName(namePath: any) {
  if (!_variableCache) {
    _variableCache = {};
    var collections = await figma.variables.getLocalVariableCollectionsAsync();
    for (var c = 0; c < collections.length; c++) {
      var collection = collections[c];
      for (var v = 0; v < collection.variableIds.length; v++) {
        var variable = await figma.variables.getVariableByIdAsync(collection.variableIds[v]);
        if (!variable) continue;
        // Index by "Collection/VariableName" and by just "VariableName"
        _variableCache[collection.name + "/" + variable.name] = variable;
        // Also index by variable name alone (for convenience when unambiguous)
        if (!_variableCache[variable.name]) {
          _variableCache[variable.name] = variable;
        }
      }
    }
  }
  return _variableCache[namePath] || null;
}

// Bind a Figma variable to a node's color property
export async function bindVariableToColor(node: any, field: any, varRef: any) {
  var variable = await getVariableByName(varRef);
  if (!variable) {
    console.log("Variable not found: " + varRef + " — skipping binding for " + field);
    return false;
  }
  try {
    node.setBoundVariable(field, variable);
    return true;
  } catch (err: any) {
    console.log("Failed to bind variable " + varRef + " to " + field + ": " + err.message);
    return false;
  }
}

export async function appendOrInsertChild(child: any, parentId: any, insertAt: any) {
  if (parentId) {
    var parentNode: any = await figma.getNodeByIdAsync(parentId);
    if (!parentNode) throw new Error("Parent node not found with ID: " + parentId);
    if (!("appendChild" in parentNode)) throw new Error("Parent node does not support children: " + parentId);
    if (parentNode.type === "SECTION" && child.type !== "FRAME" && child.type !== "GROUP" && child.type !== "SECTION") {
      throw new Error("SECTION nodes can only contain FRAME, GROUP, or SECTION children — got " + child.type + ". Wrap the node in a frame first, or use a frame as the parent.");
    }
    if (insertAt !== undefined && insertAt !== null && "insertChild" in parentNode) {
      parentNode.insertChild(insertAt, child);
    } else {
      parentNode.appendChild(child);
    }
  } else {
    figma.currentPage.appendChild(child);
  }
}

// Helper: sanitize figma.mixed (Symbol) values for postMessage serialization
export function safeMixed(val: any) {
  if (typeof val === "symbol") return "mixed";
  return val;
}

// Map common font weight numbers to Figma font style strings
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

// Detect a gradient value: object with a stops array, or a CSS gradient string
export function isGradientValue(value: any): boolean {
  if (value && typeof value === "object" && Array.isArray(value.stops)) return true;
  if (typeof value === "string" && /^(linear|radial)-gradient\(/.test(value.trim())) return true;
  return false;
}

// CSS angle convention: 0deg = to top, 90deg = to right, clockwise.
// Rotates the gradient axis around the node center (no corner-to-corner scaling).
function gradientTransformFromAngle(deg: number): number[][] {
  var rad = ((deg - 90) * Math.PI) / 180;
  var cos = Math.cos(rad);
  var sin = Math.sin(rad);
  return [
    [cos, sin, 0.5 - 0.5 * cos - 0.5 * sin],
    [-sin, cos, 0.5 + 0.5 * sin - 0.5 * cos],
  ];
}

// Split a CSS argument list on top-level commas (ignores commas inside parens)
function splitTopLevel(str: string): string[] {
  var parts: string[] = [];
  var depth = 0;
  var current = "";
  for (var i = 0; i < str.length; i++) {
    var ch = str[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// Parse a CSS color token: #hex, rgb(...), or rgba(...)
function parseCssColor(token: string): any {
  token = token.trim();
  if (token.startsWith("#")) return hexToFigmaColor(token);
  var m = token.match(/^rgba?\(([^)]*)\)$/);
  if (m) {
    var nums = m[1].split(",").map(function (s) { return parseFloat(s.trim()); });
    if (nums.length >= 3) {
      return {
        r: (nums[0] || 0) / 255,
        g: (nums[1] || 0) / 255,
        b: (nums[2] || 0) / 255,
        a: nums.length > 3 && !isNaN(nums[3]) ? nums[3] : 1,
      };
    }
  }
  return null;
}

var SIDE_ANGLES: Record<string, number> = {
  "to top": 0, "to top right": 45, "to right top": 45,
  "to right": 90, "to bottom right": 135, "to right bottom": 135,
  "to bottom": 180, "to bottom left": 225, "to left bottom": 225,
  "to left": 270, "to top left": 315, "to left top": 315,
};

// Parse "linear-gradient(135deg, #667eea 0%, #764ba2)" or "radial-gradient(...)"
// into a gradient spec { type, angle, stops: [{position, color}] }. Returns null on failure.
export function parseCssGradient(css: string): any {
  var m = css.trim().match(/^(linear|radial)-gradient\((.*)\)$/s);
  if (!m) return null;
  var kind = m[1];
  var parts = splitTopLevel(m[2]);
  if (parts.length === 0) return null;

  var angle = 180; // CSS default: to bottom
  var first = parts[0].toLowerCase();
  if (kind === "linear") {
    var angleMatch = first.match(/^(-?[\d.]+)deg$/);
    if (angleMatch) {
      angle = parseFloat(angleMatch[1]);
      parts.shift();
    } else if (SIDE_ANGLES[first] !== undefined) {
      angle = SIDE_ANGLES[first];
      parts.shift();
    }
  } else {
    // radial: drop a shape/position prelude ("circle", "ellipse at center", ...) if present
    if (/^(circle|ellipse|closest-|farthest-|at )/.test(first)) parts.shift();
  }

  var stops: any[] = [];
  for (var i = 0; i < parts.length; i++) {
    var stopMatch = parts[i].match(/^(.*?)(?:\s+([\d.]+)%)?$/s);
    if (!stopMatch) return null;
    var color = parseCssColor(stopMatch[1]);
    if (!color) return null;
    stops.push({
      color: color,
      position: stopMatch[2] !== undefined ? parseFloat(stopMatch[2]) / 100 : undefined,
    });
  }
  if (stops.length < 2) return null;

  // Fill in missing positions: first=0, last=1, interpolate interior runs
  if (stops[0].position === undefined) stops[0].position = 0;
  if (stops[stops.length - 1].position === undefined) stops[stops.length - 1].position = 1;
  for (var j = 1; j < stops.length - 1; j++) {
    if (stops[j].position === undefined) {
      var prev = j - 1;
      var next = j + 1;
      while (stops[next].position === undefined) next++;
      var span = next - prev;
      for (var k = prev + 1; k < next; k++) {
        stops[k].position = stops[prev].position + ((stops[next].position - stops[prev].position) * (k - prev)) / span;
      }
    }
  }

  return {
    type: kind === "radial" ? "GRADIENT_RADIAL" : "GRADIENT_LINEAR",
    angle: angle,
    stops: stops,
  };
}

// Build a Figma GradientPaint from a gradient spec (object form or CSS string)
export function buildGradientPaint(gradient: any): any {
  var spec = typeof gradient === "string" ? parseCssGradient(gradient) : gradient;
  if (!spec || !Array.isArray(spec.stops) || spec.stops.length < 2) return null;

  var gradientStops: any[] = [];
  for (var i = 0; i < spec.stops.length; i++) {
    var stop = spec.stops[i];
    var color = typeof stop.color === "string" ? hexToFigmaColor(stop.color) : stop.color;
    if (!color) return null;
    gradientStops.push({
      position: stop.position !== undefined ? stop.position : i / (spec.stops.length - 1),
      color: { r: color.r || 0, g: color.g || 0, b: color.b || 0, a: color.a !== undefined ? color.a : 1 },
    });
  }

  var type = spec.type || "GRADIENT_LINEAR";
  var transform = type === "GRADIENT_LINEAR"
    ? gradientTransformFromAngle(spec.angle !== undefined ? spec.angle : 180)
    : [[1, 0, 0], [0, 1, 0]];

  return {
    type: type,
    gradientStops: gradientStops,
    gradientTransform: transform,
  };
}

// Apply a solid or gradient paint to a node property (fills or strokes)
export function applyColorPaint(node: any, field: string, colorObj: any) {
  if (isGradientValue(colorObj)) {
    var paint = buildGradientPaint(colorObj);
    if (paint) {
      node[field] = [paint];
    } else {
      console.warn("[applyColorPaint] Could not parse gradient value; leaving " + field + " unchanged");
    }
    return;
  }
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

// Convert a spec effects array (colors as hex or RGBA) into Figma Effect objects.
// Shared by set_effects and create_node_tree.
export function buildFigmaEffects(effects: any[]): any[] {
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
  return figmaEffects;
}

// Apply uniform and/or per-corner radii from a spec. Per-corner values win over cornerRadius.
export function applyCornerRadii(node: any, spec: any) {
  if (spec.cornerRadius !== undefined && "cornerRadius" in node) {
    node.cornerRadius = spec.cornerRadius;
  }
  var corners = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"];
  for (var i = 0; i < corners.length; i++) {
    var prop = corners[i];
    if (spec[prop] !== undefined && prop in node) {
      node[prop] = spec[prop];
    }
  }
}

// Set layoutPositioning ABSOLUTE on a node already parented into an auto-layout frame,
// restoring the spec's x/y (auto-layout overrides them on append).
export function applyLayoutPositioning(node: any, spec: any) {
  if (spec.layoutPositioning === undefined) return;
  if (!("layoutPositioning" in node)) return;
  try {
    node.layoutPositioning = spec.layoutPositioning;
    if (spec.layoutPositioning === "ABSOLUTE") {
      if (spec.x !== undefined) node.x = spec.x;
      if (spec.y !== undefined) node.y = spec.y;
    }
  } catch (e) {
    // ABSOLUTE requires an auto-layout parent — leave the node in flow if it fails
  }
}

// Helper: load all fonts used in a text node (handles mixed fonts)
export async function loadAllFonts(textNode: any) {
  if (textNode.fontName === figma.mixed) {
    // Get all unique fonts used in the text
    var segments = textNode.getStyledTextSegments(["fontName"]);
    for (var i = 0; i < segments.length; i++) {
      try {
        await figma.loadFontAsync(segments[i].fontName);
      } catch (e) {}
    }
  } else {
    try {
      await figma.loadFontAsync(textNode.fontName);
    } catch (e) {}
  }
}
