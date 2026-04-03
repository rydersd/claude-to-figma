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

export function filterFigmaNode(node: any): any {
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
        return filterFigmaNode(child);
      })
      .filter((child: any) => {
        return child !== null;
      });
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

// Apply a solid color paint to a node property (fills or strokes)
export function applyColorPaint(node: any, field: string, colorObj: any) {
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
