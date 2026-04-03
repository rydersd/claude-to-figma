(function () {
  'use strict';

  // src/claude_figma_plugin/src/utils.ts
  async function sendProgressUpdate(commandId, commandType, status, progress, totalItems, processedItems, message, payload = null) {
    const update = {
      type: "command_progress",
      commandId,
      commandType,
      status,
      progress,
      totalItems,
      processedItems,
      message,
      timestamp: Date.now()
    };
    if (payload) {
      if (payload.currentChunk !== void 0 && payload.totalChunks !== void 0) {
        update.currentChunk = payload.currentChunk;
        update.totalChunks = payload.totalChunks;
        update.chunkSize = payload.chunkSize;
      }
      update.payload = payload;
    }
    figma.ui.postMessage(update);
    console.log(`Progress update: ${status} - ${progress}% - ${message}`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    return update;
  }
  function rgbaToHex(color) {
    var r = Math.round(color.r * 255);
    var g = Math.round(color.g * 255);
    var b = Math.round(color.b * 255);
    var a = color.a !== void 0 ? Math.round(color.a * 255) : 255;
    if (a === 255) {
      return "#" + [r, g, b].map((x) => {
        return x.toString(16).padStart(2, "0");
      }).join("");
    }
    return "#" + [r, g, b, a].map((x) => {
      return x.toString(16).padStart(2, "0");
    }).join("");
  }
  function filterFigmaNode(node) {
    if (node.type === "VECTOR") {
      return null;
    }
    var filtered = {
      id: node.id,
      name: node.name,
      type: node.type
    };
    if (node.fills && node.fills.length > 0) {
      filtered.fills = node.fills.map((fill) => {
        var processedFill = Object.assign({}, fill);
        delete processedFill.boundVariables;
        delete processedFill.imageRef;
        if (processedFill.gradientStops) {
          processedFill.gradientStops = processedFill.gradientStops.map(
            (stop) => {
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
      filtered.strokes = node.strokes.map((stroke) => {
        var processedStroke = Object.assign({}, stroke);
        delete processedStroke.boundVariables;
        if (processedStroke.color) {
          processedStroke.color = rgbaToHex(processedStroke.color);
        }
        return processedStroke;
      });
    }
    if (node.cornerRadius !== void 0) {
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
        lineHeightPx: node.style.lineHeightPx
      };
    }
    if (node.children) {
      filtered.children = node.children.map((child) => {
        return filterFigmaNode(child);
      }).filter((child) => {
        return child !== null;
      });
    }
    return filtered;
  }
  function customBase64Encode(bytes) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let base64 = "";
    const byteLength = bytes.byteLength;
    const byteRemainder = byteLength % 3;
    const mainLength = byteLength - byteRemainder;
    let a, b, c, d;
    let chunk;
    for (let i = 0; i < mainLength; i = i + 3) {
      chunk = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
      a = (chunk & 16515072) >> 18;
      b = (chunk & 258048) >> 12;
      c = (chunk & 4032) >> 6;
      d = chunk & 63;
      base64 += chars[a] + chars[b] + chars[c] + chars[d];
    }
    if (byteRemainder === 1) {
      chunk = bytes[mainLength];
      a = (chunk & 252) >> 2;
      b = (chunk & 3) << 4;
      base64 += chars[a] + chars[b] + "==";
    } else if (byteRemainder === 2) {
      chunk = bytes[mainLength] << 8 | bytes[mainLength + 1];
      a = (chunk & 64512) >> 10;
      b = (chunk & 1008) >> 4;
      c = (chunk & 15) << 2;
      base64 += chars[a] + chars[b] + chars[c] + "=";
    }
    return base64;
  }
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function generateCommandId() {
    return "cmd_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  function hexToFigmaColor(hex) {
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
    return { r, g, b, a };
  }
  function resolveColorValue(colorInput) {
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
  var _variableCache = null;
  async function getVariableByName(namePath) {
    if (!_variableCache) {
      _variableCache = {};
      var collections = await figma.variables.getLocalVariableCollectionsAsync();
      for (var c = 0; c < collections.length; c++) {
        var collection = collections[c];
        for (var v = 0; v < collection.variableIds.length; v++) {
          var variable = await figma.variables.getVariableByIdAsync(collection.variableIds[v]);
          if (!variable) continue;
          _variableCache[collection.name + "/" + variable.name] = variable;
          if (!_variableCache[variable.name]) {
            _variableCache[variable.name] = variable;
          }
        }
      }
    }
    return _variableCache[namePath] || null;
  }
  async function bindVariableToColor(node, field, varRef) {
    var variable = await getVariableByName(varRef);
    if (!variable) {
      console.log("Variable not found: " + varRef + " \u2014 skipping binding for " + field);
      return false;
    }
    try {
      node.setBoundVariable(field, variable);
      return true;
    } catch (err) {
      console.log("Failed to bind variable " + varRef + " to " + field + ": " + err.message);
      return false;
    }
  }
  async function appendOrInsertChild(child, parentId, insertAt) {
    if (parentId) {
      var parentNode = await figma.getNodeByIdAsync(parentId);
      if (!parentNode) throw new Error("Parent node not found with ID: " + parentId);
      if (!("appendChild" in parentNode)) throw new Error("Parent node does not support children: " + parentId);
      if (parentNode.type === "SECTION" && child.type !== "FRAME" && child.type !== "GROUP" && child.type !== "SECTION") {
        throw new Error("SECTION nodes can only contain FRAME, GROUP, or SECTION children \u2014 got " + child.type + ". Wrap the node in a frame first, or use a frame as the parent.");
      }
      if (insertAt !== void 0 && insertAt !== null && "insertChild" in parentNode) {
        parentNode.insertChild(insertAt, child);
      } else {
        parentNode.appendChild(child);
      }
    } else {
      figma.currentPage.appendChild(child);
    }
  }
  function safeMixed(val) {
    if (typeof val === "symbol") return "mixed";
    return val;
  }
  function fontWeightToStyle(weight) {
    switch (weight) {
      case 100:
        return "Thin";
      case 200:
        return "Extra Light";
      case 300:
        return "Light";
      case 400:
        return "Regular";
      case 500:
        return "Medium";
      case 600:
        return "Semi Bold";
      case 700:
        return "Bold";
      case 800:
        return "Extra Bold";
      case 900:
        return "Black";
      default:
        return "Regular";
    }
  }
  function applyColorPaint(node, field, colorObj) {
    if (colorObj.a !== void 0 && parseFloat(colorObj.a) === 0) {
      node[field] = [];
    } else {
      node[field] = [{
        type: "SOLID",
        color: {
          r: parseFloat(colorObj.r) || 0,
          g: parseFloat(colorObj.g) || 0,
          b: parseFloat(colorObj.b) || 0
        },
        opacity: colorObj.a !== void 0 ? parseFloat(colorObj.a) : 1
      }];
    }
  }
  async function loadAllFonts(textNode) {
    if (textNode.fontName === figma.mixed) {
      var segments = textNode.getStyledTextSegments(["fontName"]);
      for (var i = 0; i < segments.length; i++) {
        try {
          await figma.loadFontAsync(segments[i].fontName);
        } catch (e) {
        }
      }
    } else {
      try {
        await figma.loadFontAsync(textNode.fontName);
      } catch (e) {
      }
    }
  }

  // src/claude_figma_plugin/src/document.ts
  async function getDocumentInfo() {
    await figma.currentPage.loadAsync();
    const page = figma.currentPage;
    return {
      name: page.name,
      id: page.id,
      type: page.type,
      children: page.children.map((node) => ({
        id: node.id,
        name: node.name,
        type: node.type
      })),
      currentPage: {
        id: page.id,
        name: page.name,
        childCount: page.children.length
      },
      pages: [
        {
          id: page.id,
          name: page.name,
          childCount: page.children.length
        }
      ]
    };
  }
  async function getSelection() {
    return {
      selectionCount: figma.currentPage.selection.length,
      selection: figma.currentPage.selection.map((node) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        visible: node.visible
      }))
    };
  }
  async function getNodeInfo(nodeId) {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    const response = await node.exportAsync({
      format: "JSON_REST_V1"
    });
    return filterFigmaNode(response.document);
  }
  async function getNodesInfo(nodeIds) {
    try {
      const nodes = await Promise.all(
        nodeIds.map((id) => figma.getNodeByIdAsync(id))
      );
      const validNodes = nodes.filter((node) => node !== null);
      const responses = await Promise.all(
        validNodes.map(async (node) => {
          const response = await node.exportAsync({
            format: "JSON_REST_V1"
          });
          return {
            nodeId: node.id,
            document: filterFigmaNode(response.document)
          };
        })
      );
      return responses;
    } catch (error) {
      throw new Error(`Error getting nodes info: ${error.message}`);
    }
  }
  async function readMyDesign() {
    try {
      const nodes = await Promise.all(
        figma.currentPage.selection.map((node) => figma.getNodeByIdAsync(node.id))
      );
      const validNodes = nodes.filter((node) => node !== null);
      const responses = await Promise.all(
        validNodes.map(async (node) => {
          const response = await node.exportAsync({
            format: "JSON_REST_V1"
          });
          return {
            nodeId: node.id,
            document: filterFigmaNode(response.document)
          };
        })
      );
      return responses;
    } catch (error) {
      throw new Error(`Error getting nodes info: ${error.message}`);
    }
  }
  async function getAnnotations(params) {
    try {
      const { nodeId, includeCategories = true } = params;
      let categoriesMap = {};
      if (includeCategories) {
        const categories = await figma.annotations.getAnnotationCategoriesAsync();
        categoriesMap = categories.reduce((map, category) => {
          map[category.id] = {
            id: category.id,
            label: category.label,
            color: category.color,
            isPreset: category.isPreset
          };
          return map;
        }, {});
      }
      if (nodeId) {
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node) {
          throw new Error(`Node not found: ${nodeId}`);
        }
        if (!("annotations" in node)) {
          throw new Error(`Node type ${node.type} does not support annotations`);
        }
        const mergedAnnotations = [];
        const collect = async (n) => {
          if ("annotations" in n && n.annotations && n.annotations.length > 0) {
            for (const a of n.annotations) {
              mergedAnnotations.push({ nodeId: n.id, annotation: a });
            }
          }
          if ("children" in n) {
            for (const child of n.children) {
              await collect(child);
            }
          }
        };
        await collect(node);
        const result = {
          nodeId: node.id,
          name: node.name,
          annotations: mergedAnnotations
        };
        if (includeCategories) {
          result.categories = Object.values(categoriesMap);
        }
        return result;
      } else {
        const annotations = [];
        const processNode = async (node) => {
          if ("annotations" in node && node.annotations && node.annotations.length > 0) {
            annotations.push({
              nodeId: node.id,
              name: node.name,
              annotations: node.annotations
            });
          }
          if ("children" in node) {
            for (const child of node.children) {
              await processNode(child);
            }
          }
        };
        await processNode(figma.currentPage);
        const result = {
          annotatedNodes: annotations
        };
        if (includeCategories) {
          result.categories = Object.values(categoriesMap);
        }
        return result;
      }
    } catch (error) {
      console.error("Error in getAnnotations:", error);
      throw error;
    }
  }
  async function setAnnotation(params) {
    try {
      console.log("=== setAnnotation Debug Start ===");
      console.log("Input params:", JSON.stringify(params, null, 2));
      const { nodeId, annotationId, labelMarkdown, categoryId, properties } = params;
      if (!nodeId) {
        console.error("Validation failed: Missing nodeId");
        return { success: false, error: "Missing nodeId" };
      }
      if (!labelMarkdown) {
        console.error("Validation failed: Missing labelMarkdown");
        return { success: false, error: "Missing labelMarkdown" };
      }
      console.log("Attempting to get node:", nodeId);
      const node = await figma.getNodeByIdAsync(nodeId);
      console.log("Node lookup result:", {
        id: nodeId,
        found: !!node,
        type: node ? node.type : void 0,
        name: node ? node.name : void 0,
        hasAnnotations: node ? "annotations" in node : false
      });
      if (!node) {
        console.error("Node lookup failed:", nodeId);
        return { success: false, error: `Node not found: ${nodeId}` };
      }
      if (!("annotations" in node)) {
        console.error("Node annotation support check failed:", {
          nodeType: node.type,
          nodeId: node.id
        });
        return {
          success: false,
          error: `Node type ${node.type} does not support annotations`
        };
      }
      const newAnnotation = {
        labelMarkdown
      };
      if (categoryId) {
        console.log("Adding categoryId to annotation:", categoryId);
        newAnnotation.categoryId = categoryId;
      }
      if (properties && Array.isArray(properties) && properties.length > 0) {
        console.log(
          "Adding properties to annotation:",
          JSON.stringify(properties, null, 2)
        );
        newAnnotation.properties = properties;
      }
      console.log("Current node annotations:", node.annotations);
      console.log(
        "Setting new annotation:",
        JSON.stringify(newAnnotation, null, 2)
      );
      node.annotations = [newAnnotation];
      console.log("Updated node annotations:", node.annotations);
      console.log("=== setAnnotation Debug End ===");
      return {
        success: true,
        nodeId: node.id,
        name: node.name,
        annotations: node.annotations
      };
    } catch (error) {
      console.error("=== setAnnotation Error ===");
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        params: JSON.stringify(params, null, 2)
      });
      return { success: false, error: error.message };
    }
  }
  async function scanNodesByTypes(params) {
    console.log(`Starting to scan nodes by types from node ID: ${params.nodeId}`);
    const { nodeId, types = [] } = params || {};
    if (!types || types.length === 0) {
      throw new Error("No types specified to search for");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node with ID ${nodeId} not found`);
    }
    const matchingNodes = [];
    const commandId = generateCommandId();
    sendProgressUpdate(
      commandId,
      "scan_nodes_by_types",
      "started",
      0,
      1,
      0,
      `Starting scan of node "${node.name || nodeId}" for types: ${types.join(
      ", "
    )}`,
      null
    );
    await findNodesByTypes(node, types, matchingNodes);
    sendProgressUpdate(
      commandId,
      "scan_nodes_by_types",
      "completed",
      100,
      matchingNodes.length,
      matchingNodes.length,
      `Scan complete. Found ${matchingNodes.length} matching nodes.`,
      { matchingNodes }
    );
    return {
      success: true,
      message: `Found ${matchingNodes.length} matching nodes.`,
      count: matchingNodes.length,
      matchingNodes,
      searchedTypes: types
    };
  }
  async function findNodesByTypes(node, types, matchingNodes = []) {
    if (node.visible === false) return;
    if (types.includes(node.type)) {
      matchingNodes.push({
        id: node.id,
        name: node.name || `Unnamed ${node.type}`,
        type: node.type,
        // Basic bounding box info
        bbox: {
          x: typeof node.x === "number" ? node.x : 0,
          y: typeof node.y === "number" ? node.y : 0,
          width: typeof node.width === "number" ? node.width : 0,
          height: typeof node.height === "number" ? node.height : 0
        }
      });
    }
    if ("children" in node) {
      for (const child of node.children) {
        await findNodesByTypes(child, types, matchingNodes);
      }
    }
  }
  async function setMultipleAnnotations(params) {
    console.log("=== setMultipleAnnotations Debug Start ===");
    console.log("Input params:", JSON.stringify(params, null, 2));
    const { nodeId, annotations } = params;
    if (!annotations || annotations.length === 0) {
      console.error("Validation failed: No annotations provided");
      return { success: false, error: "No annotations provided" };
    }
    console.log(
      `Processing ${annotations.length} annotations for node ${nodeId}`
    );
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    for (let i = 0; i < annotations.length; i++) {
      const annotation = annotations[i];
      console.log(
        `
Processing annotation ${i + 1}/${annotations.length}:`,
        JSON.stringify(annotation, null, 2)
      );
      try {
        console.log("Calling setAnnotation with params:", {
          nodeId: annotation.nodeId,
          labelMarkdown: annotation.labelMarkdown,
          categoryId: annotation.categoryId,
          properties: annotation.properties
        });
        const result = await setAnnotation({
          nodeId: annotation.nodeId,
          labelMarkdown: annotation.labelMarkdown,
          categoryId: annotation.categoryId,
          properties: annotation.properties
        });
        console.log("setAnnotation result:", JSON.stringify(result, null, 2));
        if (result.success) {
          successCount++;
          results.push({ success: true, nodeId: annotation.nodeId });
          console.log(`Annotation ${i + 1} applied successfully`);
        } else {
          failureCount++;
          results.push({
            success: false,
            nodeId: annotation.nodeId,
            error: result.error
          });
          console.error(`Annotation ${i + 1} failed:`, result.error);
        }
      } catch (error) {
        failureCount++;
        const errorResult = {
          success: false,
          nodeId: annotation.nodeId,
          error: error.message
        };
        results.push(errorResult);
        console.error(`Annotation ${i + 1} failed with error:`, error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack
        });
      }
    }
    const summary = {
      success: successCount > 0,
      annotationsApplied: successCount,
      annotationsFailed: failureCount,
      totalAnnotations: annotations.length,
      results
    };
    console.log("\n=== setMultipleAnnotations Summary ===");
    console.log(JSON.stringify(summary, null, 2));
    console.log("=== setMultipleAnnotations Debug End ===");
    return summary;
  }

  // src/claude_figma_plugin/src/text.ts
  async function setTextContent(params) {
    const { nodeId, text } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    if (text === void 0) {
      throw new Error("Missing text parameter");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    if (node.type !== "TEXT") {
      throw new Error(`Node is not a text node: ${nodeId}`);
    }
    try {
      await loadAllFonts(node);
      await setCharacters(node, text);
      return {
        id: node.id,
        name: node.name,
        characters: node.characters,
        fontName: safeMixed(node.fontName)
      };
    } catch (error) {
      throw new Error(`Error setting text content: ${error.message}`);
    }
  }
  function uniqBy(arr, predicate) {
    const cb = typeof predicate === "function" ? predicate : (o) => o[predicate];
    return [
      ...arr.reduce((map, item) => {
        const key = item === null || item === void 0 ? item : cb(item);
        map.has(key) || map.set(key, item);
        return map;
      }, /* @__PURE__ */ new Map()).values()
    ];
  }
  var setCharacters = async (node, characters, options) => {
    const fallbackFont = {
      family: "Inter",
      style: "Regular"
    };
    try {
      if (node.fontName === figma.mixed) {
        if (options && options.smartStrategy === "prevail") ; else if (options && options.smartStrategy === "strict") ; else if (options && options.smartStrategy === "experimental") ; else {
          const firstCharFont = node.getRangeFontName(0, 1);
          await figma.loadFontAsync(firstCharFont);
          node.fontName = firstCharFont;
        }
      } else {
        await figma.loadFontAsync({
          family: node.fontName.family,
          style: node.fontName.style
        });
      }
    } catch (err) {
      console.warn(
        `Failed to load "${node.fontName["family"]} ${node.fontName["style"]}" font and replaced with fallback "${fallbackFont.family} ${fallbackFont.style}"`,
        err
      );
      await figma.loadFontAsync(fallbackFont);
      node.fontName = fallbackFont;
    }
    try {
      node.characters = characters;
      return true;
    } catch (err) {
      console.warn(`Failed to set characters. Skipped.`, err);
      return false;
    }
  };
  var setCharactersWithStrictMatchFont = async (node, characters, fallbackFont) => {
    const fontHashTree = {};
    for (let i = 1; i < node.characters.length; i++) {
      const startIdx = i - 1;
      const startCharFont = node.getRangeFontName(startIdx, i);
      const startCharFontVal = `${startCharFont.family}::${startCharFont.style}`;
      while (i < node.characters.length) {
        i++;
        const charFont = node.getRangeFontName(i - 1, i);
        if (startCharFontVal !== `${charFont.family}::${charFont.style}`) {
          break;
        }
      }
      fontHashTree[`${startIdx}_${i}`] = startCharFontVal;
    }
    await figma.loadFontAsync(fallbackFont);
    node.fontName = fallbackFont;
    node.characters = characters;
    console.log(fontHashTree);
    await Promise.all(
      Object.keys(fontHashTree).map(async (range) => {
        console.log(range, fontHashTree[range]);
        const [start, end] = range.split("_");
        const [family, style] = fontHashTree[range].split("::");
        const matchedFont = {
          family,
          style
        };
        await figma.loadFontAsync(matchedFont);
        return node.setRangeFontName(Number(start), Number(end), matchedFont);
      })
    );
    return true;
  };
  var getDelimiterPos = (str, delimiter, startIdx = 0, endIdx = str.length) => {
    const indices = [];
    let temp = startIdx;
    for (let i = startIdx; i < endIdx; i++) {
      if (str[i] === delimiter && i + startIdx !== endIdx && temp !== i + startIdx) {
        indices.push([temp, i + startIdx]);
        temp = i + startIdx + 1;
      }
    }
    temp !== endIdx && indices.push([temp, endIdx]);
    return indices.filter(Boolean);
  };
  var buildLinearOrder = (node) => {
    const fontTree = [];
    const newLinesPos = getDelimiterPos(node.characters, "\n");
    newLinesPos.forEach(([newLinesRangeStart, newLinesRangeEnd], n) => {
      const newLinesRangeFont = node.getRangeFontName(
        newLinesRangeStart,
        newLinesRangeEnd
      );
      if (newLinesRangeFont === figma.mixed) {
        const spacesPos = getDelimiterPos(
          node.characters,
          " ",
          newLinesRangeStart,
          newLinesRangeEnd
        );
        spacesPos.forEach(([spacesRangeStart, spacesRangeEnd], s) => {
          const spacesRangeFont = node.getRangeFontName(
            spacesRangeStart,
            spacesRangeEnd
          );
          if (spacesRangeFont === figma.mixed) {
            const spacesRangeFont2 = node.getRangeFontName(
              spacesRangeStart,
              spacesRangeStart[0]
            );
            fontTree.push({
              start: spacesRangeStart,
              delimiter: " ",
              family: spacesRangeFont2.family,
              style: spacesRangeFont2.style
            });
          } else {
            fontTree.push({
              start: spacesRangeStart,
              delimiter: " ",
              family: spacesRangeFont.family,
              style: spacesRangeFont.style
            });
          }
        });
      } else {
        fontTree.push({
          start: newLinesRangeStart,
          delimiter: "\n",
          family: newLinesRangeFont.family,
          style: newLinesRangeFont.style
        });
      }
    });
    return fontTree.sort((a, b) => +a.start - +b.start).map(({ family, style, delimiter }) => ({ family, style, delimiter }));
  };
  var setCharactersWithSmartMatchFont = async (node, characters, fallbackFont) => {
    const rangeTree = buildLinearOrder(node);
    const fontsToLoad = uniqBy(
      rangeTree,
      ({ family, style }) => `${family}::${style}`
    ).map(({ family, style }) => ({
      family,
      style
    }));
    await Promise.all([...fontsToLoad, fallbackFont].map(figma.loadFontAsync));
    node.fontName = fallbackFont;
    node.characters = characters;
    let prevPos = 0;
    rangeTree.forEach(({ family, style, delimiter }) => {
      if (prevPos < node.characters.length) {
        const delimeterPos = node.characters.indexOf(delimiter, prevPos);
        const endPos = delimeterPos > prevPos ? delimeterPos : node.characters.length;
        const matchedFont = {
          family,
          style
        };
        node.setRangeFontName(prevPos, endPos, matchedFont);
        prevPos = endPos + 1;
      }
    });
    return true;
  };
  async function scanTextNodes(params) {
    console.log(`Starting to scan text nodes from node ID: ${params.nodeId}`);
    const {
      nodeId,
      useChunking = true,
      chunkSize = 10,
      commandId = generateCommandId()
    } = params || {};
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      console.error(`Node with ID ${nodeId} not found`);
      sendProgressUpdate(
        commandId,
        "scan_text_nodes",
        "error",
        0,
        0,
        0,
        `Node with ID ${nodeId} not found`,
        { error: `Node not found: ${nodeId}` }
      );
      throw new Error(`Node with ID ${nodeId} not found`);
    }
    if (!useChunking) {
      const textNodes = [];
      try {
        sendProgressUpdate(
          commandId,
          "scan_text_nodes",
          "started",
          0,
          1,
          // Not known yet how many nodes there are
          0,
          `Starting scan of node "${node.name || nodeId}" without chunking`,
          null
        );
        await findTextNodes(node, [], 0, textNodes);
        sendProgressUpdate(
          commandId,
          "scan_text_nodes",
          "completed",
          100,
          textNodes.length,
          textNodes.length,
          `Scan complete. Found ${textNodes.length} text nodes.`,
          { textNodes }
        );
        return {
          success: true,
          message: `Scanned ${textNodes.length} text nodes.`,
          count: textNodes.length,
          textNodes,
          commandId
        };
      } catch (error) {
        console.error("Error scanning text nodes:", error);
        sendProgressUpdate(
          commandId,
          "scan_text_nodes",
          "error",
          0,
          0,
          0,
          `Error scanning text nodes: ${error.message}`,
          { error: error.message }
        );
        throw new Error(`Error scanning text nodes: ${error.message}`);
      }
    }
    console.log(`Using chunked scanning with chunk size: ${chunkSize}`);
    const nodesToProcess = [];
    sendProgressUpdate(
      commandId,
      "scan_text_nodes",
      "started",
      0,
      0,
      // Not known yet how many nodes there are
      0,
      `Starting chunked scan of node "${node.name || nodeId}"`,
      { chunkSize }
    );
    await collectNodesToProcess(node, [], 0, nodesToProcess);
    const totalNodes = nodesToProcess.length;
    console.log(`Found ${totalNodes} total nodes to process`);
    const totalChunks = Math.ceil(totalNodes / chunkSize);
    console.log(`Will process in ${totalChunks} chunks`);
    sendProgressUpdate(
      commandId,
      "scan_text_nodes",
      "in_progress",
      5,
      // 5% progress for collection phase
      totalNodes,
      0,
      `Found ${totalNodes} nodes to scan. Will process in ${totalChunks} chunks.`,
      {
        totalNodes,
        totalChunks,
        chunkSize
      }
    );
    const allTextNodes = [];
    let processedNodes = 0;
    let chunksProcessed = 0;
    for (let i = 0; i < totalNodes; i += chunkSize) {
      const chunkEnd = Math.min(i + chunkSize, totalNodes);
      console.log(
        `Processing chunk ${chunksProcessed + 1}/${totalChunks} (nodes ${i} to ${chunkEnd - 1})`
      );
      sendProgressUpdate(
        commandId,
        "scan_text_nodes",
        "in_progress",
        Math.round(5 + chunksProcessed / totalChunks * 90),
        // 5-95% for processing
        totalNodes,
        processedNodes,
        `Processing chunk ${chunksProcessed + 1}/${totalChunks}`,
        {
          currentChunk: chunksProcessed + 1,
          totalChunks,
          textNodesFound: allTextNodes.length
        }
      );
      const chunkNodes = nodesToProcess.slice(i, chunkEnd);
      const chunkTextNodes = [];
      for (const nodeInfo of chunkNodes) {
        if (nodeInfo.node.type === "TEXT") {
          try {
            const textNodeInfo = await processTextNode(
              nodeInfo.node,
              nodeInfo.parentPath,
              nodeInfo.depth
            );
            if (textNodeInfo) {
              chunkTextNodes.push(textNodeInfo);
            }
          } catch (error) {
            console.error(`Error processing text node: ${error.message}`);
          }
        }
        await delay(5);
      }
      allTextNodes.push(...chunkTextNodes);
      processedNodes += chunkNodes.length;
      chunksProcessed++;
      sendProgressUpdate(
        commandId,
        "scan_text_nodes",
        "in_progress",
        Math.round(5 + chunksProcessed / totalChunks * 90),
        // 5-95% for processing
        totalNodes,
        processedNodes,
        `Processed chunk ${chunksProcessed}/${totalChunks}. Found ${allTextNodes.length} text nodes so far.`,
        {
          currentChunk: chunksProcessed,
          totalChunks,
          processedNodes,
          textNodesFound: allTextNodes.length,
          chunkResult: chunkTextNodes
        }
      );
      if (i + chunkSize < totalNodes) {
        await delay(50);
      }
    }
    sendProgressUpdate(
      commandId,
      "scan_text_nodes",
      "completed",
      100,
      totalNodes,
      processedNodes,
      `Scan complete. Found ${allTextNodes.length} text nodes.`,
      {
        textNodes: allTextNodes,
        processedNodes,
        chunks: chunksProcessed
      }
    );
    return {
      success: true,
      message: `Chunked scan complete. Found ${allTextNodes.length} text nodes.`,
      totalNodes: allTextNodes.length,
      processedNodes,
      chunks: chunksProcessed,
      textNodes: allTextNodes,
      commandId
    };
  }
  async function collectNodesToProcess(node, parentPath = [], depth = 0, nodesToProcess = []) {
    if (node.visible === false) return;
    const nodePath = [...parentPath, node.name || `Unnamed ${node.type}`];
    nodesToProcess.push({
      node,
      parentPath: nodePath,
      depth
    });
    if ("children" in node) {
      for (const child of node.children) {
        await collectNodesToProcess(child, nodePath, depth + 1, nodesToProcess);
      }
    }
  }
  async function processTextNode(node, parentPath, depth) {
    if (node.type !== "TEXT") return null;
    try {
      let fontFamily = "";
      let fontStyle = "";
      if (node.fontName) {
        if (typeof node.fontName === "object") {
          if ("family" in node.fontName) fontFamily = node.fontName.family;
          if ("style" in node.fontName) fontStyle = node.fontName.style;
        }
      }
      const safeTextNode = {
        id: node.id,
        name: node.name || "Text",
        type: node.type,
        characters: node.characters,
        fontSize: typeof node.fontSize === "number" ? node.fontSize : 0,
        fontFamily,
        fontStyle,
        x: typeof node.x === "number" ? node.x : 0,
        y: typeof node.y === "number" ? node.y : 0,
        width: typeof node.width === "number" ? node.width : 0,
        height: typeof node.height === "number" ? node.height : 0,
        path: parentPath.join(" > "),
        depth
      };
      try {
        const originalFills = node.fills !== figma.mixed ? JSON.parse(JSON.stringify(node.fills)) : [];
        node.fills = [
          {
            type: "SOLID",
            color: { r: 1, g: 0.5, b: 0 },
            opacity: 0.3
          }
        ];
        await delay(100);
        try {
          node.fills = originalFills;
        } catch (err) {
          console.error("Error resetting fills:", err);
        }
      } catch (highlightErr) {
        console.error("Error highlighting text node:", highlightErr);
      }
      return safeTextNode;
    } catch (nodeErr) {
      console.error("Error processing text node:", nodeErr);
      return null;
    }
  }
  async function findTextNodes(node, parentPath = [], depth = 0, textNodes = []) {
    if (node.visible === false) return;
    const nodePath = [...parentPath, node.name || `Unnamed ${node.type}`];
    if (node.type === "TEXT") {
      try {
        let fontFamily = "";
        let fontStyle = "";
        if (node.fontName) {
          if (typeof node.fontName === "object") {
            if ("family" in node.fontName) fontFamily = node.fontName.family;
            if ("style" in node.fontName) fontStyle = node.fontName.style;
          }
        }
        const safeTextNode = {
          id: node.id,
          name: node.name || "Text",
          type: node.type,
          characters: node.characters,
          fontSize: typeof node.fontSize === "number" ? node.fontSize : 0,
          fontFamily,
          fontStyle,
          x: typeof node.x === "number" ? node.x : 0,
          y: typeof node.y === "number" ? node.y : 0,
          width: typeof node.width === "number" ? node.width : 0,
          height: typeof node.height === "number" ? node.height : 0,
          path: nodePath.join(" > "),
          depth
        };
        try {
          const originalFills = node.fills !== figma.mixed ? JSON.parse(JSON.stringify(node.fills)) : [];
          node.fills = [
            {
              type: "SOLID",
              color: { r: 1, g: 0.5, b: 0 },
              opacity: 0.3
            }
          ];
          await delay(500);
          try {
            node.fills = originalFills;
          } catch (err) {
            console.error("Error resetting fills:", err);
          }
        } catch (highlightErr) {
          console.error("Error highlighting text node:", highlightErr);
        }
        textNodes.push(safeTextNode);
      } catch (nodeErr) {
        console.error("Error processing text node:", nodeErr);
      }
    }
    if ("children" in node) {
      for (const child of node.children) {
        await findTextNodes(child, nodePath, depth + 1, textNodes);
      }
    }
  }
  async function setMultipleTextContents(params) {
    const { nodeId, text } = params || {};
    const commandId = params.commandId || generateCommandId();
    if (!nodeId || !text || !Array.isArray(text)) {
      const errorMsg = "Missing required parameters: nodeId and text array";
      sendProgressUpdate(
        commandId,
        "set_multiple_text_contents",
        "error",
        0,
        0,
        0,
        errorMsg,
        { error: errorMsg }
      );
      throw new Error(errorMsg);
    }
    console.log(
      `Starting text replacement for node: ${nodeId} with ${text.length} text replacements`
    );
    sendProgressUpdate(
      commandId,
      "set_multiple_text_contents",
      "started",
      0,
      text.length,
      0,
      `Starting text replacement for ${text.length} nodes`,
      { totalReplacements: text.length }
    );
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    const CHUNK_SIZE = 5;
    const chunks = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      chunks.push(text.slice(i, i + CHUNK_SIZE));
    }
    console.log(`Split ${text.length} replacements into ${chunks.length} chunks`);
    sendProgressUpdate(
      commandId,
      "set_multiple_text_contents",
      "in_progress",
      5,
      // 5% progress for planning phase
      text.length,
      0,
      `Preparing to replace text in ${text.length} nodes using ${chunks.length} chunks`,
      {
        totalReplacements: text.length,
        chunks: chunks.length,
        chunkSize: CHUNK_SIZE
      }
    );
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      console.log(
        `Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} replacements`
      );
      sendProgressUpdate(
        commandId,
        "set_multiple_text_contents",
        "in_progress",
        Math.round(5 + chunkIndex / chunks.length * 90),
        // 5-95% for processing
        text.length,
        successCount + failureCount,
        `Processing text replacements chunk ${chunkIndex + 1}/${chunks.length}`,
        {
          currentChunk: chunkIndex + 1,
          totalChunks: chunks.length,
          successCount,
          failureCount
        }
      );
      const chunkPromises = chunk.map(async (replacement) => {
        if (!replacement.nodeId || replacement.text === void 0) {
          console.error(`Missing nodeId or text for replacement`);
          return {
            success: false,
            nodeId: replacement.nodeId || "unknown",
            error: "Missing nodeId or text in replacement entry"
          };
        }
        try {
          console.log(
            `Attempting to replace text in node: ${replacement.nodeId}`
          );
          const textNode = await figma.getNodeByIdAsync(replacement.nodeId);
          if (!textNode) {
            console.error(`Text node not found: ${replacement.nodeId}`);
            return {
              success: false,
              nodeId: replacement.nodeId,
              error: `Node not found: ${replacement.nodeId}`
            };
          }
          if (textNode.type !== "TEXT") {
            console.error(
              `Node is not a text node: ${replacement.nodeId} (type: ${textNode.type})`
            );
            return {
              success: false,
              nodeId: replacement.nodeId,
              error: `Node is not a text node: ${replacement.nodeId} (type: ${textNode.type})`
            };
          }
          const originalText = textNode.characters;
          console.log(`Original text: "${originalText}"`);
          console.log(`Will translate to: "${replacement.text}"`);
          let originalFills;
          try {
            originalFills = JSON.parse(JSON.stringify(textNode.fills));
            textNode.fills = [
              {
                type: "SOLID",
                color: { r: 1, g: 0.5, b: 0 },
                opacity: 0.3
              }
            ];
          } catch (highlightErr) {
            console.error(
              `Error highlighting text node: ${highlightErr.message}`
            );
          }
          await setTextContent({
            nodeId: replacement.nodeId,
            text: replacement.text
          });
          if (originalFills) {
            try {
              await delay(500);
              textNode.fills = originalFills;
            } catch (restoreErr) {
              console.error(`Error restoring fills: ${restoreErr.message}`);
            }
          }
          console.log(
            `Successfully replaced text in node: ${replacement.nodeId}`
          );
          return {
            success: true,
            nodeId: replacement.nodeId,
            originalText,
            translatedText: replacement.text
          };
        } catch (error) {
          console.error(
            `Error replacing text in node ${replacement.nodeId}: ${error.message}`
          );
          return {
            success: false,
            nodeId: replacement.nodeId,
            error: `Error applying replacement: ${error.message}`
          };
        }
      });
      const chunkResults = await Promise.all(chunkPromises);
      chunkResults.forEach((result) => {
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
        results.push(result);
      });
      sendProgressUpdate(
        commandId,
        "set_multiple_text_contents",
        "in_progress",
        Math.round(5 + (chunkIndex + 1) / chunks.length * 90),
        // 5-95% for processing
        text.length,
        successCount + failureCount,
        `Completed chunk ${chunkIndex + 1}/${chunks.length}. ${successCount} successful, ${failureCount} failed so far.`,
        {
          currentChunk: chunkIndex + 1,
          totalChunks: chunks.length,
          successCount,
          failureCount,
          chunkResults
        }
      );
      if (chunkIndex < chunks.length - 1) {
        console.log("Pausing between chunks to avoid overloading Figma...");
        await delay(1e3);
      }
    }
    console.log(
      `Replacement complete: ${successCount} successful, ${failureCount} failed`
    );
    sendProgressUpdate(
      commandId,
      "set_multiple_text_contents",
      "completed",
      100,
      text.length,
      successCount + failureCount,
      `Text replacement complete: ${successCount} successful, ${failureCount} failed`,
      {
        totalReplacements: text.length,
        replacementsApplied: successCount,
        replacementsFailed: failureCount,
        completedInChunks: chunks.length,
        results
      }
    );
    return {
      success: successCount > 0,
      nodeId,
      replacementsApplied: successCount,
      replacementsFailed: failureCount,
      totalReplacements: text.length,
      results,
      completedInChunks: chunks.length,
      commandId
    };
  }
  async function setFontFamily(params) {
    const { nodeId, fontFamily, fontStyle = "Regular" } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    if (node.type !== "TEXT") {
      throw new Error(`Node is not a text node: ${nodeId}`);
    }
    await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
    node.fontName = { family: fontFamily, style: fontStyle };
    return {
      id: node.id,
      name: node.name,
      fontFamily,
      fontStyle
    };
  }
  async function setTextAutoResize(params) {
    const { nodeId, textAutoResize } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    if (node.type !== "TEXT") {
      throw new Error(`Node is not a text node: ${nodeId}`);
    }
    await loadAllFonts(node);
    node.textAutoResize = textAutoResize;
    return {
      id: node.id,
      name: node.name,
      textAutoResize: node.textAutoResize
    };
  }
  async function setTextDecoration(params) {
    const { nodeId, decoration } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    if (node.type !== "TEXT") {
      throw new Error(`Node is not a text node: ${nodeId}`);
    }
    await loadAllFonts(node);
    node.textDecoration = decoration;
    return {
      id: node.id,
      name: node.name,
      textDecoration: node.textDecoration
    };
  }
  async function setTextAlign(params) {
    var nodeId = params.nodeId;
    var horizontal = params.horizontal;
    var vertical = params.vertical;
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) throw new Error("Node not found with ID: " + nodeId);
    if (node.type !== "TEXT") throw new Error("Node is not a TEXT node (type: " + node.type + ")");
    if (horizontal !== void 0) {
      var validH = ["LEFT", "CENTER", "RIGHT", "JUSTIFIED"];
      if (validH.indexOf(horizontal) === -1) throw new Error("Invalid horizontal alignment: " + horizontal + ". Must be one of: " + validH.join(", "));
      node.textAlignHorizontal = horizontal;
    }
    if (vertical !== void 0) {
      var validV = ["TOP", "CENTER", "BOTTOM"];
      if (validV.indexOf(vertical) === -1) throw new Error("Invalid vertical alignment: " + vertical + ". Must be one of: " + validV.join(", "));
      node.textAlignVertical = vertical;
    }
    return {
      id: node.id,
      name: node.name,
      textAlignHorizontal: node.textAlignHorizontal,
      textAlignVertical: node.textAlignVertical
    };
  }
  async function setTextFormat(params) {
    var nodeId = params.nodeId;
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) throw new Error("Node not found with ID: " + nodeId);
    if (node.type !== "TEXT") throw new Error("Node is not a TEXT node (type: " + node.type + ")");
    await loadAllFonts(node);
    if (params.lineHeight !== void 0) {
      if (params.lineHeight === "AUTO") {
        node.lineHeight = { unit: "AUTO" };
      } else if (typeof params.lineHeight === "number") {
        node.lineHeight = { value: params.lineHeight, unit: "PIXELS" };
      } else if (params.lineHeight.value !== void 0 && params.lineHeight.unit !== void 0) {
        node.lineHeight = params.lineHeight;
      }
    }
    if (params.paragraphIndent !== void 0) {
      node.paragraphIndent = params.paragraphIndent;
    }
    if (params.paragraphSpacing !== void 0) {
      node.paragraphSpacing = params.paragraphSpacing;
    }
    if (params.letterSpacing !== void 0) {
      if (typeof params.letterSpacing === "number") {
        node.letterSpacing = { value: params.letterSpacing, unit: "PIXELS" };
      } else if (params.letterSpacing.value !== void 0 && params.letterSpacing.unit !== void 0) {
        node.letterSpacing = params.letterSpacing;
      }
    }
    if (params.textCase !== void 0) {
      node.textCase = params.textCase;
    }
    if (params.leadingTrim !== void 0) {
      node.leadingTrim = params.leadingTrim;
    }
    if (params.hangingPunctuation !== void 0) {
      node.hangingPunctuation = !!params.hangingPunctuation;
    }
    if (params.hangingList !== void 0) {
      node.hangingList = !!params.hangingList;
    }
    if (params.listSpacing !== void 0) {
      node.listSpacing = params.listSpacing;
    }
    if (params.textTruncation !== void 0) {
      node.textTruncation = params.textTruncation;
    }
    if (params.maxLines !== void 0) {
      node.maxLines = params.maxLines;
    }
    return {
      id: node.id,
      name: node.name,
      lineHeight: safeMixed(node.lineHeight),
      paragraphIndent: node.paragraphIndent,
      paragraphSpacing: node.paragraphSpacing,
      letterSpacing: safeMixed(node.letterSpacing),
      textCase: safeMixed(node.textCase),
      hangingPunctuation: node.hangingPunctuation,
      hangingList: node.hangingList,
      listSpacing: node.listSpacing,
      textTruncation: node.textTruncation,
      maxLines: node.maxLines
    };
  }
  async function setTextList(params) {
    var nodeId = params.nodeId;
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) throw new Error("Node not found with ID: " + nodeId);
    if (node.type !== "TEXT") throw new Error("Node is not a TEXT node (type: " + node.type + ")");
    await loadAllFonts(node);
    var lines = params.lines;
    var listType = params.listType || "UNORDERED";
    var start = 0;
    var end = node.characters.length;
    if (lines && Array.isArray(lines)) {
      var text = node.characters;
      var lineStarts = [0];
      for (var i = 0; i < text.length; i++) {
        if (text[i] === "\n") lineStarts.push(i + 1);
      }
      lineStarts.push(text.length);
      for (var li = 0; li < lines.length; li++) {
        var lineSpec = lines[li];
        var lineIdx = lineSpec.line;
        if (lineIdx < 0 || lineIdx >= lineStarts.length - 1) continue;
        var ls = lineStarts[lineIdx];
        var le = lineStarts[lineIdx + 1];
        if (le > ls && text[le - 1] === "\n") le--;
        if (le <= ls) continue;
        var lt = lineSpec.type || listType;
        node.setRangeListOptions(ls, le, { type: lt });
        if (lineSpec.indentation !== void 0) {
          node.setRangeIndentation(ls, le, lineSpec.indentation);
        }
      }
    } else {
      node.setRangeListOptions(start, end, { type: listType });
      if (params.indentation !== void 0) {
        node.setRangeIndentation(start, end, params.indentation);
      }
    }
    if (params.listSpacing !== void 0) {
      node.listSpacing = params.listSpacing;
    }
    if (params.hangingList !== void 0) {
      node.hangingList = !!params.hangingList;
    }
    return {
      id: node.id,
      name: node.name,
      characters: node.characters,
      listSpacing: node.listSpacing,
      hangingList: node.hangingList
    };
  }
  async function setRangeFormat(params) {
    var nodeId = params.nodeId;
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) throw new Error("Node not found with ID: " + nodeId);
    if (node.type !== "TEXT") throw new Error("Node is not a TEXT node (type: " + node.type + ")");
    await loadAllFonts(node);
    var ranges = params.ranges;
    if (!ranges || !Array.isArray(ranges) || ranges.length === 0) {
      throw new Error("Missing or empty ranges array");
    }
    var results = [];
    for (var ri = 0; ri < ranges.length; ri++) {
      var range = ranges[ri];
      var start = range.start;
      var end = range.end;
      if (start === void 0 || end === void 0) {
        results.push({ index: ri, success: false, error: "Missing start or end" });
        continue;
      }
      if (start < 0 || end > node.characters.length || start >= end) {
        results.push({ index: ri, success: false, error: "Invalid range: start=" + start + " end=" + end + " length=" + node.characters.length });
        continue;
      }
      try {
        if (range.fontFamily !== void 0) {
          var fontStyle = range.fontStyle || "Regular";
          await figma.loadFontAsync({ family: range.fontFamily, style: fontStyle });
          node.setRangeFontName(start, end, { family: range.fontFamily, style: fontStyle });
        }
        if (range.fontSize !== void 0) {
          node.setRangeFontSize(start, end, range.fontSize);
        }
        if (range.color !== void 0) {
          var color = range.color;
          if (typeof color === "string") {
            color = hexToFigmaColor(color);
            if (!color) throw new Error("Invalid hex color");
          }
          node.setRangeFills(start, end, [{
            type: "SOLID",
            color: { r: color.r, g: color.g, b: color.b },
            opacity: color.a !== void 0 ? color.a : 1
          }]);
        }
        if (range.textCase !== void 0) {
          node.setRangeTextCase(start, end, range.textCase);
        }
        if (range.textDecoration !== void 0) {
          node.setRangeTextDecoration(start, end, range.textDecoration);
        }
        if (range.letterSpacing !== void 0) {
          if (typeof range.letterSpacing === "number") {
            node.setRangeLetterSpacing(start, end, { value: range.letterSpacing, unit: "PIXELS" });
          } else {
            node.setRangeLetterSpacing(start, end, range.letterSpacing);
          }
        }
        if (range.lineHeight !== void 0) {
          if (range.lineHeight === "AUTO") {
            node.setRangeLineHeight(start, end, { unit: "AUTO" });
          } else if (typeof range.lineHeight === "number") {
            node.setRangeLineHeight(start, end, { value: range.lineHeight, unit: "PIXELS" });
          } else {
            node.setRangeLineHeight(start, end, range.lineHeight);
          }
        }
        if (range.listType !== void 0) {
          node.setRangeListOptions(start, end, { type: range.listType });
        }
        if (range.indentation !== void 0) {
          node.setRangeIndentation(start, end, range.indentation);
        }
        if (range.hyperlink !== void 0) {
          node.setRangeHyperlink(start, end, range.hyperlink);
        }
        results.push({ index: ri, success: true, start, end });
      } catch (e) {
        results.push({ index: ri, success: false, start, end, error: e.message || String(e) });
      }
    }
    var successCount = 0;
    var failureCount = 0;
    for (var i = 0; i < results.length; i++) {
      if (results[i].success) successCount++;
      else failureCount++;
    }
    return {
      id: node.id,
      name: node.name,
      totalRanges: ranges.length,
      successCount,
      failureCount,
      results
    };
  }

  // src/claude_figma_plugin/src/creation.ts
  async function createRectangle(params) {
    const {
      x = 0,
      y = 0,
      width = 100,
      height = 100,
      name = "Rectangle",
      parentId,
      fillColor
    } = params || {};
    const rect = figma.createRectangle();
    rect.x = x;
    rect.y = y;
    rect.resize(width, height);
    rect.name = name;
    if (params.cornerRadius !== void 0) {
      rect.cornerRadius = params.cornerRadius;
    }
    if (fillColor) {
      applyColorPaint(rect, "fills", fillColor);
    }
    if (params.strokeColor) {
      applyColorPaint(rect, "strokes", params.strokeColor);
    }
    if (params.strokeWeight !== void 0) {
      rect.strokeWeight = params.strokeWeight;
    }
    if (params.opacity !== void 0) {
      rect.opacity = params.opacity;
    }
    await appendOrInsertChild(rect, parentId, params.insertAt);
    return {
      id: rect.id,
      name: rect.name,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      parentId: rect.parent ? rect.parent.id : void 0
    };
  }
  async function createFrame(params, firstOnTop = true) {
    const {
      x = 0,
      y = 0,
      width = 100,
      height = 100,
      name = "Frame",
      parentId,
      fillColor,
      strokeColor,
      strokeWeight,
      layoutMode = "NONE",
      layoutWrap = "NO_WRAP",
      paddingTop = 10,
      paddingRight = 10,
      paddingBottom = 10,
      paddingLeft = 10,
      primaryAxisAlignItems = "MIN",
      counterAxisAlignItems = "MIN",
      layoutSizingHorizontal = "FIXED",
      layoutSizingVertical = "FIXED",
      itemSpacing = 0
    } = params || {};
    const frame = figma.createFrame();
    frame.x = x;
    frame.y = y;
    frame.resize(width, height);
    frame.name = name;
    if (params.clipsContent !== void 0) {
      frame.clipsContent = !!params.clipsContent;
    }
    if (params.cornerRadius !== void 0) {
      frame.cornerRadius = params.cornerRadius;
    }
    if (params.opacity !== void 0) {
      frame.opacity = params.opacity;
    }
    if (layoutMode !== "NONE") {
      frame.layoutMode = layoutMode;
      frame.layoutWrap = layoutWrap;
      if (params.itemReverseZIndex !== void 0) {
        frame.itemReverseZIndex = !!params.itemReverseZIndex;
      } else if (firstOnTop) {
        frame.itemReverseZIndex = true;
      }
      frame.paddingTop = paddingTop;
      frame.paddingRight = paddingRight;
      frame.paddingBottom = paddingBottom;
      frame.paddingLeft = paddingLeft;
      frame.primaryAxisAlignItems = primaryAxisAlignItems;
      frame.counterAxisAlignItems = counterAxisAlignItems;
      if (layoutSizingHorizontal !== "FILL" && layoutSizingVertical !== "FILL") {
        frame.layoutSizingHorizontal = layoutSizingHorizontal;
        frame.layoutSizingVertical = layoutSizingVertical;
      }
      frame.itemSpacing = itemSpacing;
      if (params.counterAxisSpacing !== void 0 && layoutWrap === "WRAP") {
        frame.counterAxisSpacing = params.counterAxisSpacing;
      }
    }
    if (fillColor) {
      applyColorPaint(frame, "fills", fillColor);
    }
    if (strokeColor) {
      applyColorPaint(frame, "strokes", strokeColor);
    }
    if (strokeWeight !== void 0) {
      frame.strokeWeight = strokeWeight;
    }
    await appendOrInsertChild(frame, parentId, params.insertAt);
    if (layoutMode !== "NONE") {
      if (layoutSizingHorizontal === "FILL" || layoutSizingVertical === "FILL") {
        try {
          frame.layoutSizingHorizontal = layoutSizingHorizontal;
          frame.layoutSizingVertical = layoutSizingVertical;
        } catch (e) {
          if (layoutSizingHorizontal === "FILL") {
            try {
              frame.layoutSizingHorizontal = "FILL";
            } catch (e2) {
              frame.layoutSizingHorizontal = "FIXED";
            }
          }
          if (layoutSizingVertical === "FILL") {
            try {
              frame.layoutSizingVertical = "FILL";
            } catch (e2) {
              frame.layoutSizingVertical = "FIXED";
            }
          }
        }
      }
    }
    return {
      id: frame.id,
      name: frame.name,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      fills: frame.fills,
      strokes: frame.strokes,
      strokeWeight: frame.strokeWeight,
      layoutMode: frame.layoutMode,
      layoutWrap: frame.layoutWrap,
      itemReverseZIndex: frame.itemReverseZIndex,
      parentId: frame.parent ? frame.parent.id : void 0
    };
  }
  async function createText(params) {
    const {
      x = 0,
      y = 0,
      text = "Text",
      fontSize = 14,
      fontWeight = 400,
      fontColor = { r: 0, g: 0, b: 0, a: 1 },
      // Default to black
      name = "",
      parentId,
      width
    } = params || {};
    const userFontFamily = params.fontFamily || "Inter";
    const userFontStyle = params.fontStyle || fontWeightToStyle(fontWeight);
    const textNode = figma.createText();
    textNode.x = x;
    textNode.y = y;
    textNode.name = name || text;
    try {
      await figma.loadFontAsync({
        family: userFontFamily,
        style: userFontStyle
      });
      textNode.fontName = { family: userFontFamily, style: userFontStyle };
      textNode.fontSize = parseInt(fontSize);
    } catch (error) {
      console.error("Error setting font", error);
      try {
        await figma.loadFontAsync({ family: "Inter", style: fontWeightToStyle(fontWeight) });
        textNode.fontName = { family: "Inter", style: fontWeightToStyle(fontWeight) };
        textNode.fontSize = parseInt(fontSize);
      } catch (fallbackError) {
        console.error("Error setting fallback font", fallbackError);
      }
    }
    await setCharacters(textNode, text);
    applyColorPaint(textNode, "fills", fontColor);
    if (params.textAlignHorizontal) {
      textNode.textAlignHorizontal = params.textAlignHorizontal;
    }
    if (params.lineHeight !== void 0) {
      textNode.lineHeight = { value: params.lineHeight, unit: "PIXELS" };
    }
    if (params.letterSpacing !== void 0) {
      textNode.letterSpacing = { value: params.letterSpacing, unit: "PIXELS" };
    }
    if (params.textCase) {
      textNode.textCase = params.textCase;
    }
    if (params.opacity !== void 0) {
      textNode.opacity = params.opacity;
    }
    if (width) {
      textNode.resize(width, textNode.height);
      textNode.textAutoResize = "HEIGHT";
    }
    await appendOrInsertChild(textNode, parentId, params.insertAt);
    return {
      id: textNode.id,
      name: textNode.name,
      x: textNode.x,
      y: textNode.y,
      width: textNode.width,
      height: textNode.height,
      characters: textNode.characters,
      fontSize: textNode.fontSize,
      fontWeight,
      fontColor,
      fontName: textNode.fontName,
      fills: textNode.fills,
      parentId: textNode.parent ? textNode.parent.id : void 0
    };
  }
  async function createEllipse(params) {
    var x = params.x || 0;
    var y = params.y || 0;
    var width = params.width || 100;
    var height = params.height || 100;
    var name = params.name || "Ellipse";
    var parentId = params.parentId;
    var ellipse = figma.createEllipse();
    ellipse.x = x;
    ellipse.y = y;
    ellipse.resize(width, height);
    ellipse.name = name;
    if (params.fillColor) {
      var fc = params.fillColor;
      if (typeof fc === "string") {
        fc = hexToFigmaColor(fc) || { r: 0.85, g: 0.85, b: 0.85, a: 1 };
      }
      applyColorPaint(ellipse, "fills", fc);
    }
    if (params.strokeColor) {
      var sc = params.strokeColor;
      if (typeof sc === "string") {
        sc = hexToFigmaColor(sc) || { r: 0, g: 0, b: 0, a: 1 };
      }
      applyColorPaint(ellipse, "strokes", sc);
    }
    if (params.strokeWeight !== void 0) {
      ellipse.strokeWeight = params.strokeWeight;
    }
    if (params.arcData) {
      ellipse.arcData = {
        startingAngle: params.arcData.startingAngle || 0,
        endingAngle: params.arcData.endingAngle || 6.2831853,
        innerRadius: params.arcData.innerRadius || 0
      };
    }
    await appendOrInsertChild(ellipse, parentId, params.insertAt);
    return {
      id: ellipse.id,
      name: ellipse.name,
      x: ellipse.x,
      y: ellipse.y,
      width: ellipse.width,
      height: ellipse.height
    };
  }
  async function createSection(params) {
    const { name = "Section", x = 0, y = 0, width = 1e3, height = 1e3, childIds } = params || {};
    const section = figma.createSection();
    section.name = name;
    section.x = x;
    section.y = y;
    section.resizeWithoutConstraints(width, height);
    let childCount = 0;
    if (childIds && Array.isArray(childIds)) {
      for (const childId of childIds) {
        const childNode = await figma.getNodeByIdAsync(childId);
        if (childNode) {
          section.appendChild(childNode);
          childCount++;
        }
      }
    }
    figma.currentPage.appendChild(section);
    return {
      id: section.id,
      name: section.name,
      childCount
    };
  }
  async function createSvg(params) {
    var svgString = params.svg;
    var frame = figma.createNodeFromSvg(svgString);
    if (params.name) frame.name = params.name;
    if (params.x !== void 0) frame.x = params.x;
    if (params.y !== void 0) frame.y = params.y;
    if (params.width && params.height) frame.resize(params.width, params.height);
    await appendOrInsertChild(frame, params.parentId, params.insertAt);
    return {
      id: frame.id,
      name: frame.name,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      childCount: frame.children.length
    };
  }

  // src/claude_figma_plugin/src/styling.ts
  async function setFillColor(params) {
    console.log("setFillColor", params);
    const {
      nodeId,
      color: { r, g, b, a }
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
    if (a !== void 0 && parseFloat(a) === 0) {
      node.fills = [];
      return {
        id: node.id,
        name: node.name,
        fills: []
      };
    }
    const rgbColor = {
      r: parseFloat(r) || 0,
      g: parseFloat(g) || 0,
      b: parseFloat(b) || 0,
      a: a !== void 0 ? parseFloat(a) : 1
    };
    const paintStyle = {
      type: "SOLID",
      color: {
        r: parseFloat(rgbColor.r),
        g: parseFloat(rgbColor.g),
        b: parseFloat(rgbColor.b)
      },
      opacity: rgbColor.a !== void 0 ? parseFloat(rgbColor.a) : 1
    };
    console.log("paintStyle", paintStyle);
    node.fills = [paintStyle];
    return {
      id: node.id,
      name: node.name,
      fills: [paintStyle]
    };
  }
  async function batchSetFillColor(params) {
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
    const results = [];
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
          error: error instanceof Error ? error.message : String(error)
        });
        failureCount++;
      }
      if (useProgress && (i + 1) % 5 === 0) {
        const progress = Math.round((i + 1) / totalItems * 100);
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
      results
    };
  }
  async function setStrokeColor(params) {
    const {
      nodeId,
      color: { r, g, b, a },
      weight = 1
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
    const rgbColor = {
      r: r !== void 0 ? r : 0,
      g: g !== void 0 ? g : 0,
      b: b !== void 0 ? b : 0,
      a: a !== void 0 ? a : 1
    };
    const paintStyle = {
      type: "SOLID",
      color: {
        r: rgbColor.r,
        g: rgbColor.g,
        b: rgbColor.b
      },
      opacity: rgbColor.a
    };
    node.strokes = [paintStyle];
    if ("strokeWeight" in node) {
      node.strokeWeight = weight;
    }
    return {
      id: node.id,
      name: node.name,
      strokes: node.strokes,
      strokeWeight: "strokeWeight" in node ? safeMixed(node.strokeWeight) : void 0
    };
  }
  async function setCornerRadius(params) {
    const { nodeId, radius, corners } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    if (radius === void 0) {
      throw new Error("Missing radius parameter");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    if (!("cornerRadius" in node)) {
      throw new Error(`Node does not support corner radius: ${nodeId}`);
    }
    if (corners && Array.isArray(corners) && corners.length === 4) {
      if ("topLeftRadius" in node) {
        node.topLeftRadius = corners[0] ? radius : 0;
        node.topRightRadius = corners[1] ? radius : 0;
        node.bottomRightRadius = corners[2] ? radius : 0;
        node.bottomLeftRadius = corners[3] ? radius : 0;
      } else {
        node.cornerRadius = radius;
      }
    } else {
      node.cornerRadius = radius;
    }
    return {
      id: node.id,
      name: node.name,
      cornerRadius: safeMixed("cornerRadius" in node ? node.cornerRadius : void 0),
      topLeftRadius: "topLeftRadius" in node ? node.topLeftRadius : void 0,
      topRightRadius: "topRightRadius" in node ? node.topRightRadius : void 0,
      bottomRightRadius: "bottomRightRadius" in node ? node.bottomRightRadius : void 0,
      bottomLeftRadius: "bottomLeftRadius" in node ? node.bottomLeftRadius : void 0
    };
  }
  async function removeFill(params) {
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
      name: node.name
    };
  }
  async function setStrokeDash(params) {
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
      dashPattern: node.dashPattern
    };
  }
  async function setStrokeProperties(params) {
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
    if (weight !== void 0) {
      node.strokeWeight = weight;
    }
    if (cap !== void 0) {
      node.strokeCap = cap;
    }
    if (join !== void 0) {
      node.strokeJoin = join;
    }
    if (align !== void 0) {
      node.strokeAlign = align;
    }
    if (dashPattern !== void 0) {
      node.dashPattern = dashPattern;
    }
    return {
      id: node.id,
      name: node.name,
      strokeWeight: safeMixed(node.strokeWeight),
      strokeCap: safeMixed(node.strokeCap),
      strokeJoin: safeMixed(node.strokeJoin),
      strokeAlign: node.strokeAlign,
      dashPattern: safeMixed(node.dashPattern)
    };
  }
  async function setClipsContent(params) {
    var nodeId = params.nodeId;
    var clipsContent = params.clipsContent;
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) throw new Error("Node not found with ID: " + nodeId);
    if (!("clipsContent" in node)) throw new Error("Node does not support clipsContent (type: " + node.type + ")");
    node.clipsContent = !!clipsContent;
    return {
      id: node.id,
      name: node.name,
      clipsContent: node.clipsContent
    };
  }
  async function setEffects(params) {
    var nodeId = params.nodeId;
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) throw new Error("Node not found with ID: " + nodeId);
    if (!("effects" in node)) throw new Error("Node does not support effects (type: " + node.type + ")");
    var effects = params.effects;
    if (!effects || !Array.isArray(effects)) throw new Error("Missing or invalid effects array");
    var figmaEffects = [];
    for (var i = 0; i < effects.length; i++) {
      var e = effects[i];
      var effect = {
        type: e.type,
        visible: e.visible !== false
      };
      if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
        var color = e.color || { r: 0, g: 0, b: 0, a: 0.25 };
        if (typeof color === "string") {
          var parsed = hexToFigmaColor(color);
          if (parsed) color = parsed;
          else color = { r: 0, g: 0, b: 0, a: 0.25 };
        }
        effect.color = { r: color.r || 0, g: color.g || 0, b: color.b || 0, a: color.a !== void 0 ? color.a : 0.25 };
        effect.offset = { x: e.offset && e.offset.x || 0, y: e.offset && e.offset.y || 4 };
        effect.radius = e.radius !== void 0 ? e.radius : 4;
        effect.spread = e.spread !== void 0 ? e.spread : 0;
        if (e.blendMode) effect.blendMode = e.blendMode;
      } else if (e.type === "LAYER_BLUR" || e.type === "BACKGROUND_BLUR") {
        effect.radius = e.radius !== void 0 ? e.radius : 4;
      }
      figmaEffects.push(effect);
    }
    node.effects = figmaEffects;
    return {
      id: node.id,
      name: node.name,
      effectCount: figmaEffects.length,
      effects: figmaEffects
    };
  }
  async function setOpacity(params) {
    var nodeId = params.nodeId;
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) throw new Error("Node not found with ID: " + nodeId);
    if (!("opacity" in node)) throw new Error("Node does not support opacity (type: " + node.type + ")");
    node.opacity = params.opacity;
    return {
      id: node.id,
      name: node.name,
      opacity: node.opacity
    };
  }
  async function setBlendMode(params) {
    var nodeId = params.nodeId;
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) throw new Error("Node not found with ID: " + nodeId);
    if (!("blendMode" in node)) throw new Error("Node does not support blendMode (type: " + node.type + ")");
    node.blendMode = params.blendMode;
    return {
      id: node.id,
      name: node.name,
      blendMode: node.blendMode
    };
  }
  async function setRotation(params) {
    var nodeId = params.nodeId;
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) throw new Error("Node not found with ID: " + nodeId);
    if (!("rotation" in node)) throw new Error("Node does not support rotation (type: " + node.type + ")");
    node.rotation = params.rotation;
    return {
      id: node.id,
      name: node.name,
      rotation: node.rotation
    };
  }
  async function setConstraints(params) {
    var nodeId = params.nodeId;
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) throw new Error("Node not found with ID: " + nodeId);
    if (!("constraints" in node)) throw new Error("Node does not support constraints (type: " + node.type + ")");
    var c = {};
    var current = node.constraints;
    c.horizontal = params.horizontal || current.horizontal;
    c.vertical = params.vertical || current.vertical;
    node.constraints = c;
    return {
      id: node.id,
      name: node.name,
      constraints: node.constraints
    };
  }
  async function setMinMaxSize(params) {
    var nodeId = params.nodeId;
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) throw new Error("Node not found with ID: " + nodeId);
    if (params.minWidth !== void 0) node.minWidth = params.minWidth;
    if (params.maxWidth !== void 0) node.maxWidth = params.maxWidth;
    if (params.minHeight !== void 0) node.minHeight = params.minHeight;
    if (params.maxHeight !== void 0) node.maxHeight = params.maxHeight;
    return {
      id: node.id,
      name: node.name,
      minWidth: node.minWidth,
      maxWidth: node.maxWidth,
      minHeight: node.minHeight,
      maxHeight: node.maxHeight
    };
  }
  async function setMask(params) {
    var nodeId = params.nodeId;
    var isMask = params.isMask !== false;
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) throw new Error("Node not found with ID: " + nodeId);
    if (!("isMask" in node)) throw new Error("Node does not support isMask (type: " + node.type + ")");
    if (isMask && params.groupWithIds && Array.isArray(params.groupWithIds)) {
      var siblings = [node];
      for (var i = 0; i < params.groupWithIds.length; i++) {
        var sibling = await figma.getNodeByIdAsync(params.groupWithIds[i]);
        if (sibling) siblings.push(sibling);
      }
      if (siblings.length > 1) {
        var group = figma.group(siblings, node.parent);
        if (params.groupName) group.name = params.groupName;
        var maskNode = await figma.getNodeByIdAsync(nodeId);
        if (maskNode && "isMask" in maskNode) {
          maskNode.isMask = true;
        }
        return {
          maskNodeId: nodeId,
          isMask: true,
          groupId: group.id,
          groupName: group.name,
          childCount: group.children.length
        };
      }
    }
    node.isMask = isMask;
    return {
      id: node.id,
      name: node.name,
      isMask: node.isMask
    };
  }

  // src/claude_figma_plugin/src/transforms.ts
  async function moveNode(params) {
    const { nodeId, x, y } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    if (x === void 0 || y === void 0) {
      throw new Error("Missing x or y parameters");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    if (!("x" in node) || !("y" in node)) {
      throw new Error(`Node does not support position: ${nodeId}`);
    }
    node.x = x;
    node.y = y;
    return {
      id: node.id,
      name: node.name,
      x: node.x,
      y: node.y
    };
  }
  async function resizeNode(params) {
    const { nodeId, width, height } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    if (width === void 0 || height === void 0) {
      throw new Error("Missing width or height parameters");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    if (!("resize" in node) && !("resizeWithoutConstraints" in node)) {
      throw new Error(`Node does not support resizing: ${nodeId}`);
    }
    if ("resize" in node) {
      node.resize(width, height);
    } else {
      node.resizeWithoutConstraints(width, height);
    }
    return {
      id: node.id,
      name: node.name,
      width: node.width,
      height: node.height
    };
  }
  async function deleteNode(params) {
    const { nodeId } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    const nodeInfo = {
      id: node.id,
      name: node.name,
      type: node.type
    };
    node.remove();
    return nodeInfo;
  }
  async function deleteMultipleNodes(params) {
    const { nodeIds } = params || {};
    const commandId = generateCommandId();
    if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
      const errorMsg = "Missing or invalid nodeIds parameter";
      sendProgressUpdate(
        commandId,
        "delete_multiple_nodes",
        "error",
        0,
        0,
        0,
        errorMsg,
        { error: errorMsg }
      );
      throw new Error(errorMsg);
    }
    console.log(`Starting deletion of ${nodeIds.length} nodes`);
    sendProgressUpdate(
      commandId,
      "delete_multiple_nodes",
      "started",
      0,
      nodeIds.length,
      0,
      `Starting deletion of ${nodeIds.length} nodes`,
      { totalNodes: nodeIds.length }
    );
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    const CHUNK_SIZE = 5;
    const chunks = [];
    for (let i = 0; i < nodeIds.length; i += CHUNK_SIZE) {
      chunks.push(nodeIds.slice(i, i + CHUNK_SIZE));
    }
    console.log(`Split ${nodeIds.length} deletions into ${chunks.length} chunks`);
    sendProgressUpdate(
      commandId,
      "delete_multiple_nodes",
      "in_progress",
      5,
      nodeIds.length,
      0,
      `Preparing to delete ${nodeIds.length} nodes using ${chunks.length} chunks`,
      {
        totalNodes: nodeIds.length,
        chunks: chunks.length,
        chunkSize: CHUNK_SIZE
      }
    );
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      console.log(
        `Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} nodes`
      );
      sendProgressUpdate(
        commandId,
        "delete_multiple_nodes",
        "in_progress",
        Math.round(5 + chunkIndex / chunks.length * 90),
        nodeIds.length,
        successCount + failureCount,
        `Processing deletion chunk ${chunkIndex + 1}/${chunks.length}`,
        {
          currentChunk: chunkIndex + 1,
          totalChunks: chunks.length,
          successCount,
          failureCount
        }
      );
      const chunkPromises = chunk.map(async (nodeId) => {
        try {
          const node = await figma.getNodeByIdAsync(nodeId);
          if (!node) {
            console.error(`Node not found: ${nodeId}`);
            return {
              success: false,
              nodeId,
              error: `Node not found: ${nodeId}`
            };
          }
          const nodeInfo = {
            id: node.id,
            name: node.name,
            type: node.type
          };
          node.remove();
          console.log(`Successfully deleted node: ${nodeId}`);
          return {
            success: true,
            nodeId,
            nodeInfo
          };
        } catch (error) {
          console.error(`Error deleting node ${nodeId}: ${error.message}`);
          return {
            success: false,
            nodeId,
            error: error.message
          };
        }
      });
      const chunkResults = await Promise.all(chunkPromises);
      chunkResults.forEach((result) => {
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
        results.push(result);
      });
      sendProgressUpdate(
        commandId,
        "delete_multiple_nodes",
        "in_progress",
        Math.round(5 + (chunkIndex + 1) / chunks.length * 90),
        nodeIds.length,
        successCount + failureCount,
        `Completed chunk ${chunkIndex + 1}/${chunks.length}. ${successCount} successful, ${failureCount} failed so far.`,
        {
          currentChunk: chunkIndex + 1,
          totalChunks: chunks.length,
          successCount,
          failureCount,
          chunkResults
        }
      );
      if (chunkIndex < chunks.length - 1) {
        console.log("Pausing between chunks...");
        await delay(1e3);
      }
    }
    console.log(
      `Deletion complete: ${successCount} successful, ${failureCount} failed`
    );
    sendProgressUpdate(
      commandId,
      "delete_multiple_nodes",
      "completed",
      100,
      nodeIds.length,
      successCount + failureCount,
      `Node deletion complete: ${successCount} successful, ${failureCount} failed`,
      {
        totalNodes: nodeIds.length,
        nodesDeleted: successCount,
        nodesFailed: failureCount,
        completedInChunks: chunks.length,
        results
      }
    );
    return {
      success: successCount > 0,
      nodesDeleted: successCount,
      nodesFailed: failureCount,
      totalNodes: nodeIds.length,
      results,
      completedInChunks: chunks.length,
      commandId
    };
  }
  async function cloneNode(params) {
    const { nodeId, x, y, parentId } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    const clone = node.clone();
    if (x !== void 0 && y !== void 0) {
      if (!("x" in clone) || !("y" in clone)) {
        throw new Error(`Cloned node does not support position: ${nodeId}`);
      }
      clone.x = x;
      clone.y = y;
    }
    if (parentId) {
      const targetParent = await figma.getNodeByIdAsync(parentId);
      if (!targetParent) {
        throw new Error(`Parent node not found with ID: ${parentId}`);
      }
      if (!("appendChild" in targetParent)) {
        throw new Error(`Parent node does not support children: ${parentId}`);
      }
      targetParent.appendChild(clone);
    } else {
      let safeParent = node.parent;
      if (safeParent) {
        let ancestor = safeParent;
        while (ancestor) {
          if (ancestor.type === "INSTANCE") {
            safeParent = null;
            break;
          }
          ancestor = ancestor.parent;
        }
      }
      if (safeParent && "appendChild" in safeParent) {
        safeParent.appendChild(clone);
      } else {
        figma.currentPage.appendChild(clone);
      }
    }
    return {
      id: clone.id,
      name: clone.name,
      x: "x" in clone ? clone.x : void 0,
      y: "y" in clone ? clone.y : void 0,
      width: "width" in clone ? clone.width : void 0,
      height: "height" in clone ? clone.height : void 0
    };
  }
  async function batchClone(params) {
    const { sourceId, positions, names, commandId = generateCommandId() } = params || {};
    if (!sourceId) {
      throw new Error("Missing sourceId parameter");
    }
    if (!positions || !Array.isArray(positions) || positions.length === 0) {
      throw new Error("Missing or empty positions array");
    }
    if (names && names.length !== positions.length) {
      throw new Error(
        `Names array length (${names.length}) must match positions array length (${positions.length})`
      );
    }
    const node = await figma.getNodeByIdAsync(sourceId);
    if (!node) {
      throw new Error(`Source node not found with ID: ${sourceId}`);
    }
    const totalItems = positions.length;
    const useProgress = totalItems >= 10;
    if (useProgress) {
      sendProgressUpdate(
        commandId,
        "batch_clone",
        "started",
        0,
        totalItems,
        0,
        `Starting batch clone of "${node.name}" to ${totalItems} positions`
      );
    }
    const parent = node.parent || figma.currentPage;
    const clones = [];
    let successCount = 0;
    let failureCount = 0;
    for (let i = 0; i < positions.length; i++) {
      try {
        const clone = node.clone();
        const pos = positions[i];
        if ("x" in clone && "y" in clone) {
          clone.x = pos.x;
          clone.y = pos.y;
        }
        if (names && names[i]) {
          clone.name = names[i];
        }
        parent.appendChild(clone);
        clones.push({
          id: clone.id,
          name: clone.name,
          x: "x" in clone ? clone.x : void 0,
          y: "y" in clone ? clone.y : void 0
        });
        successCount++;
      } catch (error) {
        clones.push({
          id: null,
          name: names ? names[i] : null,
          x: positions[i].x,
          y: positions[i].y,
          error: error instanceof Error ? error.message : String(error)
        });
        failureCount++;
      }
      if (useProgress && (i + 1) % 5 === 0) {
        const progress = Math.round((i + 1) / totalItems * 100);
        sendProgressUpdate(
          commandId,
          "batch_clone",
          "in_progress",
          progress,
          totalItems,
          i + 1,
          `Cloned ${i + 1}/${totalItems} nodes (${successCount} succeeded, ${failureCount} failed)`
        );
      }
    }
    if (useProgress) {
      sendProgressUpdate(
        commandId,
        "batch_clone",
        "completed",
        100,
        totalItems,
        totalItems,
        `Completed: ${successCount} clones succeeded, ${failureCount} failed`
      );
    }
    return {
      sourceId,
      sourceName: node.name,
      clones,
      successCount,
      failureCount,
      totalItems
    };
  }
  async function renameNode(params) {
    const { nodeId, name } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    if (!name) {
      throw new Error("Missing name parameter");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    const oldName = node.name;
    node.name = name;
    return {
      id: node.id,
      oldName,
      newName: node.name
    };
  }
  async function batchRename(params) {
    const { mappings } = params || {};
    const commandId = params.commandId || generateCommandId();
    if (!mappings || !Array.isArray(mappings)) {
      const errorMsg = "Missing required parameters: mappings array";
      sendProgressUpdate(
        commandId,
        "batch_rename",
        "error",
        0,
        0,
        0,
        errorMsg,
        { error: errorMsg }
      );
      throw new Error(errorMsg);
    }
    console.log(`Starting batch rename for ${mappings.length} nodes`);
    const useProgress = mappings.length >= 10;
    if (useProgress) {
      sendProgressUpdate(
        commandId,
        "batch_rename",
        "started",
        0,
        mappings.length,
        0,
        `Starting batch rename for ${mappings.length} nodes`,
        { totalNodes: mappings.length }
      );
    }
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    for (let i = 0; i < mappings.length; i++) {
      const mapping = mappings[i];
      try {
        if (!mapping.nodeId || !mapping.name) {
          throw new Error("Missing nodeId or name in mapping");
        }
        const node = await figma.getNodeByIdAsync(mapping.nodeId);
        if (!node) {
          throw new Error(`Node not found with ID: ${mapping.nodeId}`);
        }
        const oldName = node.name;
        node.name = mapping.name;
        successCount++;
        results.push({
          success: true,
          nodeId: mapping.nodeId,
          oldName,
          newName: node.name
        });
      } catch (err) {
        failureCount++;
        results.push({
          success: false,
          nodeId: mapping.nodeId,
          error: err.message || String(err)
        });
      }
      if (useProgress && (i + 1) % 5 === 0) {
        const progress = Math.round((i + 1) / mappings.length * 100);
        sendProgressUpdate(
          commandId,
          "batch_rename",
          "in_progress",
          progress,
          mappings.length,
          i + 1,
          `Renamed ${i + 1} of ${mappings.length} nodes (${successCount} succeeded, ${failureCount} failed)`,
          { successCount, failureCount, processedItems: i + 1 }
        );
      }
    }
    if (useProgress) {
      sendProgressUpdate(
        commandId,
        "batch_rename",
        "completed",
        100,
        mappings.length,
        mappings.length,
        `Batch rename completed: ${successCount} succeeded, ${failureCount} failed`,
        { successCount, failureCount }
      );
    }
    return {
      success: failureCount === 0,
      totalRequested: mappings.length,
      successCount,
      failureCount,
      results
    };
  }
  async function groupNodes(params) {
    const { nodeIds, name } = params || {};
    if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
      throw new Error("Missing or empty nodeIds array");
    }
    const nodes = [];
    for (const id of nodeIds) {
      const node = await figma.getNodeByIdAsync(id);
      if (!node) {
        throw new Error(`Node not found with ID: ${id}`);
      }
      nodes.push(node);
    }
    const parent = nodes[0].parent;
    if (!parent) {
      throw new Error(`Node ${nodeIds[0]} has no parent`);
    }
    for (let i = 1; i < nodes.length; i++) {
      if (nodes[i].parent !== parent) {
        throw new Error(
          `All nodes must share the same parent. Node ${nodeIds[i]} has parent "${nodes[i].parent ? nodes[i].parent.name : "none"}" but expected "${parent.name}"`
        );
      }
    }
    const group = figma.group(nodes, parent);
    if (name) {
      group.name = name;
    }
    return {
      id: group.id,
      name: group.name,
      childrenCount: group.children.length
    };
  }
  async function batchReparent(params) {
    const { nodeIds, parentId, index } = params || {};
    const commandId = params.commandId || generateCommandId();
    if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
      throw new Error("Missing or empty nodeIds array");
    }
    if (!parentId) {
      throw new Error("Missing parentId parameter");
    }
    const parentNode = await figma.getNodeByIdAsync(parentId);
    if (!parentNode) {
      throw new Error(`Parent node not found with ID: ${parentId}`);
    }
    const validContainerTypes = ["FRAME", "GROUP", "SECTION", "PAGE", "COMPONENT"];
    if (!validContainerTypes.includes(parentNode.type)) {
      throw new Error(
        `Parent node type "${parentNode.type}" is not a valid container. Must be one of: ${validContainerTypes.join(", ")}`
      );
    }
    if (!("appendChild" in parentNode)) {
      throw new Error(`Parent node does not support appendChild: ${parentId}`);
    }
    const useProgress = nodeIds.length >= 10;
    if (useProgress) {
      sendProgressUpdate(
        commandId,
        "batch_reparent",
        "started",
        0,
        nodeIds.length,
        0,
        `Starting batch reparent for ${nodeIds.length} nodes into "${parentNode.name}"`,
        { totalNodes: nodeIds.length }
      );
    }
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    for (let i = 0; i < nodeIds.length; i++) {
      const nodeId = nodeIds[i];
      try {
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node) {
          throw new Error(`Node not found with ID: ${nodeId}`);
        }
        if (index !== void 0 && index !== null) {
          parentNode.insertChild(index + i, node);
        } else {
          parentNode.appendChild(node);
        }
        successCount++;
        results.push({
          success: true,
          nodeId,
          nodeName: node.name
        });
      } catch (err) {
        failureCount++;
        results.push({
          success: false,
          nodeId,
          error: err.message || String(err)
        });
      }
      if (useProgress && (i + 1) % 5 === 0) {
        const progress = Math.round((i + 1) / nodeIds.length * 100);
        sendProgressUpdate(
          commandId,
          "batch_reparent",
          "in_progress",
          progress,
          nodeIds.length,
          i + 1,
          `Reparented ${i + 1} of ${nodeIds.length} nodes (${successCount} succeeded, ${failureCount} failed)`,
          { successCount, failureCount, processedItems: i + 1 }
        );
      }
    }
    if (useProgress) {
      sendProgressUpdate(
        commandId,
        "batch_reparent",
        "completed",
        100,
        nodeIds.length,
        nodeIds.length,
        `Batch reparent completed: ${successCount} succeeded, ${failureCount} failed`,
        { successCount, failureCount }
      );
    }
    return {
      success: failureCount === 0,
      totalRequested: nodeIds.length,
      successCount,
      failureCount,
      parentName: parentNode.name,
      results
    };
  }
  async function insertChildAt(params) {
    const { parentId, childId, index } = params || {};
    if (!parentId) {
      throw new Error("Missing parentId parameter");
    }
    if (!childId) {
      throw new Error("Missing childId parameter");
    }
    const parentNode = await figma.getNodeByIdAsync(parentId);
    if (!parentNode) {
      throw new Error(`Parent node not found with ID: ${parentId}`);
    }
    if (!("insertChild" in parentNode)) {
      throw new Error(`Parent node does not support insertChild: ${parentId}`);
    }
    const childNode = await figma.getNodeByIdAsync(childId);
    if (!childNode) {
      throw new Error(`Child node not found with ID: ${childId}`);
    }
    parentNode.insertChild(index, childNode);
    return {
      parentName: parentNode.name,
      childName: childNode.name,
      index
    };
  }
  async function reorderChild(params) {
    const { childId, index } = params || {};
    if (!childId) {
      throw new Error("Missing childId parameter");
    }
    const childNode = await figma.getNodeByIdAsync(childId);
    if (!childNode) {
      throw new Error(`Child node not found with ID: ${childId}`);
    }
    const parentNode = childNode.parent;
    if (!parentNode) {
      throw new Error(`Child node has no parent: ${childId}`);
    }
    if (!("insertChild" in parentNode)) {
      throw new Error(`Parent node does not support insertChild`);
    }
    parentNode.insertChild(index, childNode);
    return {
      childName: childNode.name,
      parentName: parentNode.name,
      index
    };
  }
  async function setLayoutPositioning(params) {
    var nodeId = params.nodeId;
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) throw new Error("Node not found with ID: " + nodeId);
    if (!("layoutPositioning" in node)) throw new Error("Node does not support layoutPositioning (type: " + node.type + ")");
    node.layoutPositioning = params.positioning;
    if (params.positioning === "ABSOLUTE" && params.constraints) {
      if ("constraints" in node) {
        var c = params.constraints;
        node.constraints = {
          horizontal: c.horizontal || "MIN",
          vertical: c.vertical || "MIN"
        };
      }
    }
    return {
      id: node.id,
      name: node.name,
      layoutPositioning: node.layoutPositioning,
      constraints: "constraints" in node ? node.constraints : void 0
    };
  }

  // src/claude_figma_plugin/src/layout.ts
  async function setLayoutMode(params, firstOnTop = true) {
    const { nodeId, layoutMode = "NONE", layoutWrap = "NO_WRAP" } = params || {};
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node with ID ${nodeId} not found`);
    }
    if (node.type !== "FRAME" && node.type !== "COMPONENT" && node.type !== "COMPONENT_SET" && node.type !== "INSTANCE") {
      throw new Error(`Node type ${node.type} does not support layoutMode`);
    }
    node.layoutMode = layoutMode;
    if (layoutMode !== "NONE") {
      node.layoutWrap = layoutWrap;
      if (params.itemReverseZIndex !== void 0) {
        node.itemReverseZIndex = !!params.itemReverseZIndex;
      } else if (firstOnTop) {
        node.itemReverseZIndex = true;
      }
    }
    return {
      id: node.id,
      name: node.name,
      layoutMode: node.layoutMode,
      layoutWrap: node.layoutWrap,
      itemReverseZIndex: node.itemReverseZIndex
    };
  }
  async function setPadding(params) {
    const { nodeId, paddingTop, paddingRight, paddingBottom, paddingLeft } = params || {};
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node with ID ${nodeId} not found`);
    }
    if (node.type !== "FRAME" && node.type !== "COMPONENT" && node.type !== "COMPONENT_SET" && node.type !== "INSTANCE") {
      throw new Error(`Node type ${node.type} does not support padding`);
    }
    if (node.layoutMode === "NONE") {
      throw new Error(
        "Padding can only be set on auto-layout frames (layoutMode must not be NONE)"
      );
    }
    if (paddingTop !== void 0) node.paddingTop = paddingTop;
    if (paddingRight !== void 0) node.paddingRight = paddingRight;
    if (paddingBottom !== void 0) node.paddingBottom = paddingBottom;
    if (paddingLeft !== void 0) node.paddingLeft = paddingLeft;
    return {
      id: node.id,
      name: node.name,
      paddingTop: node.paddingTop,
      paddingRight: node.paddingRight,
      paddingBottom: node.paddingBottom,
      paddingLeft: node.paddingLeft
    };
  }
  async function setAxisAlign(params) {
    const { nodeId, primaryAxisAlignItems, counterAxisAlignItems } = params || {};
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node with ID ${nodeId} not found`);
    }
    if (node.type !== "FRAME" && node.type !== "COMPONENT" && node.type !== "COMPONENT_SET" && node.type !== "INSTANCE") {
      throw new Error(`Node type ${node.type} does not support axis alignment`);
    }
    if (node.layoutMode === "NONE") {
      throw new Error(
        "Axis alignment can only be set on auto-layout frames (layoutMode must not be NONE)"
      );
    }
    if (primaryAxisAlignItems !== void 0) {
      if (!["MIN", "MAX", "CENTER", "SPACE_BETWEEN"].includes(primaryAxisAlignItems)) {
        throw new Error(
          "Invalid primaryAxisAlignItems value. Must be one of: MIN, MAX, CENTER, SPACE_BETWEEN"
        );
      }
      node.primaryAxisAlignItems = primaryAxisAlignItems;
    }
    if (counterAxisAlignItems !== void 0) {
      if (!["MIN", "MAX", "CENTER", "BASELINE"].includes(counterAxisAlignItems)) {
        throw new Error(
          "Invalid counterAxisAlignItems value. Must be one of: MIN, MAX, CENTER, BASELINE"
        );
      }
      if (counterAxisAlignItems === "BASELINE" && node.layoutMode !== "HORIZONTAL") {
        throw new Error(
          "BASELINE alignment is only valid for horizontal auto-layout frames"
        );
      }
      node.counterAxisAlignItems = counterAxisAlignItems;
    }
    return {
      id: node.id,
      name: node.name,
      primaryAxisAlignItems: node.primaryAxisAlignItems,
      counterAxisAlignItems: node.counterAxisAlignItems,
      layoutMode: node.layoutMode
    };
  }
  async function setLayoutSizing(params) {
    const { nodeId, layoutSizingHorizontal, layoutSizingVertical } = params || {};
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node with ID ${nodeId} not found`);
    }
    if (node.type !== "FRAME" && node.type !== "COMPONENT" && node.type !== "COMPONENT_SET" && node.type !== "INSTANCE") {
      throw new Error(`Node type ${node.type} does not support layout sizing`);
    }
    if (node.layoutMode === "NONE") {
      throw new Error(
        "Layout sizing can only be set on auto-layout frames (layoutMode must not be NONE)"
      );
    }
    if (layoutSizingHorizontal !== void 0) {
      if (!["FIXED", "HUG", "FILL"].includes(layoutSizingHorizontal)) {
        throw new Error(
          "Invalid layoutSizingHorizontal value. Must be one of: FIXED, HUG, FILL"
        );
      }
      if (layoutSizingHorizontal === "HUG" && !["FRAME", "TEXT"].includes(node.type)) {
        throw new Error(
          "HUG sizing is only valid on auto-layout frames and text nodes"
        );
      }
      if (layoutSizingHorizontal === "FILL" && (!node.parent || node.parent.layoutMode === "NONE")) {
        throw new Error("FILL sizing is only valid on auto-layout children");
      }
      node.layoutSizingHorizontal = layoutSizingHorizontal;
    }
    if (layoutSizingVertical !== void 0) {
      if (!["FIXED", "HUG", "FILL"].includes(layoutSizingVertical)) {
        throw new Error(
          "Invalid layoutSizingVertical value. Must be one of: FIXED, HUG, FILL"
        );
      }
      if (layoutSizingVertical === "HUG" && !["FRAME", "TEXT"].includes(node.type)) {
        throw new Error(
          "HUG sizing is only valid on auto-layout frames and text nodes"
        );
      }
      if (layoutSizingVertical === "FILL" && (!node.parent || node.parent.layoutMode === "NONE")) {
        throw new Error("FILL sizing is only valid on auto-layout children");
      }
      node.layoutSizingVertical = layoutSizingVertical;
    }
    return {
      id: node.id,
      name: node.name,
      layoutSizingHorizontal: node.layoutSizingHorizontal,
      layoutSizingVertical: node.layoutSizingVertical,
      layoutMode: node.layoutMode
    };
  }
  async function setItemSpacing(params) {
    const { nodeId, itemSpacing, counterAxisSpacing } = params || {};
    if (itemSpacing === void 0 && counterAxisSpacing === void 0) {
      throw new Error("At least one of itemSpacing or counterAxisSpacing must be provided");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node with ID ${nodeId} not found`);
    }
    if (node.type !== "FRAME" && node.type !== "COMPONENT" && node.type !== "COMPONENT_SET" && node.type !== "INSTANCE") {
      throw new Error(`Node type ${node.type} does not support item spacing`);
    }
    if (node.layoutMode === "NONE") {
      throw new Error(
        "Item spacing can only be set on auto-layout frames (layoutMode must not be NONE)"
      );
    }
    if (itemSpacing !== void 0) {
      if (typeof itemSpacing !== "number") {
        throw new Error("Item spacing must be a number");
      }
      node.itemSpacing = itemSpacing;
    }
    if (counterAxisSpacing !== void 0) {
      if (typeof counterAxisSpacing !== "number") {
        throw new Error("Counter axis spacing must be a number");
      }
      if (node.layoutWrap !== "WRAP") {
        throw new Error(
          "Counter axis spacing can only be set on frames with layoutWrap set to WRAP"
        );
      }
      node.counterAxisSpacing = counterAxisSpacing;
    }
    return {
      id: node.id,
      name: node.name,
      itemSpacing: node.itemSpacing || void 0,
      counterAxisSpacing: node.counterAxisSpacing || void 0,
      layoutMode: node.layoutMode,
      layoutWrap: node.layoutWrap
    };
  }

  // src/claude_figma_plugin/src/components.ts
  async function getStyles() {
    const styles = {
      colors: await figma.getLocalPaintStylesAsync(),
      texts: await figma.getLocalTextStylesAsync(),
      effects: await figma.getLocalEffectStylesAsync(),
      grids: await figma.getLocalGridStylesAsync()
    };
    return {
      colors: styles.colors.map((style) => ({
        id: style.id,
        name: style.name,
        key: style.key,
        paint: style.paints[0]
      })),
      texts: styles.texts.map((style) => ({
        id: style.id,
        name: style.name,
        key: style.key,
        fontSize: style.fontSize,
        fontName: style.fontName
      })),
      effects: styles.effects.map((style) => ({
        id: style.id,
        name: style.name,
        key: style.key
      })),
      grids: styles.grids.map((style) => ({
        id: style.id,
        name: style.name,
        key: style.key
      }))
    };
  }
  async function getLocalComponents(params) {
    const commandId = params && params.commandId || generateCommandId();
    const pages = figma.root.children;
    const totalPages = pages.length;
    await sendProgressUpdate(
      commandId,
      "get_local_components",
      "started",
      0,
      totalPages,
      0,
      "Starting component scan across " + totalPages + " pages...",
      null
    );
    var allComponents = [];
    for (var i = 0; i < totalPages; i++) {
      var page = pages[i];
      await page.loadAsync();
      var pageComponents = page.findAllWithCriteria({ types: ["COMPONENT"] });
      for (var j = 0; j < pageComponents.length; j++) {
        var component = pageComponents[j];
        allComponents.push({
          id: component.id,
          name: component.name,
          key: "key" in component ? component.key : null
        });
      }
      var progress = Math.round((i + 1) / totalPages * 100);
      await sendProgressUpdate(
        commandId,
        "get_local_components",
        "in_progress",
        progress,
        totalPages,
        i + 1,
        "Scanned " + page.name + ": " + pageComponents.length + " components (total so far: " + allComponents.length + ")",
        null
      );
    }
    await sendProgressUpdate(
      commandId,
      "get_local_components",
      "completed",
      100,
      totalPages,
      totalPages,
      "Found " + allComponents.length + " components across " + totalPages + " pages",
      null
    );
    return {
      count: allComponents.length,
      components: allComponents
    };
  }
  async function createComponentInstance(params) {
    const { componentKey, componentId, x = 0, y = 0, parentId } = params || {};
    if (!componentKey && !componentId) {
      throw new Error("Missing componentKey or componentId parameter. Use componentId for local components (from get_local_components), or componentKey for published library components.");
    }
    try {
      let component;
      if (componentId) {
        const node = await figma.getNodeByIdAsync(componentId);
        if (!node) {
          throw new Error(`Component node not found with id: ${componentId}`);
        }
        if (node.type !== "COMPONENT") {
          throw new Error(`Node ${componentId} is not a COMPONENT (got type: ${node.type}). Use get_local_components to find valid component IDs.`);
        }
        component = node;
      } else {
        component = await figma.importComponentByKeyAsync(componentKey);
      }
      const instance = component.createInstance();
      instance.x = x;
      instance.y = y;
      await appendOrInsertChild(instance, parentId, params.insertAt);
      if (params.properties && typeof params.properties === "object") {
        try {
          instance.setProperties(params.properties);
        } catch (e) {
          console.error("Error setting component properties:", e);
        }
      }
      if (params.textOverrides && typeof params.textOverrides === "object") {
        async function applyTextOverrides(node, overrides) {
          if (node.type === "TEXT" && overrides[node.name] !== void 0) {
            await loadAllFonts(node);
            await setCharacters(node, String(overrides[node.name]));
          }
          if ("children" in node && node.children) {
            for (var i = 0; i < node.children.length; i++) {
              await applyTextOverrides(node.children[i], overrides);
            }
          }
        }
        await applyTextOverrides(instance, params.textOverrides);
      }
      const mainComponent = await instance.getMainComponentAsync();
      return {
        id: instance.id,
        name: instance.name,
        x: instance.x,
        y: instance.y,
        width: instance.width,
        height: instance.height,
        mainComponentId: mainComponent ? mainComponent.id : void 0
      };
    } catch (error) {
      throw new Error(`Error creating component instance: ${error.message}`);
    }
  }
  async function swapInstanceVariant(params) {
    const { nodeId, componentKey } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    if (!componentKey) {
      throw new Error("Missing componentKey parameter");
    }
    try {
      const instanceNode = await figma.getNodeByIdAsync(nodeId);
      if (!instanceNode) {
        throw new Error(`Node not found with ID: ${nodeId}`);
      }
      if (instanceNode.type !== "INSTANCE") {
        throw new Error(`Node ${nodeId} is not an INSTANCE (got type: ${instanceNode.type}). Only INSTANCE nodes can be swapped.`);
      }
      const targetComponent = await figma.getNodeByIdAsync(componentKey);
      if (!targetComponent) {
        throw new Error(`Target component not found with ID: ${componentKey}`);
      }
      if (targetComponent.type !== "COMPONENT") {
        throw new Error(`Target node ${componentKey} is not a COMPONENT (got type: ${targetComponent.type}). Use get_local_components to find valid component IDs.`);
      }
      instanceNode.swapComponent(targetComponent);
      const mainComponent = await instanceNode.getMainComponentAsync();
      return {
        success: true,
        instanceId: instanceNode.id,
        instanceName: instanceNode.name,
        swappedToComponentId: targetComponent.id,
        swappedToComponentName: targetComponent.name,
        mainComponentId: mainComponent ? mainComponent.id : void 0,
        width: instanceNode.width,
        height: instanceNode.height
      };
    } catch (error) {
      throw new Error(`Error swapping instance variant: ${error.message}`);
    }
  }
  async function setComponentProperties(params) {
    const { nodeId, properties } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    if (!properties || typeof properties !== "object") {
      throw new Error("Missing or invalid properties parameter. Must be an object of key-value pairs.");
    }
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`);
      }
      if (node.type !== "INSTANCE") {
        throw new Error(`Node ${nodeId} is not an INSTANCE (got type: ${node.type}). Only INSTANCE nodes have component properties.`);
      }
      node.setProperties(properties);
      const currentProperties = node.componentProperties;
      return {
        success: true,
        instanceId: node.id,
        instanceName: node.name,
        componentProperties: currentProperties
      };
    } catch (error) {
      throw new Error(`Error setting component properties: ${error.message}`);
    }
  }
  async function exportNodeAsImage(params) {
    const { nodeId, scale = 1 } = params || {};
    const format = "PNG";
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    if (!("exportAsync" in node)) {
      throw new Error(`Node does not support exporting: ${nodeId}`);
    }
    try {
      const settings = {
        format,
        constraint: { type: "SCALE", value: scale }
      };
      const bytes = await node.exportAsync(settings);
      let mimeType;
      switch (format) {
        case "PNG":
          mimeType = "image/png";
          break;
        case "JPG":
          mimeType = "image/jpeg";
          break;
        case "SVG":
          mimeType = "image/svg+xml";
          break;
        case "PDF":
          mimeType = "application/pdf";
          break;
        default:
          mimeType = "application/octet-stream";
      }
      const base64 = customBase64Encode(bytes);
      return {
        nodeId,
        format,
        scale,
        mimeType,
        imageData: base64
      };
    } catch (error) {
      throw new Error(`Error exporting node as image: ${error.message}`);
    }
  }
  async function createComponent(params) {
    const { nodeId } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    if (node.type !== "FRAME") {
      throw new Error(`Node is not a frame: ${nodeId} (type: ${node.type})`);
    }
    const component = figma.createComponent();
    component.name = node.name;
    component.x = node.x;
    component.y = node.y;
    component.resize(node.width, node.height);
    if (node.fills && node.fills !== figma.mixed) {
      component.fills = JSON.parse(JSON.stringify(node.fills));
    }
    if (node.strokes && node.strokes !== figma.mixed) {
      component.strokes = JSON.parse(JSON.stringify(node.strokes));
    }
    if (node.strokeWeight !== void 0 && node.strokeWeight !== figma.mixed) {
      component.strokeWeight = node.strokeWeight;
    }
    if (node.cornerRadius !== void 0 && node.cornerRadius !== figma.mixed) {
      component.cornerRadius = node.cornerRadius;
    }
    if (node.layoutMode) {
      component.layoutMode = node.layoutMode;
      if (node.itemReverseZIndex !== void 0) {
        component.itemReverseZIndex = node.itemReverseZIndex;
      }
    }
    if (node.paddingTop !== void 0) {
      component.paddingTop = node.paddingTop;
      component.paddingRight = node.paddingRight;
      component.paddingBottom = node.paddingBottom;
      component.paddingLeft = node.paddingLeft;
    }
    if (node.itemSpacing !== void 0) {
      component.itemSpacing = node.itemSpacing;
    }
    if (node.primaryAxisAlignItems) {
      component.primaryAxisAlignItems = node.primaryAxisAlignItems;
    }
    if (node.counterAxisAlignItems) {
      component.counterAxisAlignItems = node.counterAxisAlignItems;
    }
    const children = [...node.children];
    for (const child of children) {
      component.appendChild(child);
    }
    if (node.parent) {
      const parent = node.parent;
      const idx = parent.children.indexOf(node);
      parent.insertChild(idx, component);
    }
    node.remove();
    return {
      id: component.id,
      name: component.name,
      key: component.key
    };
  }
  async function getInstanceOverrides(instanceNode = null) {
    let sourceInstance = null;
    if (instanceNode) {
      if (instanceNode.type !== "INSTANCE") {
        console.error("Provided node is not an instance");
        figma.notify("Provided node is not a component instance");
        return { success: false, message: "Provided node is not a component instance" };
      }
      sourceInstance = instanceNode;
    } else {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        figma.notify("Please select at least one instance");
        return { success: false, message: "No nodes selected" };
      }
      const instances = selection.filter((node) => node.type === "INSTANCE");
      if (instances.length === 0) {
        figma.notify("Please select at least one component instance");
        return { success: false, message: "No instances found in selection" };
      }
      sourceInstance = instances[0];
    }
    try {
      const overrides = sourceInstance.overrides || [];
      const mainComponent = await sourceInstance.getMainComponentAsync();
      if (!mainComponent) {
        console.error("Failed to get main component");
        figma.notify("Failed to get main component");
        return { success: false, message: "Failed to get main component" };
      }
      const returnData = {
        success: true,
        message: `Got component information from "${sourceInstance.name}" for overrides.length: ${overrides.length}`,
        sourceInstanceId: sourceInstance.id,
        mainComponentId: mainComponent.id,
        overridesCount: overrides.length
      };
      figma.notify(`Got component information from "${sourceInstance.name}"`);
      return returnData;
    } catch (error) {
      console.error("Error in getInstanceOverrides:", error);
      figma.notify(`Error: ${error.message}`);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }
  async function getValidTargetInstances(targetNodeIds) {
    let targetInstances = [];
    if (Array.isArray(targetNodeIds)) {
      if (targetNodeIds.length === 0) {
        return { success: false, message: "No instances provided" };
      }
      for (const targetNodeId of targetNodeIds) {
        const targetNode = await figma.getNodeByIdAsync(targetNodeId);
        if (targetNode && targetNode.type === "INSTANCE") {
          targetInstances.push(targetNode);
        }
      }
      if (targetInstances.length === 0) {
        return { success: false, message: "No valid instances provided" };
      }
    } else {
      return { success: false, message: "Invalid target node IDs provided" };
    }
    return { success: true, message: "Valid target instances provided", targetInstances };
  }
  async function getSourceInstanceData(sourceInstanceId) {
    if (!sourceInstanceId) {
      return { success: false, message: "Missing source instance ID" };
    }
    const sourceInstance = await figma.getNodeByIdAsync(sourceInstanceId);
    if (!sourceInstance) {
      return {
        success: false,
        message: "Source instance not found. The original instance may have been deleted."
      };
    }
    if (sourceInstance.type !== "INSTANCE") {
      return {
        success: false,
        message: "Source node is not a component instance."
      };
    }
    const mainComponent = await sourceInstance.getMainComponentAsync();
    if (!mainComponent) {
      return {
        success: false,
        message: "Failed to get main component from source instance."
      };
    }
    return {
      success: true,
      sourceInstance,
      mainComponent,
      overrides: sourceInstance.overrides || []
    };
  }
  async function setInstanceOverrides(targetInstances, sourceResult) {
    try {
      const { sourceInstance, mainComponent, overrides } = sourceResult;
      console.log(`Processing ${targetInstances.length} instances with ${overrides.length} overrides`);
      console.log(`Source instance: ${sourceInstance.id}, Main component: ${mainComponent.id}`);
      console.log(`Overrides:`, overrides);
      const results = [];
      let totalAppliedCount = 0;
      for (const targetInstance of targetInstances) {
        try {
          try {
            targetInstance.swapComponent(mainComponent);
            console.log(`Swapped component for instance "${targetInstance.name}"`);
          } catch (error) {
            console.error(`Error swapping component for instance "${targetInstance.name}":`, error);
            results.push({
              success: false,
              instanceId: targetInstance.id,
              instanceName: targetInstance.name,
              message: `Error: ${error.message}`
            });
          }
          let appliedCount = 0;
          for (const override of overrides) {
            if (!override.id || !override.overriddenFields || override.overriddenFields.length === 0) {
              continue;
            }
            const overrideNodeId = override.id.replace(sourceInstance.id, targetInstance.id);
            const overrideNode = await figma.getNodeByIdAsync(overrideNodeId);
            if (!overrideNode) {
              console.log(`Override node not found: ${overrideNodeId}`);
              continue;
            }
            const sourceNode = await figma.getNodeByIdAsync(override.id);
            if (!sourceNode) {
              console.log(`Source node not found: ${override.id}`);
              continue;
            }
            let fieldApplied = false;
            for (const field of override.overriddenFields) {
              try {
                if (field === "componentProperties") {
                  if (sourceNode.componentProperties && overrideNode.componentProperties) {
                    const properties = {};
                    for (const key in sourceNode.componentProperties) {
                      if (sourceNode.componentProperties[key].type === "INSTANCE_SWAP") {
                        properties[key] = sourceNode.componentProperties[key].value;
                      } else {
                        properties[key] = sourceNode.componentProperties[key].value;
                      }
                    }
                    overrideNode.setProperties(properties);
                    fieldApplied = true;
                  }
                } else if (field === "characters" && overrideNode.type === "TEXT") {
                  await loadAllFonts(overrideNode);
                  overrideNode.characters = sourceNode.characters;
                  fieldApplied = true;
                } else if (field in overrideNode) {
                  overrideNode[field] = sourceNode[field];
                  fieldApplied = true;
                }
              } catch (fieldError) {
                console.error(`Error applying field ${field}:`, fieldError);
              }
            }
            if (fieldApplied) {
              appliedCount++;
            }
          }
          if (appliedCount > 0) {
            totalAppliedCount += appliedCount;
            results.push({
              success: true,
              instanceId: targetInstance.id,
              instanceName: targetInstance.name,
              appliedCount
            });
            console.log(`Applied ${appliedCount} overrides to "${targetInstance.name}"`);
          } else {
            results.push({
              success: false,
              instanceId: targetInstance.id,
              instanceName: targetInstance.name,
              message: "No overrides were applied"
            });
          }
        } catch (instanceError) {
          console.error(`Error processing instance "${targetInstance.name}":`, instanceError);
          results.push({
            success: false,
            instanceId: targetInstance.id,
            instanceName: targetInstance.name,
            message: `Error: ${instanceError.message}`
          });
        }
      }
      if (totalAppliedCount > 0) {
        const instanceCount = results.filter((r) => r.success).length;
        const message = `Applied ${totalAppliedCount} overrides to ${instanceCount} instances`;
        figma.notify(message);
        return {
          success: true,
          message,
          totalCount: totalAppliedCount,
          results
        };
      } else {
        const message = "No overrides applied to any instance";
        figma.notify(message);
        return { success: false, message, results };
      }
    } catch (error) {
      console.error("Error in setInstanceOverrides:", error);
      const message = `Error: ${error.message}`;
      figma.notify(message);
      return { success: false, message };
    }
  }
  async function createComponentSet(params) {
    var componentIds = params.componentIds;
    var name = params.name;
    var components = [];
    for (var i = 0; i < componentIds.length; i++) {
      var comp = await figma.getNodeByIdAsync(componentIds[i]);
      if (!comp) throw new Error("Component not found with ID: " + componentIds[i]);
      if (comp.type !== "COMPONENT") throw new Error("Node " + componentIds[i] + " is not a COMPONENT (type: " + comp.type + "). Convert frames to components first with create_component.");
      components.push(comp);
    }
    if (components.length < 2) {
      throw new Error("Need at least 2 components to create a component set. Got " + components.length);
    }
    var parent = components[0].parent;
    for (var i = 1; i < components.length; i++) {
      if (components[i].parent !== parent) {
        throw new Error("All components must share the same parent. Component " + components[i].id + " has a different parent.");
      }
    }
    var componentSet = figma.combineAsVariants(components, parent);
    if (name) {
      componentSet.name = name;
    }
    var variants = [];
    for (var i = 0; i < componentSet.children.length; i++) {
      var child = componentSet.children[i];
      if (child.type === "COMPONENT") {
        variants.push({
          id: child.id,
          name: child.name
        });
      }
    }
    return {
      id: componentSet.id,
      name: componentSet.name,
      type: "COMPONENT_SET",
      variantCount: variants.length,
      variants,
      width: componentSet.width,
      height: componentSet.height
    };
  }
  async function getLocalVariables() {
    var collections = await figma.variables.getLocalVariableCollectionsAsync();
    var result = [];
    for (var c = 0; c < collections.length; c++) {
      var collection = collections[c];
      var variables = [];
      for (var v = 0; v < collection.variableIds.length; v++) {
        var variable = await figma.variables.getVariableByIdAsync(collection.variableIds[v]);
        if (!variable) continue;
        var values = {};
        for (var m = 0; m < collection.modes.length; m++) {
          var mode = collection.modes[m];
          var val = variable.valuesByMode[mode.modeId];
          values[mode.name] = val;
        }
        variables.push({
          id: variable.id,
          name: variable.name,
          resolvedType: variable.resolvedType,
          values
        });
      }
      result.push({
        id: collection.id,
        name: collection.name,
        modes: collection.modes.map(function(m2) {
          return { id: m2.modeId, name: m2.name };
        }),
        variables
      });
    }
    return { collections: result };
  }

  // src/claude_figma_plugin/src/vectors.ts
  function normalizeSvgPath(pathData) {
    var normalized = pathData.replace(/([a-zA-Z])(\d)/g, "$1 $2").replace(/([a-zA-Z])(-)/g, "$1 $2").replace(/(\d)([a-zA-Z])/g, "$1 $2");
    var tokens = normalized.match(/[a-zA-Z]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
    if (!tokens) return pathData;
    var result = [];
    var cx = 0, cy = 0;
    var sx = 0, sy = 0;
    var i = 0;
    function num() {
      if (i >= tokens.length) return 0;
      return parseFloat(tokens[i++]);
    }
    while (i < tokens.length) {
      var cmd = tokens[i];
      if (/^[+-]?\d/.test(cmd) || cmd === ".") {
        i--;
        cmd = result.length > 0 ? "L" : "M";
        i++;
        continue;
      }
      i++;
      switch (cmd) {
        case "M":
          cx = num();
          cy = num();
          sx = cx;
          sy = cy;
          result.push("M " + cx + " " + cy);
          break;
        case "m":
          cx += num();
          cy += num();
          sx = cx;
          sy = cy;
          result.push("M " + cx + " " + cy);
          break;
        case "L":
          cx = num();
          cy = num();
          result.push("L " + cx + " " + cy);
          break;
        case "l":
          cx += num();
          cy += num();
          result.push("L " + cx + " " + cy);
          break;
        case "H":
          cx = num();
          result.push("L " + cx + " " + cy);
          break;
        case "h":
          cx += num();
          result.push("L " + cx + " " + cy);
          break;
        case "V":
          cy = num();
          result.push("L " + cx + " " + cy);
          break;
        case "v":
          cy += num();
          result.push("L " + cx + " " + cy);
          break;
        case "C": {
          var x1 = num(), y1 = num(), x2 = num(), y2 = num();
          cx = num();
          cy = num();
          result.push("C " + x1 + " " + y1 + " " + x2 + " " + y2 + " " + cx + " " + cy);
          break;
        }
        case "c": {
          var x1 = cx + num(), y1 = cy + num(), x2 = cx + num(), y2 = cy + num();
          cx += num();
          cy += num();
          result.push("C " + x1 + " " + y1 + " " + x2 + " " + y2 + " " + cx + " " + cy);
          break;
        }
        case "S":
        case "s": {
          var abs = cmd === "S";
          var x2 = abs ? num() : cx + num();
          var y2 = abs ? num() : cy + num();
          var ex = abs ? num() : cx + num();
          var ey = abs ? num() : cy + num();
          result.push("C " + cx + " " + cy + " " + x2 + " " + y2 + " " + ex + " " + ey);
          cx = ex;
          cy = ey;
          break;
        }
        case "Q": {
          var qx = num(), qy = num();
          cx = num();
          cy = num();
          result.push("Q " + qx + " " + qy + " " + cx + " " + cy);
          break;
        }
        case "q": {
          var qx = cx + num(), qy = cy + num();
          cx += num();
          cy += num();
          result.push("Q " + qx + " " + qy + " " + cx + " " + cy);
          break;
        }
        case "T":
        case "t": {
          var abs = cmd === "T";
          cx = abs ? num() : cx + num();
          cy = abs ? num() : cy + num();
          result.push("L " + cx + " " + cy);
          break;
        }
        case "A":
        case "a": {
          var abs = cmd === "A";
          num();
          num();
          num();
          num();
          num();
          cx = abs ? num() : cx + num();
          cy = abs ? num() : cy + num();
          result.push("L " + cx + " " + cy);
          break;
        }
        case "Z":
        case "z":
          cx = sx;
          cy = sy;
          result.push("Z");
          break;
      }
    }
    return result.join(" ");
  }
  async function createVector(params) {
    const { pathData: rawPathData, x = 0, y = 0, width, height, name = "Vector", parentId, fillColor, strokeColor, strokeWeight, strokeCap } = params || {};
    if (!rawPathData) {
      throw new Error("Missing pathData parameter");
    }
    const pathData = normalizeSvgPath(rawPathData);
    const vector = figma.createVector();
    vector.name = name;
    vector.vectorPaths = [{
      windingRule: "NONZERO",
      data: pathData
    }];
    if (width && height) {
      vector.resize(width, height);
    }
    vector.x = x;
    vector.y = y;
    if (fillColor) {
      applyColorPaint(vector, "fills", fillColor);
    }
    if (strokeColor) {
      applyColorPaint(vector, "strokes", strokeColor);
      vector.strokeWeight = strokeWeight || 1;
      if (strokeCap) {
        try {
          const network = vector.vectorNetwork;
          if (network && network.vertices && network.vertices.length > 0) {
            const updatedVertices = network.vertices.map(function(v) {
              return Object.assign({}, v, { strokeCap });
            });
            await vector.setVectorNetworkAsync(Object.assign({}, network, { vertices: updatedVertices }));
          }
        } catch (e) {
        }
      }
    } else if (strokeWeight) {
      vector.strokeWeight = strokeWeight;
    }
    if (params.opacity !== void 0) {
      vector.opacity = params.opacity;
    }
    await appendOrInsertChild(vector, parentId, params.insertAt);
    return {
      id: vector.id,
      name: vector.name,
      x: vector.x,
      y: vector.y,
      width: vector.width,
      height: vector.height
    };
  }
  async function createLine(params) {
    var startX = params.startX !== void 0 ? params.startX : 0;
    var startY = params.startY !== void 0 ? params.startY : 0;
    var endX = params.endX !== void 0 ? params.endX : 100;
    var endY = params.endY !== void 0 ? params.endY : 0;
    var strokeWeight = params.strokeWeight || 2;
    var strokeColor = params.strokeColor;
    var startCap = params.startCap || "NONE";
    var endCap = params.endCap || "NONE";
    var name = params.name || "Line";
    var parentId = params.parentId;
    var originX = Math.min(startX, endX);
    var originY = Math.min(startY, endY);
    var v0x = startX - originX;
    var v0y = startY - originY;
    var v1x = endX - originX;
    var v1y = endY - originY;
    var vec = figma.createVector();
    vec.name = name;
    vec.x = originX;
    vec.y = originY;
    await vec.setVectorNetworkAsync({
      vertices: [
        { x: v0x, y: v0y, strokeCap: startCap },
        { x: v1x, y: v1y, strokeCap: endCap }
      ],
      segments: [{ start: 0, end: 1 }],
      regions: []
    });
    var resolvedColor = null;
    var varRef = null;
    if (strokeColor) {
      var resolved = resolveColorValue(strokeColor);
      resolvedColor = resolved.color;
      varRef = resolved.varRef;
    }
    if (resolvedColor) {
      vec.strokes = [
        {
          type: "SOLID",
          color: {
            r: resolvedColor.r !== void 0 ? resolvedColor.r : 0,
            g: resolvedColor.g !== void 0 ? resolvedColor.g : 0,
            b: resolvedColor.b !== void 0 ? resolvedColor.b : 0
          },
          opacity: resolvedColor.a !== void 0 ? resolvedColor.a : 1
        }
      ];
    } else if (!varRef) {
      vec.strokes = [
        {
          type: "SOLID",
          color: { r: 0, g: 0, b: 0 },
          opacity: 1
        }
      ];
    }
    if (varRef) {
      await bindVariableToColor(vec, "strokes", varRef);
    }
    vec.fills = [];
    vec.strokeWeight = strokeWeight;
    if (parentId) {
      var parentNode = await figma.getNodeByIdAsync(parentId);
      if (!parentNode) throw new Error("Parent node not found with ID: " + parentId);
      if (!("appendChild" in parentNode)) throw new Error("Parent node does not support children: " + parentId);
      parentNode.appendChild(vec);
    } else {
      figma.currentPage.appendChild(vec);
    }
    return {
      id: vec.id,
      name: vec.name,
      x: vec.x,
      y: vec.y,
      width: vec.width,
      height: vec.height
    };
  }
  async function setVectorPath(params) {
    const { nodeId, pathData, width, height } = params;
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error("Node not found with ID: " + nodeId);
    }
    if (node.type !== "VECTOR") {
      throw new Error("Node is not a VECTOR (type: " + node.type + ")");
    }
    node.vectorPaths = [{
      windingRule: "NONZERO",
      data: normalizeSvgPath(pathData)
    }];
    if (width !== void 0 && height !== void 0) {
      node.resize(width, height);
    }
    return {
      id: node.id,
      name: node.name,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height
    };
  }
  async function getVectorNetwork(params) {
    var nodeId = params.nodeId;
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error("Node not found with ID: " + nodeId);
    }
    if (node.type !== "VECTOR") {
      throw new Error("Node is not a VECTOR (type: " + node.type + ")");
    }
    var network = node.vectorNetwork;
    var vertices = network.vertices.map(function(v, i) {
      var vertex = {
        index: i,
        x: v.x,
        y: v.y
      };
      if (v.strokeCap && v.strokeCap !== "NONE") {
        vertex.strokeCap = v.strokeCap;
      }
      if (v.cornerRadius !== void 0 && v.cornerRadius !== 0) {
        vertex.cornerRadius = v.cornerRadius;
      }
      return vertex;
    });
    var segments = network.segments.map(function(s, i) {
      var segment = {
        index: i,
        start: s.start,
        end: s.end
      };
      if (s.tangentStart && (s.tangentStart.x !== 0 || s.tangentStart.y !== 0)) {
        segment.tangentStart = { x: s.tangentStart.x, y: s.tangentStart.y };
      }
      if (s.tangentEnd && (s.tangentEnd.x !== 0 || s.tangentEnd.y !== 0)) {
        segment.tangentEnd = { x: s.tangentEnd.x, y: s.tangentEnd.y };
      }
      return segment;
    });
    var regions = (network.regions || []).map(function(r, i) {
      return {
        index: i,
        windingRule: r.windingRule,
        loops: r.loops
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
      vertices,
      segments,
      regions
    };
  }
  async function setVectorNetwork(params) {
    var nodeId = params.nodeId;
    var vertices = params.vertices;
    var segments = params.segments;
    var regions = params.regions || [];
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error("Node not found with ID: " + nodeId);
    }
    if (node.type !== "VECTOR") {
      throw new Error("Node is not a VECTOR (type: " + node.type + ")");
    }
    var figmaVertices = vertices.map(function(v) {
      var vert = { x: v.x, y: v.y };
      if (v.strokeCap) {
        vert.strokeCap = v.strokeCap;
      }
      if (v.cornerRadius !== void 0) {
        vert.cornerRadius = v.cornerRadius;
      }
      return vert;
    });
    var figmaSegments = segments.map(function(s) {
      var seg = { start: s.start, end: s.end };
      if (s.tangentStart) {
        seg.tangentStart = { x: s.tangentStart.x, y: s.tangentStart.y };
      }
      if (s.tangentEnd) {
        seg.tangentEnd = { x: s.tangentEnd.x, y: s.tangentEnd.y };
      }
      return seg;
    });
    var figmaRegions = regions.map(function(r) {
      return {
        windingRule: r.windingRule || "NONZERO",
        loops: r.loops
      };
    });
    await node.setVectorNetworkAsync({
      vertices: figmaVertices,
      segments: figmaSegments,
      regions: figmaRegions
    });
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
      regionCount: (updatedNetwork.regions || []).length
    };
  }

  // src/claude_figma_plugin/src/prototyping.ts
  async function getReactions(nodeIds) {
    try {
      let getNodePath = function(node) {
        const path = [];
        let current = node;
        while (current && current.parent) {
          path.unshift(current.name);
          current = current.parent;
        }
        return path.join(" > ");
      };
      const commandId = generateCommandId();
      sendProgressUpdate(
        commandId,
        "get_reactions",
        "started",
        0,
        nodeIds.length,
        0,
        `Starting deep search for reactions in ${nodeIds.length} nodes and their children`
      );
      async function findNodesWithReactions(node, processedNodes = /* @__PURE__ */ new Set(), depth = 0, results = []) {
        if (processedNodes.has(node.id)) {
          return results;
        }
        processedNodes.add(node.id);
        let filteredReactions = [];
        if (node.reactions && node.reactions.length > 0) {
          filteredReactions = node.reactions.filter((r) => {
            if (r.action && r.action.navigation === "CHANGE_TO") return false;
            if (Array.isArray(r.actions)) {
              return !r.actions.some((a) => a.navigation === "CHANGE_TO");
            }
            return true;
          });
        }
        const hasFilteredReactions = filteredReactions.length > 0;
        if (hasFilteredReactions) {
          results.push({
            id: node.id,
            name: node.name,
            type: node.type,
            depth,
            hasReactions: true,
            reactions: filteredReactions,
            path: getNodePath(node)
          });
          await highlightNodeWithAnimation(node);
        }
        if (node.children) {
          for (const child of node.children) {
            await findNodesWithReactions(child, processedNodes, depth + 1, results);
          }
        }
        return results;
      }
      async function highlightNodeWithAnimation(node) {
        const originalStrokeWeight = typeof node.strokeWeight === "number" ? node.strokeWeight : 1;
        const originalStrokes = node.strokes && node.strokes !== figma.mixed ? [...node.strokes] : [];
        try {
          node.strokeWeight = 4;
          node.strokes = [{
            type: "SOLID",
            color: { r: 1, g: 0.5, b: 0 },
            // Orange color
            opacity: 0.8
          }];
          setTimeout(() => {
            try {
              node.strokeWeight = originalStrokeWeight;
              node.strokes = originalStrokes;
            } catch (restoreError) {
              console.error(`Error restoring node stroke: ${restoreError.message}`);
            }
          }, 1500);
        } catch (highlightError) {
          console.error(`Error highlighting node: ${highlightError.message}`);
        }
      }
      let allResults = [];
      let processedCount = 0;
      const totalCount = nodeIds.length;
      for (let i = 0; i < nodeIds.length; i++) {
        try {
          const nodeId = nodeIds[i];
          const node = await figma.getNodeByIdAsync(nodeId);
          if (!node) {
            processedCount++;
            sendProgressUpdate(
              commandId,
              "get_reactions",
              "in_progress",
              processedCount / totalCount,
              totalCount,
              processedCount,
              `Node not found: ${nodeId}`
            );
            continue;
          }
          const processedNodes = /* @__PURE__ */ new Set();
          const nodeResults = await findNodesWithReactions(node, processedNodes);
          allResults = allResults.concat(nodeResults);
          processedCount++;
          sendProgressUpdate(
            commandId,
            "get_reactions",
            "in_progress",
            processedCount / totalCount,
            totalCount,
            processedCount,
            `Processed node ${processedCount}/${totalCount}, found ${nodeResults.length} nodes with reactions`
          );
        } catch (error) {
          processedCount++;
          sendProgressUpdate(
            commandId,
            "get_reactions",
            "in_progress",
            processedCount / totalCount,
            totalCount,
            processedCount,
            `Error processing node: ${error.message}`
          );
        }
      }
      sendProgressUpdate(
        commandId,
        "get_reactions",
        "completed",
        1,
        totalCount,
        totalCount,
        `Completed deep search: found ${allResults.length} nodes with reactions.`
      );
      return {
        nodesCount: nodeIds.length,
        nodesWithReactions: allResults.length,
        nodes: allResults
      };
    } catch (error) {
      throw new Error(`Failed to get reactions: ${error.message}`);
    }
  }
  function buildReaction(trigger, action) {
    var reaction = { trigger: {}, actions: [] };
    reaction.trigger.type = trigger.type;
    if (trigger.delay !== void 0) reaction.trigger.delay = trigger.delay;
    if (trigger.keyCodes) reaction.trigger.keyCodes = trigger.keyCodes;
    var act;
    if (action.type === "NODE" && action.navigation) {
      act = {
        type: "NODE",
        navigation: action.navigation,
        destinationId: action.destinationId || null,
        preserveScrollPosition: action.preserveScrollPosition || false,
        resetScrollPosition: action.resetScrollPosition || false,
        resetInteractiveComponents: action.resetInteractiveComponents || false,
        resetVideoPosition: action.resetVideoPosition || false
      };
      if (action.overlayRelativePosition) act.overlayRelativePosition = action.overlayRelativePosition;
      if (action.transition) {
        var dur = action.transition.duration !== void 0 ? action.transition.duration : 0.3;
        if (dur > 10) dur = dur / 1e3;
        act.transition = {
          type: action.transition.type,
          duration: dur,
          easing: action.transition.easing || { type: "EASE_IN_AND_OUT" }
        };
        if (action.transition.direction) {
          act.transition.direction = action.transition.direction;
          act.transition.matchLayers = action.transition.matchLayers || false;
        }
      } else {
        act.transition = { type: "DISSOLVE", duration: 0.3, easing: { type: "EASE_IN_AND_OUT" } };
      }
    } else {
      act = { type: action.type };
      if (action.url) act.url = action.url;
      if (action.variableId) act.variableId = action.variableId;
      if (action.variableValue !== void 0) act.variableValue = action.variableValue;
    }
    reaction.actions = [act];
    return reaction;
  }
  function buildFullReaction(spec) {
    var reaction = { trigger: {}, actions: [] };
    reaction.trigger.type = spec.trigger.type;
    if (spec.trigger.delay !== void 0) reaction.trigger.delay = spec.trigger.delay;
    if (spec.trigger.keyCodes) reaction.trigger.keyCodes = spec.trigger.keyCodes;
    reaction.actions = (spec.actions || []).map(function(action) {
      if (action.type === "NODE" && action.navigation) {
        var act = {
          type: "NODE",
          navigation: action.navigation,
          destinationId: action.destinationId || null,
          preserveScrollPosition: action.preserveScrollPosition || false,
          resetScrollPosition: action.resetScrollPosition || false,
          resetInteractiveComponents: action.resetInteractiveComponents || false,
          resetVideoPosition: action.resetVideoPosition || false
        };
        if (action.overlayRelativePosition) act.overlayRelativePosition = action.overlayRelativePosition;
        if (action.transition) {
          var dur = action.transition.duration !== void 0 ? action.transition.duration : 0.3;
          if (dur > 10) dur = dur / 1e3;
          act.transition = {
            type: action.transition.type,
            duration: dur,
            easing: action.transition.easing || { type: "EASE_IN_AND_OUT" }
          };
          if (action.transition.direction) {
            act.transition.direction = action.transition.direction;
            act.transition.matchLayers = action.transition.matchLayers || false;
          }
        } else {
          act.transition = { type: "DISSOLVE", duration: 0.3, easing: { type: "EASE_IN_AND_OUT" } };
        }
        return act;
      }
      var act = { type: action.type };
      if (action.url) act.url = action.url;
      if (action.variableId) act.variableId = action.variableId;
      if (action.variableValue !== void 0) act.variableValue = action.variableValue;
      return act;
    });
    return reaction;
  }
  async function execReactionsCode(code) {
    var AsyncFunction = Object.getPrototypeOf(async function() {
    }).constructor;
    var fn = new AsyncFunction("figma", code);
    try {
      return await fn(figma);
    } catch (e) {
      throw new Error("in execReactionsCode: " + (e.message || String(e)));
    }
  }
  async function setReactions(params) {
    var nodeId = params.nodeId;
    var reactions = params.reactions;
    var built = reactions.map(function(r) {
      return buildFullReaction(r);
    });
    var reactionsJson = JSON.stringify(built);
    var result = await execReactionsCode(
      'var node = await figma.getNodeByIdAsync("' + nodeId + '");if (!node) throw new Error("Node not found: ' + nodeId + '");var reactions = ' + reactionsJson + ';await node.setReactionsAsync([]);await node.setReactionsAsync(reactions);return { success: true, nodeId: "' + nodeId + '", nodeName: node.name, reactionsSet: reactions.length };'
    );
    return result;
  }
  async function addReaction(params) {
    var nodeId = params.nodeId;
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) throw new Error("Node not found: " + nodeId);
    var newReaction = buildReaction(params.trigger, params.action);
    var newReactionJson = JSON.stringify(newReaction);
    var result = await execReactionsCode(
      'var node = await figma.getNodeByIdAsync("' + nodeId + '");var existing = JSON.parse(JSON.stringify(node.reactions || []));var newR = ' + newReactionJson + ";existing.push(newR);await node.setReactionsAsync(existing);return existing.length;"
    );
    return {
      success: true,
      nodeId,
      nodeName: node.name,
      totalReactions: result || 1
    };
  }
  async function removeReactions(params) {
    var nodeId = params.nodeId;
    var triggerType = params.triggerType;
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) throw new Error("Node not found: " + nodeId);
    var filterCode = triggerType ? 'var updated = existing.filter(function(r) { return r.trigger && r.trigger.type !== "' + triggerType + '"; });' : "var updated = [];";
    var result = await execReactionsCode(
      'var node = await figma.getNodeByIdAsync("' + nodeId + '");var existing = JSON.parse(JSON.stringify(node.reactions || []));var before = existing.length;' + filterCode + "await node.setReactionsAsync(updated);return { before: before, after: updated.length };"
    );
    var before = result ? result.before : 0;
    var after = result ? result.after : 0;
    return {
      success: true,
      nodeId,
      nodeName: node.name,
      removedCount: before - after,
      remainingCount: after,
      filter: triggerType || "ALL"
    };
  }
  async function getInteractions(params) {
    var nodeId = params.nodeId;
    var recursive = params.recursive || false;
    var node = await figma.getNodeByIdAsync(nodeId);
    if (!node) throw new Error("Node not found: " + nodeId);
    var interactions = [];
    async function extractInteractions(n) {
      var nodeReactions = n.reactions ? Array.from(n.reactions) : [];
      if (nodeReactions.length > 0) {
        for (var i = 0; i < nodeReactions.length; i++) {
          var reaction = nodeReactions[i];
          var actions = reaction.actions || (reaction.action ? [reaction.action] : []);
          var resolvedActions = [];
          for (var j = 0; j < actions.length; j++) {
            var act = actions[j];
            var resolved = {
              type: act.type,
              navigation: act.navigation || null,
              destinationId: act.destinationId || null,
              destinationName: null,
              transition: act.transition || null,
              url: act.url || null
            };
            if (act.destinationId) {
              try {
                var destNode = await figma.getNodeByIdAsync(act.destinationId);
                if (destNode) resolved.destinationName = destNode.name;
              } catch (e) {
              }
            }
            resolvedActions.push(resolved);
          }
          interactions.push({
            nodeId: n.id,
            nodeName: n.name,
            nodeType: n.type,
            trigger: reaction.trigger ? reaction.trigger.type : "UNKNOWN",
            actions: resolvedActions
          });
        }
      }
      if (recursive && "children" in n && n.children) {
        for (var k = 0; k < n.children.length; k++) {
          await extractInteractions(n.children[k]);
        }
      }
    }
    await extractInteractions(node);
    return {
      nodeId,
      nodeName: node.name,
      interactionCount: interactions.length,
      interactions
    };
  }
  async function batchSetReactions(params) {
    var operations = params.operations;
    var results = [];
    var successCount = 0;
    var errorCount = 0;
    for (var i = 0; i < operations.length; i++) {
      var op = operations[i];
      try {
        var built = op.reactions.map(function(r) {
          return buildFullReaction(r);
        });
        var reactionsJson = JSON.stringify(built);
        await execReactionsCode(
          'var node = await figma.getNodeByIdAsync("' + op.nodeId + '");if (!node) throw new Error("Node not found: ' + op.nodeId + '");var reactions = ' + reactionsJson + ";await node.setReactionsAsync([]);await node.setReactionsAsync(reactions);"
        );
        results.push({ nodeId: op.nodeId, success: true, reactionsSet: built.length });
        successCount++;
      } catch (err) {
        results.push({ nodeId: op.nodeId, success: false, error: err.message || String(err) });
        errorCount++;
      }
    }
    return {
      success: errorCount === 0,
      totalOperations: operations.length,
      successCount,
      errorCount,
      results
    };
  }
  async function setDefaultConnector(params) {
    const { connectorId } = params || {};
    if (connectorId) {
      const node = await figma.getNodeByIdAsync(connectorId);
      if (!node) {
        throw new Error(`Connector node not found with ID: ${connectorId}`);
      }
      if (node.type !== "CONNECTOR") {
        throw new Error(`Node is not a connector: ${connectorId}`);
      }
      await figma.clientStorage.setAsync("defaultConnectorId", connectorId);
      return {
        success: true,
        message: `Default connector set to: ${connectorId}`,
        connectorId
      };
    } else {
      try {
        const existingConnectorId = await figma.clientStorage.getAsync("defaultConnectorId");
        if (existingConnectorId) {
          try {
            const existingConnector = await figma.getNodeByIdAsync(existingConnectorId);
            if (existingConnector && existingConnector.type === "CONNECTOR") {
              return {
                success: true,
                message: `Default connector is already set to: ${existingConnectorId}`,
                connectorId: existingConnectorId,
                exists: true
              };
            } else {
              console.log(`Stored connector ID ${existingConnectorId} is no longer valid, finding a new connector...`);
            }
          } catch (error) {
            console.log(`Error finding stored connector: ${error.message}. Will try to set a new one.`);
          }
        }
      } catch (error) {
        console.log(`Error checking for existing connector: ${error.message}`);
      }
      try {
        const currentPageConnectors = figma.currentPage.findAllWithCriteria({ types: ["CONNECTOR"] });
        if (currentPageConnectors && currentPageConnectors.length > 0) {
          const foundConnector = currentPageConnectors[0];
          const autoFoundId = foundConnector.id;
          await figma.clientStorage.setAsync("defaultConnectorId", autoFoundId);
          return {
            success: true,
            message: `Automatically found and set default connector to: ${autoFoundId}`,
            connectorId: autoFoundId,
            autoSelected: true
          };
        } else {
          throw new Error("No connector found in the current page. Please create a connector in Figma first or specify a connector ID.");
        }
      } catch (error) {
        throw new Error(`Failed to find a connector: ${error.message}`);
      }
    }
  }
  async function createCursorNode(targetNodeId) {
    const svgString = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 8V35.2419L22 28.4315L27 39.7823C27 39.7823 28.3526 40.2722 29 39.7823C29.6474 39.2924 30.2913 38.3057 30 37.5121C28.6247 33.7654 25 26.1613 25 26.1613H32L16 8Z" fill="#202125" />
  </svg>`;
    try {
      const targetNode = await figma.getNodeByIdAsync(targetNodeId);
      if (!targetNode) throw new Error("Target node not found");
      let parentNodeId = targetNodeId.includes(";") ? targetNodeId.split(";")[0] : targetNodeId;
      if (!parentNodeId) throw new Error("Could not determine parent node ID");
      let parentNode = await figma.getNodeByIdAsync(parentNodeId);
      if (!parentNode) throw new Error("Parent node not found");
      if (parentNode.type === "INSTANCE" || parentNode.type === "COMPONENT" || parentNode.type === "COMPONENT_SET") {
        parentNode = parentNode.parent;
        if (!parentNode) throw new Error("Parent node not found");
      }
      const importedNode = await figma.createNodeFromSvg(svgString);
      if (!importedNode || !importedNode.id) {
        throw new Error("Failed to create imported cursor node");
      }
      importedNode.name = "TTF_Connector / Mouse Cursor";
      importedNode.resize(48, 48);
      const cursorNode = importedNode.findOne((node) => node.type === "VECTOR");
      if (cursorNode) {
        cursorNode.fills = [{
          type: "SOLID",
          color: { r: 0, g: 0, b: 0 },
          opacity: 1
        }];
        cursorNode.strokes = [{
          type: "SOLID",
          color: { r: 1, g: 1, b: 1 },
          opacity: 1
        }];
        cursorNode.strokeWeight = 2;
        cursorNode.strokeAlign = "OUTSIDE";
        cursorNode.effects = [{
          type: "DROP_SHADOW",
          color: { r: 0, g: 0, b: 0, a: 0.3 },
          offset: { x: 1, y: 1 },
          radius: 2,
          spread: 0,
          visible: true,
          blendMode: "NORMAL"
        }];
      }
      parentNode.appendChild(importedNode);
      if ("layoutMode" in parentNode && parentNode.layoutMode !== "NONE") {
        importedNode.layoutPositioning = "ABSOLUTE";
      }
      if (targetNode.absoluteBoundingBox && parentNode.absoluteBoundingBox) {
        console.log("targetNode.absoluteBoundingBox", targetNode.absoluteBoundingBox);
        console.log("parentNode.absoluteBoundingBox", parentNode.absoluteBoundingBox);
        importedNode.x = targetNode.absoluteBoundingBox.x - parentNode.absoluteBoundingBox.x + targetNode.absoluteBoundingBox.width / 2 - 48 / 2;
        importedNode.y = targetNode.absoluteBoundingBox.y - parentNode.absoluteBoundingBox.y + targetNode.absoluteBoundingBox.height / 2 - 48 / 2;
      } else if ("x" in targetNode && "y" in targetNode && "width" in targetNode && "height" in targetNode) {
        console.log("targetNode.x/y/width/height", targetNode.x, targetNode.y, targetNode.width, targetNode.height);
        importedNode.x = targetNode.x + targetNode.width / 2 - 48 / 2;
        importedNode.y = targetNode.y + targetNode.height / 2 - 48 / 2;
      } else {
        if ("x" in targetNode && "y" in targetNode) {
          console.log("Fallback to targetNode x/y");
          importedNode.x = targetNode.x;
          importedNode.y = targetNode.y;
        } else {
          console.log("Fallback to (0,0)");
          importedNode.x = 0;
          importedNode.y = 0;
        }
      }
      console.log("importedNode", importedNode);
      return { id: importedNode.id, node: importedNode };
    } catch (error) {
      console.error("Error creating cursor from SVG:", error);
      return { id: null, node: null, error: error.message };
    }
  }
  async function createConnections(params) {
    if (!params || !params.connections || !Array.isArray(params.connections)) {
      throw new Error("Missing or invalid connections parameter");
    }
    const { connections } = params;
    const commandId = generateCommandId();
    sendProgressUpdate(
      commandId,
      "create_connections",
      "started",
      0,
      connections.length,
      0,
      `Starting to create ${connections.length} connections`
    );
    const defaultConnectorId = await figma.clientStorage.getAsync("defaultConnectorId");
    if (!defaultConnectorId) {
      throw new Error('No default connector set. Please try one of the following options to create connections:\n1. Create a connector in FigJam and copy/paste it to your current page, then run the "set_default_connector" command.\n2. Select an existing connector on the current page, then run the "set_default_connector" command.');
    }
    const defaultConnector = await figma.getNodeByIdAsync(defaultConnectorId);
    if (!defaultConnector) {
      throw new Error(`Default connector not found with ID: ${defaultConnectorId}`);
    }
    if (defaultConnector.type !== "CONNECTOR") {
      throw new Error(`Node is not a connector: ${defaultConnectorId}`);
    }
    const results = [];
    let processedCount = 0;
    const totalCount = connections.length;
    for (let i = 0; i < connections.length; i++) {
      try {
        const { startNodeId: originalStartId, endNodeId: originalEndId, text } = connections[i];
        let startId = originalStartId;
        let endId = originalEndId;
        if (startId.includes(";")) {
          console.log(`Nested start node detected: ${startId}. Creating cursor node.`);
          const cursorResult = await createCursorNode(startId);
          if (!cursorResult || !cursorResult.id) {
            throw new Error(`Failed to create cursor node for nested start node: ${startId}`);
          }
          startId = cursorResult.id;
        }
        const startNode = await figma.getNodeByIdAsync(startId);
        if (!startNode) throw new Error(`Start node not found with ID: ${startId}`);
        if (endId.includes(";")) {
          console.log(`Nested end node detected: ${endId}. Creating cursor node.`);
          const cursorResult = await createCursorNode(endId);
          if (!cursorResult || !cursorResult.id) {
            throw new Error(`Failed to create cursor node for nested end node: ${endId}`);
          }
          endId = cursorResult.id;
        }
        const endNode = await figma.getNodeByIdAsync(endId);
        if (!endNode) throw new Error(`End node not found with ID: ${endId}`);
        const clonedConnector = defaultConnector.clone();
        clonedConnector.name = `TTF_Connector/${startNode.id}/${endNode.id}`;
        clonedConnector.connectorStart = {
          endpointNodeId: startId,
          magnet: "AUTO"
        };
        clonedConnector.connectorEnd = {
          endpointNodeId: endId,
          magnet: "AUTO"
        };
        if (text) {
          try {
            try {
              if (defaultConnector.text && defaultConnector.text.fontName) {
                const fontName = defaultConnector.text.fontName;
                await figma.loadFontAsync(fontName);
                clonedConnector.text.fontName = fontName;
              } else {
                await figma.loadFontAsync({ family: "Inter", style: "Regular" });
              }
            } catch (fontError) {
              try {
                await figma.loadFontAsync({ family: "Inter", style: "Medium" });
              } catch (mediumFontError) {
                try {
                  await figma.loadFontAsync({ family: "System", style: "Regular" });
                } catch (systemFontError) {
                  throw new Error(`Failed to load any font: ${fontError.message}`);
                }
              }
            }
            clonedConnector.text.characters = text;
          } catch (textError) {
            console.error("Error setting text:", textError);
            results.push({
              id: clonedConnector.id,
              startNodeId: originalStartId,
              endNodeId: originalEndId,
              text: "",
              textError: textError.message
            });
            continue;
          }
        }
        results.push({
          id: clonedConnector.id,
          originalStartNodeId: originalStartId,
          originalEndNodeId: originalEndId,
          usedStartNodeId: startId,
          // ID actually used for connection
          usedEndNodeId: endId,
          // ID actually used for connection
          text: text || ""
        });
        processedCount++;
        sendProgressUpdate(
          commandId,
          "create_connections",
          "in_progress",
          processedCount / totalCount,
          totalCount,
          processedCount,
          `Created connection ${processedCount}/${totalCount}`
        );
      } catch (error) {
        console.error("Error creating connection", error);
        processedCount++;
        sendProgressUpdate(
          commandId,
          "create_connections",
          "in_progress",
          processedCount / totalCount,
          totalCount,
          processedCount,
          `Error creating connection: ${error.message}`
        );
        results.push({
          error: error.message,
          connectionInfo: connections[i]
        });
      }
    }
    sendProgressUpdate(
      commandId,
      "create_connections",
      "completed",
      1,
      totalCount,
      totalCount,
      `Completed creating ${results.length} connections`
    );
    return {
      success: true,
      count: results.length,
      connections: results
    };
  }
  async function setFocus(params) {
    if (!params || !params.nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    const node = await figma.getNodeByIdAsync(params.nodeId);
    if (!node) {
      throw new Error(`Node with ID ${params.nodeId} not found`);
    }
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    return {
      success: true,
      name: node.name,
      id: node.id,
      message: `Focused on node "${node.name}"`
    };
  }
  async function setSelections(params) {
    if (!params || !params.nodeIds || !Array.isArray(params.nodeIds)) {
      throw new Error("Missing or invalid nodeIds parameter");
    }
    if (params.nodeIds.length === 0) {
      throw new Error("nodeIds array cannot be empty");
    }
    const nodes = [];
    const notFoundIds = [];
    for (const nodeId of params.nodeIds) {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (node) {
        nodes.push(node);
      } else {
        notFoundIds.push(nodeId);
      }
    }
    if (nodes.length === 0) {
      throw new Error(`No valid nodes found for the provided IDs: ${params.nodeIds.join(", ")}`);
    }
    figma.currentPage.selection = nodes;
    figma.viewport.scrollAndZoomIntoView(nodes);
    const selectedNodes = nodes.map((node) => ({
      name: node.name,
      id: node.id
    }));
    return {
      success: true,
      count: nodes.length,
      selectedNodes,
      notFoundIds,
      message: `Selected ${nodes.length} nodes${notFoundIds.length > 0 ? ` (${notFoundIds.length} not found)` : ""}`
    };
  }

  // src/claude_figma_plugin/src/node-tree.ts
  function expandRepeats(node) {
    if (!node || typeof node !== "object") return node;
    if (node.children && Array.isArray(node.children)) {
      const expandedChildren = [];
      for (const child of node.children) {
        if (child && child.$repeat) {
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
  function substituteTemplate(template, row) {
    if (typeof template === "string") {
      return substituteString(template, row);
    }
    if (Array.isArray(template)) {
      return template.map((item) => substituteTemplate(item, row));
    }
    if (template && typeof template === "object") {
      const result = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = substituteTemplate(value, row);
      }
      return result;
    }
    return template;
  }
  function substituteString(str, row) {
    if (Array.isArray(row)) {
      return str.replace(/\$\[(\d+)\]/g, (match, idx) => {
        const i = parseInt(idx, 10);
        return i < row.length ? String(row[i]) : match;
      });
    }
    if (row && typeof row === "object") {
      const keys = Object.keys(row).sort((a, b) => b.length - a.length);
      let result = str;
      for (const key of keys) {
        result = result.replace(
          new RegExp("\\$" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=\\W|$)", "g"),
          String(row[key])
        );
      }
      return result;
    }
    return str;
  }
  async function createNodeTree(params, firstOnTop = true) {
    const { tree: rawTree, parentId, rootId, prune, commandId } = params || {};
    if (!rawTree) {
      throw new Error("Missing tree parameter");
    }
    const tree = expandRepeats(rawTree);
    const startTime = Date.now();
    let maxDepthSeen = 0;
    const nodeTypeCounts = {};
    function warnRepeatWithoutAutoLayout(node, hadRepeat) {
      if (!node || typeof node !== "object") return;
      if (node.children && Array.isArray(node.children)) {
        var parentHasAutoLayout = node.layoutMode && node.layoutMode !== "NONE";
        if (hadRepeat && !parentHasAutoLayout && node.children.length > 1) {
          console.warn(
            "[create_node_tree] $repeat produced " + node.children.length + ' children inside frame "' + (node.name || "unnamed") + '" which has no auto-layout (layoutMode is NONE/missing). Children will stack at (0,0). Add layoutMode: "VERTICAL" or "HORIZONTAL" to fix.'
          );
        }
        for (var i = 0; i < node.children.length; i++) {
          warnRepeatWithoutAutoLayout(node.children[i], false);
        }
      }
    }
    function treeHadRepeat(node) {
      if (!node || typeof node !== "object") return false;
      if (node.children && Array.isArray(node.children)) {
        for (var i = 0; i < node.children.length; i++) {
          if (node.children[i] && node.children[i].$repeat) return true;
        }
      }
      return false;
    }
    warnRepeatWithoutAutoLayout(tree, treeHadRepeat(rawTree));
    function countNodes(node) {
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
    const nodes = [];
    const errors = [];
    const COLOR_FIELDS = {
      fillColor: "fills",
      strokeColor: "strokes",
      fontColor: "fills"
      // text fill color
    };
    async function updateNodeProperties(existingNode, spec) {
      const changedProps = [];
      const type = existingNode.type.toLowerCase();
      if (spec.name !== void 0 && existingNode.name !== spec.name) {
        existingNode.name = spec.name;
        changedProps.push("name");
      }
      if (spec.x !== void 0 && existingNode.x !== spec.x) {
        existingNode.x = spec.x;
        changedProps.push("x");
      }
      if (spec.y !== void 0 && existingNode.y !== spec.y) {
        existingNode.y = spec.y;
        changedProps.push("y");
      }
      if (spec.opacity !== void 0 && existingNode.opacity !== spec.opacity) {
        existingNode.opacity = spec.opacity;
        changedProps.push("opacity");
      }
      if (type === "frame") {
        if (spec.width !== void 0 && spec.height !== void 0) {
          if (existingNode.width !== spec.width || existingNode.height !== spec.height) {
            existingNode.resize(spec.width, spec.height);
            changedProps.push("size");
          }
        }
        if (spec.fillColor !== void 0) {
          applyColorPaint(existingNode, "fills", spec.fillColor);
          changedProps.push("fillColor");
        }
        if (spec.strokeColor !== void 0) {
          applyColorPaint(existingNode, "strokes", spec.strokeColor);
          changedProps.push("strokeColor");
        }
        if (spec.strokeWeight !== void 0 && existingNode.strokeWeight !== spec.strokeWeight) {
          existingNode.strokeWeight = spec.strokeWeight;
          changedProps.push("strokeWeight");
        }
        if (spec.cornerRadius !== void 0 && existingNode.cornerRadius !== spec.cornerRadius) {
          existingNode.cornerRadius = spec.cornerRadius;
          changedProps.push("cornerRadius");
        }
        if (spec.clipsContent !== void 0 && existingNode.clipsContent !== !!spec.clipsContent) {
          existingNode.clipsContent = !!spec.clipsContent;
          changedProps.push("clipsContent");
        }
        if (spec.layoutMode !== void 0 && existingNode.layoutMode !== spec.layoutMode) {
          existingNode.layoutMode = spec.layoutMode;
          changedProps.push("layoutMode");
        }
        if (spec.layoutWrap !== void 0 && existingNode.layoutWrap !== spec.layoutWrap) {
          existingNode.layoutWrap = spec.layoutWrap;
          changedProps.push("layoutWrap");
        }
        if (spec.paddingTop !== void 0 && existingNode.paddingTop !== spec.paddingTop) {
          existingNode.paddingTop = spec.paddingTop;
          changedProps.push("paddingTop");
        }
        if (spec.paddingRight !== void 0 && existingNode.paddingRight !== spec.paddingRight) {
          existingNode.paddingRight = spec.paddingRight;
          changedProps.push("paddingRight");
        }
        if (spec.paddingBottom !== void 0 && existingNode.paddingBottom !== spec.paddingBottom) {
          existingNode.paddingBottom = spec.paddingBottom;
          changedProps.push("paddingBottom");
        }
        if (spec.paddingLeft !== void 0 && existingNode.paddingLeft !== spec.paddingLeft) {
          existingNode.paddingLeft = spec.paddingLeft;
          changedProps.push("paddingLeft");
        }
        if (spec.primaryAxisAlignItems !== void 0 && existingNode.primaryAxisAlignItems !== spec.primaryAxisAlignItems) {
          existingNode.primaryAxisAlignItems = spec.primaryAxisAlignItems;
          changedProps.push("primaryAxisAlignItems");
        }
        if (spec.counterAxisAlignItems !== void 0 && existingNode.counterAxisAlignItems !== spec.counterAxisAlignItems) {
          existingNode.counterAxisAlignItems = spec.counterAxisAlignItems;
          changedProps.push("counterAxisAlignItems");
        }
        if (spec.itemSpacing !== void 0 && existingNode.itemSpacing !== spec.itemSpacing) {
          existingNode.itemSpacing = spec.itemSpacing;
          changedProps.push("itemSpacing");
        }
        if (spec.counterAxisSpacing !== void 0 && existingNode.counterAxisSpacing !== spec.counterAxisSpacing) {
          existingNode.counterAxisSpacing = spec.counterAxisSpacing;
          changedProps.push("counterAxisSpacing");
        }
        if (spec.itemReverseZIndex !== void 0 && existingNode.itemReverseZIndex !== !!spec.itemReverseZIndex) {
          existingNode.itemReverseZIndex = !!spec.itemReverseZIndex;
          changedProps.push("itemReverseZIndex");
        }
        if (spec.layoutSizingHorizontal !== void 0 && spec.layoutSizingHorizontal !== "FILL") {
          if (existingNode.layoutSizingHorizontal !== spec.layoutSizingHorizontal) {
            existingNode.layoutSizingHorizontal = spec.layoutSizingHorizontal;
            changedProps.push("layoutSizingHorizontal");
          }
        }
        if (spec.layoutSizingVertical !== void 0 && spec.layoutSizingVertical !== "FILL") {
          if (existingNode.layoutSizingVertical !== spec.layoutSizingVertical) {
            existingNode.layoutSizingVertical = spec.layoutSizingVertical;
            changedProps.push("layoutSizingVertical");
          }
        }
      }
      if (type === "text") {
        const userFontFamily = spec.fontFamily || "Inter";
        const userFontStyle = spec.fontStyle || fontWeightToStyle(spec.fontWeight || 400);
        const currentFontName = existingNode.fontName;
        if (!currentFontName || typeof currentFontName === "symbol" || currentFontName.family !== userFontFamily || currentFontName.style !== userFontStyle) {
          try {
            await figma.loadFontAsync({ family: userFontFamily, style: userFontStyle });
            existingNode.fontName = { family: userFontFamily, style: userFontStyle };
            changedProps.push("fontName");
          } catch (err) {
            try {
              await figma.loadFontAsync({ family: "Inter", style: fontWeightToStyle(spec.fontWeight || 400) });
              existingNode.fontName = { family: "Inter", style: fontWeightToStyle(spec.fontWeight || 400) };
              changedProps.push("fontName");
            } catch (e2) {
            }
          }
        } else {
          try {
            await figma.loadFontAsync({ family: userFontFamily, style: userFontStyle });
          } catch (e) {
          }
        }
        if (spec.text !== void 0 && existingNode.characters !== spec.text) {
          await setCharacters(existingNode, spec.text);
          changedProps.push("characters");
        }
        if (spec.fontSize !== void 0 && existingNode.fontSize !== parseInt(spec.fontSize)) {
          existingNode.fontSize = parseInt(spec.fontSize);
          changedProps.push("fontSize");
        }
        if (spec.fontColor !== void 0) {
          applyColorPaint(existingNode, "fills", spec.fontColor);
          changedProps.push("fontColor");
        }
        if (spec.textAlignHorizontal !== void 0 && existingNode.textAlignHorizontal !== spec.textAlignHorizontal) {
          existingNode.textAlignHorizontal = spec.textAlignHorizontal;
          changedProps.push("textAlignHorizontal");
        }
        if (spec.lineHeight !== void 0) {
          existingNode.lineHeight = { value: spec.lineHeight, unit: "PIXELS" };
          changedProps.push("lineHeight");
        }
        if (spec.letterSpacing !== void 0) {
          existingNode.letterSpacing = { value: spec.letterSpacing, unit: "PIXELS" };
          changedProps.push("letterSpacing");
        }
        if (spec.textCase !== void 0 && existingNode.textCase !== spec.textCase) {
          existingNode.textCase = spec.textCase;
          changedProps.push("textCase");
        }
        if (spec.width !== void 0) {
          existingNode.resize(spec.width, existingNode.height);
          existingNode.textAutoResize = "HEIGHT";
          changedProps.push("width");
        }
      }
      if (type === "rectangle") {
        if (spec.width !== void 0 && spec.height !== void 0) {
          if (existingNode.width !== spec.width || existingNode.height !== spec.height) {
            existingNode.resize(spec.width, spec.height);
            changedProps.push("size");
          }
        }
        if (spec.fillColor !== void 0) {
          applyColorPaint(existingNode, "fills", spec.fillColor);
          changedProps.push("fillColor");
        }
        if (spec.strokeColor !== void 0) {
          applyColorPaint(existingNode, "strokes", spec.strokeColor);
          changedProps.push("strokeColor");
        }
        if (spec.strokeWeight !== void 0 && existingNode.strokeWeight !== spec.strokeWeight) {
          existingNode.strokeWeight = spec.strokeWeight;
          changedProps.push("strokeWeight");
        }
        if (spec.cornerRadius !== void 0 && existingNode.cornerRadius !== spec.cornerRadius) {
          existingNode.cornerRadius = spec.cornerRadius;
          changedProps.push("cornerRadius");
        }
      }
      if (type === "vector") {
        if (spec.width !== void 0 && spec.height !== void 0) {
          if (existingNode.width !== spec.width || existingNode.height !== spec.height) {
            existingNode.resize(spec.width, spec.height);
            changedProps.push("size");
          }
        }
        if (spec.fillColor !== void 0) {
          applyColorPaint(existingNode, "fills", spec.fillColor);
          changedProps.push("fillColor");
        }
        if (spec.strokeColor !== void 0) {
          applyColorPaint(existingNode, "strokes", spec.strokeColor);
          changedProps.push("strokeColor");
        }
        if (spec.strokeWeight !== void 0 && existingNode.strokeWeight !== spec.strokeWeight) {
          existingNode.strokeWeight = spec.strokeWeight;
          changedProps.push("strokeWeight");
        }
        if (spec.pathData !== void 0) {
          existingNode.vectorPaths = [{ windingRule: "NONZERO", data: normalizeSvgPath(spec.pathData) }];
          changedProps.push("pathData");
        }
        if (spec.strokeCap !== void 0) {
          var network = existingNode.vectorNetwork;
          if (network && network.vertices) {
            var updatedVertices = network.vertices.map(function(v) {
              return Object.assign({}, v, { strokeCap: spec.strokeCap });
            });
            existingNode.vectorNetwork = Object.assign({}, network, { vertices: updatedVertices });
            changedProps.push("strokeCap");
          }
        }
      }
      return { changed: changedProps.length > 0, changedProps };
    }
    let updatedCount = 0;
    let unchangedCount = 0;
    let prunedCount = 0;
    async function syncNode(spec, existingNode, depth) {
      depth = depth || 0;
      if (depth > maxDepthSeen) maxDepthSeen = depth;
      var type = spec.type;
      nodeTypeCounts[type] = (nodeTypeCounts[type] || 0) + 1;
      if (existingNode.type.toLowerCase() !== type) {
        errors.push({
          type,
          name: spec.name || "(unnamed)",
          error: "Type mismatch: spec=" + type + " existing=" + existingNode.type.toLowerCase()
        });
        return;
      }
      var resolvedSpec = Object.assign({}, spec);
      delete resolvedSpec.type;
      delete resolvedSpec.children;
      var pendingVarBindings = [];
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
            pendingVarBindings.push({ colorProp, figmaField, varRef: resolved.varRef });
          } else if (resolved.color) {
            resolvedSpec[colorProp] = resolved.color;
          }
        }
      }
      try {
        var result = await updateNodeProperties(existingNode, resolvedSpec);
        if (result.changed) {
          updatedCount++;
        } else {
          unchangedCount++;
        }
      } catch (err) {
        errorCount++;
        errors.push({
          type,
          name: spec.name || "(unnamed)",
          error: "Update failed: " + (err.message || String(err))
        });
        return;
      }
      if (pendingVarBindings.length > 0) {
        for (var binding of pendingVarBindings) {
          await bindVariableToColor(existingNode, binding.figmaField, binding.varRef);
        }
      }
      nodes.push({
        id: existingNode.id,
        name: existingNode.name,
        type,
        parentId: existingNode.parent ? existingNode.parent.id : null
      });
      var specChildren = spec.children;
      if (specChildren && Array.isArray(specChildren) && type === "frame") {
        var existingChildren = [];
        for (var i = 0; i < existingNode.children.length; i++) {
          existingChildren.push(existingNode.children[i]);
        }
        var matchMap = {};
        for (var child of existingChildren) {
          var key = (child.name || "") + "::" + child.type.toLowerCase();
          if (!matchMap[key]) matchMap[key] = [];
          matchMap[key].push(child);
        }
        var matchedExistingIds = /* @__PURE__ */ new Set();
        for (var specChild of specChildren) {
          var specName = specChild.name || "";
          var specType = specChild.type;
          var matchKey = specName + "::" + specType;
          if (matchMap[matchKey] && matchMap[matchKey].length > 0) {
            var matchedNode = matchMap[matchKey].shift();
            matchedExistingIds.add(matchedNode.id);
            await syncNode(specChild, matchedNode, depth + 1);
          } else {
            await createNode(specChild, existingNode.id, depth + 1);
          }
        }
        if (prune) {
          for (var existChild of existingChildren) {
            if (!matchedExistingIds.has(existChild.id)) {
              existChild.remove();
              prunedCount++;
            }
          }
        }
      }
      if (type === "frame" && existingNode.layoutMode && existingNode.layoutMode !== "NONE") {
        if (spec.layoutSizingHorizontal === "FILL") {
          try {
            existingNode.layoutSizingHorizontal = "FILL";
          } catch (e) {
          }
        }
        if (spec.layoutSizingVertical === "FILL") {
          try {
            existingNode.layoutSizingVertical = "FILL";
          } catch (e) {
          }
        }
      }
      var processedCount = updatedCount + unchangedCount + createdCount;
      if (commandId && processedCount % 5 === 0) {
        var progress = Math.round(processedCount / totalNodes * 100);
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
    async function createNode(spec, parentNodeId, depth) {
      depth = depth || 0;
      if (depth > maxDepthSeen) maxDepthSeen = depth;
      var type = spec.type;
      nodeTypeCounts[type] = (nodeTypeCounts[type] || 0) + 1;
      var children = spec.children;
      var props = Object.assign({}, spec);
      delete props.type;
      delete props.children;
      const pendingVarBindings = [];
      const createParams = Object.assign({}, props, { parentId: parentNodeId });
      for (const [colorProp, figmaField] of Object.entries(COLOR_FIELDS)) {
        if (createParams[colorProp] != null) {
          const resolved = resolveColorValue(createParams[colorProp]);
          if (resolved.varRef) {
            const variable = await getVariableByName(resolved.varRef);
            if (variable && variable.resolvedType === "COLOR") {
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
      if (createParams.x === void 0) createParams.x = 0;
      if (createParams.y === void 0) createParams.y = 0;
      let result;
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
      } catch (err) {
        errorCount++;
        errors.push({
          type,
          name: props.name || "(unnamed)",
          error: err.message || String(err)
        });
        return;
      }
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
        parentId: parentNodeId || null
      });
      if (commandId && createdCount % 5 === 0) {
        const progress = Math.round(createdCount / totalNodes * 100);
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
      if (children && Array.isArray(children)) {
        for (const child of children) {
          await createNode(child, result.id, depth + 1);
        }
      }
    }
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
      const rootNode = await figma.getNodeByIdAsync(rootId);
      if (!rootNode) throw new Error("Root node not found: " + rootId);
      await syncNode(tree, rootNode, 0);
    } else {
      await createNode(tree, parentId || null, 0);
    }
    if (commandId) {
      var processedTotal = rootId ? updatedCount + unchangedCount + createdCount : createdCount;
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
      errors: errors.length > 0 ? errors : void 0,
      stats: {
        durationMs: Date.now() - startTime,
        maxDepth: maxDepthSeen,
        nodesByType: nodeTypeCounts
      }
    };
  }

  // src/claude_figma_plugin/src/analysis.ts
  function hasBoundVariable(node, field) {
    try {
      var bindings = node.boundVariables;
      if (bindings && bindings[field]) {
        return true;
      }
    } catch (e) {
    }
    return false;
  }
  function isWrapperFrame(node) {
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
  async function screenshotRegion(params) {
    var x = params.x;
    var y = params.y;
    var width = params.width;
    var height = params.height;
    var scale = params.scale || 1;
    var page = figma.currentPage;
    var candidates = [];
    for (var i = 0; i < page.children.length; i++) {
      var child = page.children[i];
      if (child.visible === false) continue;
      if (child.name === "__screenshot_temp__") continue;
      var bb = child.absoluteBoundingBox || { x: child.x, y: child.y, width: child.width, height: child.height };
      var intersects = !(bb.x + bb.width < x || bb.x > x + width || bb.y + bb.height < y || bb.y > y + height);
      if (intersects) {
        candidates.push(child);
      }
    }
    var clipFrame = figma.createFrame();
    clipFrame.name = "__screenshot_temp__";
    clipFrame.x = x;
    clipFrame.y = y;
    clipFrame.resize(width, height);
    clipFrame.clipsContent = true;
    clipFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 1 }];
    page.appendChild(clipFrame);
    try {
      for (var j = 0; j < candidates.length; j++) {
        var node = candidates[j];
        var clone = node.clone();
        clipFrame.appendChild(clone);
        var nodeBB = node.absoluteBoundingBox || { x: node.x, y: node.y };
        clone.x = nodeBB.x - x;
        clone.y = nodeBB.y - y;
      }
      var settings = {
        format: "PNG",
        constraint: { type: "SCALE", value: scale }
      };
      var bytes = await clipFrame.exportAsync(settings);
      var base64 = customBase64Encode(bytes);
      return {
        imageData: base64,
        mimeType: "image/png",
        region: { x, y, width, height },
        scale,
        nodesCaptured: candidates.length
      };
    } finally {
      clipFrame.remove();
    }
  }
  async function batchMutate(params) {
    var operations = params.operations;
    var results = [];
    var successCount = 0;
    var failureCount = 0;
    for (var i = 0; i < operations.length; i++) {
      var op = operations[i];
      try {
        var result = null;
        switch (op.op) {
          case "rename":
            var renameNode2 = await figma.getNodeByIdAsync(op.nodeId);
            if (!renameNode2) throw new Error("Node not found: " + op.nodeId);
            var oldName = renameNode2.name;
            renameNode2.name = op.name;
            result = { op: "rename", nodeId: op.nodeId, oldName, newName: op.name };
            break;
          case "set_fill":
            var fillNode = await figma.getNodeByIdAsync(op.nodeId);
            if (!fillNode) throw new Error("Node not found: " + op.nodeId);
            if (!("fills" in fillNode)) throw new Error("Node does not support fills: " + op.nodeId);
            var fillColor = op.color;
            if (fillColor.a !== void 0 && parseFloat(fillColor.a) === 0) {
              fillNode.fills = [];
            } else {
              fillNode.fills = [{
                type: "SOLID",
                color: { r: fillColor.r || 0, g: fillColor.g || 0, b: fillColor.b || 0 },
                opacity: fillColor.a !== void 0 ? fillColor.a : 1
              }];
            }
            result = { op: "set_fill", nodeId: op.nodeId, name: fillNode.name };
            break;
          case "set_stroke":
            var strokeNode = await figma.getNodeByIdAsync(op.nodeId);
            if (!strokeNode) throw new Error("Node not found: " + op.nodeId);
            if (!("strokes" in strokeNode)) throw new Error("Node does not support strokes: " + op.nodeId);
            var strokeColor = op.color;
            strokeNode.strokes = [{
              type: "SOLID",
              color: { r: strokeColor.r || 0, g: strokeColor.g || 0, b: strokeColor.b || 0 },
              opacity: strokeColor.a !== void 0 ? strokeColor.a : 1
            }];
            if (op.weight !== void 0) {
              strokeNode.strokeWeight = op.weight;
            }
            result = { op: "set_stroke", nodeId: op.nodeId, name: strokeNode.name };
            break;
          case "move":
            var moveNode2 = await figma.getNodeByIdAsync(op.nodeId);
            if (!moveNode2) throw new Error("Node not found: " + op.nodeId);
            if (op.x !== void 0) moveNode2.x = op.x;
            if (op.y !== void 0) moveNode2.y = op.y;
            result = { op: "move", nodeId: op.nodeId, name: moveNode2.name, x: moveNode2.x, y: moveNode2.y };
            break;
          case "resize":
            var resizeNode2 = await figma.getNodeByIdAsync(op.nodeId);
            if (!resizeNode2) throw new Error("Node not found: " + op.nodeId);
            if (!("resize" in resizeNode2) && !("resizeWithoutConstraints" in resizeNode2)) throw new Error("Node does not support resize: " + op.nodeId);
            if ("resize" in resizeNode2) {
              resizeNode2.resize(op.width, op.height);
            } else {
              resizeNode2.resizeWithoutConstraints(op.width, op.height);
            }
            result = { op: "resize", nodeId: op.nodeId, name: resizeNode2.name, width: op.width, height: op.height };
            break;
          case "delete":
            var deleteNode2 = await figma.getNodeByIdAsync(op.nodeId);
            if (!deleteNode2) throw new Error("Node not found: " + op.nodeId);
            var deletedName = deleteNode2.name;
            deleteNode2.remove();
            result = { op: "delete", nodeId: op.nodeId, name: deletedName };
            break;
          case "set_text":
            var textNode = await figma.getNodeByIdAsync(op.nodeId);
            if (!textNode) throw new Error("Node not found: " + op.nodeId);
            if (textNode.type !== "TEXT") throw new Error("Node is not TEXT: " + op.nodeId);
            await loadAllFonts(textNode);
            textNode.characters = op.text;
            result = { op: "set_text", nodeId: op.nodeId, name: textNode.name };
            break;
          case "set_visible":
            var visNode = await figma.getNodeByIdAsync(op.nodeId);
            if (!visNode) throw new Error("Node not found: " + op.nodeId);
            visNode.visible = !!op.visible;
            result = { op: "set_visible", nodeId: op.nodeId, name: visNode.name, visible: visNode.visible };
            break;
          case "set_font":
            var fontNode = await figma.getNodeByIdAsync(op.nodeId);
            if (!fontNode) throw new Error("Node not found: " + op.nodeId);
            if (fontNode.type !== "TEXT") throw new Error("Node is not TEXT: " + op.nodeId);
            var batchFontFamily = op.fontFamily || "Inter";
            var batchFontStyle = op.fontStyle || "Regular";
            await figma.loadFontAsync({ family: batchFontFamily, style: batchFontStyle });
            fontNode.fontName = { family: batchFontFamily, style: batchFontStyle };
            result = { op: "set_font", nodeId: op.nodeId, name: fontNode.name, fontFamily: batchFontFamily, fontStyle: batchFontStyle };
            break;
          case "set_text_align":
            var alignNode = await figma.getNodeByIdAsync(op.nodeId);
            if (!alignNode) throw new Error("Node not found: " + op.nodeId);
            if (alignNode.type !== "TEXT") throw new Error("Node is not TEXT: " + op.nodeId);
            if (op.horizontal !== void 0) alignNode.textAlignHorizontal = op.horizontal;
            if (op.vertical !== void 0) alignNode.textAlignVertical = op.vertical;
            result = { op: "set_text_align", nodeId: op.nodeId, name: alignNode.name, horizontal: alignNode.textAlignHorizontal, vertical: alignNode.textAlignVertical };
            break;
          case "set_vector_path":
            var vpNode = await figma.getNodeByIdAsync(op.nodeId);
            if (!vpNode) throw new Error("Node not found: " + op.nodeId);
            if (vpNode.type !== "VECTOR") throw new Error("Node is not a VECTOR (type: " + vpNode.type + ")");
            vpNode.vectorPaths = [{ windingRule: "NONZERO", data: normalizeSvgPath(op.pathData) }];
            if (op.width !== void 0 && op.height !== void 0) {
              vpNode.resize(op.width, op.height);
            }
            result = { op: "set_vector_path", nodeId: op.nodeId, name: vpNode.name, width: vpNode.width, height: vpNode.height };
            break;
          default:
            throw new Error("Unknown operation: " + op.op);
        }
        results.push(Object.assign({ success: true }, result));
        successCount++;
      } catch (e) {
        results.push({
          success: false,
          op: op.op,
          nodeId: op.nodeId,
          error: e.message || String(e)
        });
        failureCount++;
      }
    }
    return {
      totalOperations: operations.length,
      successCount,
      failureCount,
      results
    };
  }
  async function scanNodeStyles(params) {
    var rootId = params.nodeId;
    var maxDepth = params.maxDepth !== void 0 ? params.maxDepth : 10;
    var root = await figma.getNodeByIdAsync(rootId);
    if (!root) {
      throw new Error("Node not found with ID: " + rootId);
    }
    var results = [];
    function extractFills(node) {
      if (!("fills" in node) || !Array.isArray(node.fills)) return null;
      var fills = [];
      for (var i = 0; i < node.fills.length; i++) {
        var f = node.fills[i];
        if (f.type === "SOLID") {
          fills.push({
            type: "SOLID",
            color: { r: f.color.r, g: f.color.g, b: f.color.b },
            opacity: f.opacity !== void 0 ? f.opacity : 1,
            visible: f.visible !== false,
            boundVariable: hasBoundVariable(node, "fills")
          });
        } else {
          fills.push({ type: f.type, visible: f.visible !== false });
        }
      }
      return fills.length > 0 ? fills : null;
    }
    function extractStrokes(node) {
      if (!("strokes" in node) || !Array.isArray(node.strokes)) return null;
      var strokes = [];
      for (var i = 0; i < node.strokes.length; i++) {
        var s = node.strokes[i];
        if (s.type === "SOLID") {
          strokes.push({
            type: "SOLID",
            color: { r: s.color.r, g: s.color.g, b: s.color.b },
            opacity: s.opacity !== void 0 ? s.opacity : 1,
            visible: s.visible !== false,
            boundVariable: hasBoundVariable(node, "strokes")
          });
        } else {
          strokes.push({ type: s.type, visible: s.visible !== false });
        }
      }
      return strokes.length > 0 ? strokes : null;
    }
    function extractFont(node) {
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
          textAlignVertical: node.textAlignVertical
        };
      } catch (e) {
        return { fontSize: safeMixed(node.fontSize) };
      }
    }
    async function walkNode(node, depth, parentId) {
      if (depth > maxDepth) return;
      var entry = {
        id: node.id,
        name: node.name,
        type: node.type,
        parentId,
        bbox: { x: node.x, y: node.y, width: node.width, height: node.height },
        visible: node.visible !== false
      };
      var fills = extractFills(node);
      if (fills) entry.fills = fills;
      var strokes = extractStrokes(node);
      if (strokes) entry.strokes = strokes;
      if ("strokeWeight" in node && node.strokeWeight) entry.strokeWeight = safeMixed(node.strokeWeight);
      if ("cornerRadius" in node && node.cornerRadius !== void 0 && node.cornerRadius !== 0) {
        entry.cornerRadius = safeMixed(node.cornerRadius);
      }
      if ("layoutMode" in node && node.layoutMode && node.layoutMode !== "NONE") {
        entry.layoutMode = node.layoutMode;
        entry.itemSpacing = node.itemSpacing;
        entry.paddingTop = node.paddingTop;
        entry.paddingRight = node.paddingRight;
        entry.paddingBottom = node.paddingBottom;
        entry.paddingLeft = node.paddingLeft;
      }
      var font = extractFont(node);
      if (font) entry.font = font;
      if (node.type === "INSTANCE") {
        entry.isInstance = true;
        try {
          var mainComp = await node.getMainComponentAsync();
          if (mainComp) {
            entry.componentName = mainComp.name;
            entry.componentId = mainComp.id;
          }
        } catch (e) {
        }
      }
      results.push(entry);
      if ("children" in node && node.children) {
        for (var i = 0; i < node.children.length; i++) {
          await walkNode(node.children[i], depth + 1, node.id);
        }
      }
    }
    await walkNode(root, 0, null);
    return {
      rootId,
      totalNodes: results.length,
      nodes: results
    };
  }
  async function introspectNode(params) {
    var nodeId = params.nodeId;
    var maxDepth = params.maxDepth !== void 0 ? params.maxDepth : 20;
    var root = await figma.getNodeByIdAsync(nodeId);
    if (!root) {
      throw new Error("Node not found with ID: " + nodeId);
    }
    var properties = {};
    var wrapperFrameCount = 0;
    var nameCollisions = {};
    var treeDepth = 0;
    var componentName = null;
    var GENERIC_NAMES = /* @__PURE__ */ new Set([
      "Frame",
      "Group",
      "Rectangle",
      "Ellipse",
      "Vector",
      "Component",
      "Instance",
      "frame",
      "group",
      "rectangle",
      "ellipse",
      "vector"
    ]);
    function isGenericName(name) {
      if (GENERIC_NAMES.has(name)) return true;
      if (/^\d+$/.test(name)) return true;
      if (/^(Frame|Group|Rectangle|Ellipse|Vector|Component|Instance)\s+\d+$/i.test(name)) return true;
      return false;
    }
    async function resolveBoundVariableName(node, field) {
      try {
        var bindings = node.boundVariables;
        if (!bindings || !bindings[field]) return null;
        var binding = bindings[field];
        var varId = null;
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
    function buildSemanticKey(pathSegments) {
      var meaningful = [];
      for (var i = 0; i < pathSegments.length; i++) {
        if (!isGenericName(pathSegments[i])) {
          meaningful.push(pathSegments[i]);
        }
      }
      if (meaningful.length === 0) {
        meaningful = [pathSegments[pathSegments.length - 1] || "node"];
      }
      var start = Math.max(0, meaningful.length - 3);
      var parts = meaningful.slice(start);
      for (var i = 0; i < parts.length; i++) {
        parts[i] = parts[i].replace(/[^a-zA-Z0-9_ -]/g, "").replace(/\s+(.)/g, function(_, c) {
          return c.toUpperCase();
        }).replace(/^\s+/, "");
        if (parts[i].length === 0) parts[i] = "node";
      }
      return parts.join(".");
    }
    function addProperty(baseKey, propSuffix, propDef) {
      var key = propSuffix ? baseKey + "." + propSuffix : baseKey;
      if (properties[key]) {
        var baseName = baseKey.split(".").pop();
        nameCollisions[baseName] = (nameCollisions[baseName] || 1) + 1;
        key = key + "_" + nameCollisions[baseName];
      }
      properties[key] = propDef;
    }
    async function walkNode(node, depth, pathSegments) {
      if (depth > maxDepth) return;
      if (depth > treeDepth) treeDepth = depth;
      var currentPath = pathSegments.concat([node.name]);
      if (depth > 0 && isWrapperFrame(node)) {
        wrapperFrameCount++;
      }
      var baseKey = buildSemanticKey(currentPath);
      if (node.type === "TEXT") {
        var textExtra = { fontSize: null, fontFamily: null };
        try {
          if (node.fontSize !== figma.mixed) textExtra.fontSize = node.fontSize;
          if (node.fontName !== figma.mixed && typeof node.fontName === "object") {
            textExtra.fontFamily = node.fontName.family;
          }
        } catch (e) {
        }
        addProperty(baseKey, "text", {
          type: "text",
          value: node.characters,
          nodeId: node.id,
          fontSize: textExtra.fontSize,
          fontFamily: textExtra.fontFamily
        });
      }
      if (node.type === "INSTANCE") {
        try {
          var mainComp = await node.getMainComponentAsync();
          if (mainComp) {
            var variants = [];
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
              variants: variants.length > 0 ? variants : void 0
            });
          }
        } catch (e) {
        }
      }
      if ("fills" in node && Array.isArray(node.fills)) {
        for (var fi = 0; fi < node.fills.length; fi++) {
          var fill = node.fills[fi];
          if (fill.visible !== false && fill.type === "SOLID") {
            var fillBound = hasBoundVariable(node, "fills");
            var fillVarName = fillBound ? await resolveBoundVariableName(node, "fills") : null;
            var fillProp = {
              type: "color",
              value: rgbaToHex(fill.color),
              nodeId: node.id,
              target: "fill",
              boundVariable: fillBound
            };
            if (fillVarName) fillProp.boundVariableName = fillVarName;
            addProperty(baseKey, "fill", fillProp);
            break;
          }
        }
      }
      if ("strokes" in node && Array.isArray(node.strokes)) {
        for (var si = 0; si < node.strokes.length; si++) {
          var stroke = node.strokes[si];
          if (stroke.visible !== false && stroke.type === "SOLID") {
            var strokeBound = hasBoundVariable(node, "strokes");
            var strokeVarName = strokeBound ? await resolveBoundVariableName(node, "strokes") : null;
            var strokeProp = {
              type: "color",
              value: rgbaToHex(stroke.color),
              nodeId: node.id,
              target: "stroke",
              boundVariable: strokeBound
            };
            if (strokeVarName) strokeProp.boundVariableName = strokeVarName;
            addProperty(baseKey, "stroke", strokeProp);
            break;
          }
        }
      }
      if (depth > 0 && node.visible === false) {
        addProperty(baseKey, "visible", {
          type: "boolean",
          value: false,
          nodeId: node.id
        });
      }
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
              key: propName
            });
          }
        }
      }
      if ("children" in node && node.children) {
        for (var ci = 0; ci < node.children.length; ci++) {
          await walkNode(node.children[ci], depth + 1, currentPath);
        }
      }
    }
    if (root.type === "INSTANCE") {
      try {
        var mc = await root.getMainComponentAsync();
        if (mc) componentName = mc.name;
      } catch (e) {
      }
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
      nameCollisions,
      propertyCount,
      properties
    };
  }
  async function setProperties(params) {
    var nodeId = params.nodeId;
    var newValues = params.properties;
    var propertyMap = params.propertyMap;
    if (!propertyMap) {
      var introspection = await introspectNode({ nodeId });
      propertyMap = introspection.properties;
    }
    var results = [];
    var successCount = 0;
    var failureCount = 0;
    for (var key in newValues) {
      if (!newValues.hasOwnProperty(key)) continue;
      var newValue = newValues[key];
      var propDef = propertyMap[key];
      if (!propDef) {
        results.push({ key, success: false, error: "Property key not found in property map" });
        failureCount++;
        continue;
      }
      try {
        var targetNode = await figma.getNodeByIdAsync(propDef.nodeId);
        if (!targetNode) {
          throw new Error("Node not found: " + propDef.nodeId);
        }
        var oldValue = propDef.value;
        switch (propDef.type) {
          case "text":
            if (targetNode.type !== "TEXT") throw new Error("Node is not TEXT");
            await loadAllFonts(targetNode);
            await setCharacters(targetNode, String(newValue));
            results.push({ key, success: true, oldValue, newValue: String(newValue) });
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
                opacity: parsed.a !== void 0 ? parsed.a : 1
              }];
            } else {
              if (!("fills" in targetNode)) throw new Error("Node does not support fills");
              targetNode.fills = [{
                type: "SOLID",
                color: { r: parsed.r, g: parsed.g, b: parsed.b },
                opacity: parsed.a !== void 0 ? parsed.a : 1
              }];
            }
            results.push({ key, success: true, oldValue, newValue: hexColor });
            break;
          case "instance":
            if (targetNode.type !== "INSTANCE") throw new Error("Node is not an INSTANCE");
            var variantName = String(newValue);
            var mainComp = await targetNode.getMainComponentAsync();
            if (!mainComp) throw new Error("Could not get main component");
            var swapTarget = null;
            if (mainComp.parent && mainComp.parent.type === "COMPONENT_SET") {
              var siblings = mainComp.parent.children;
              for (var si = 0; si < siblings.length; si++) {
                if (siblings[si].type === "COMPONENT") {
                  if (siblings[si].name === variantName || siblings[si].name.indexOf(variantName) !== -1) {
                    swapTarget = siblings[si];
                    break;
                  }
                }
              }
            }
            if (!swapTarget) throw new Error("Variant not found: " + variantName);
            targetNode.swapComponent(swapTarget);
            results.push({ key, success: true, oldValue, newValue: variantName });
            break;
          case "boolean":
            targetNode.visible = !!newValue;
            results.push({ key, success: true, oldValue, newValue: !!newValue });
            break;
          case "component_property":
            if (targetNode.type !== "INSTANCE") throw new Error("Node is not an INSTANCE");
            var propKey = propDef.key;
            var propObj = {};
            propObj[propKey] = newValue;
            targetNode.setProperties(propObj);
            results.push({ key, success: true, oldValue, newValue });
            break;
          default:
            throw new Error("Unknown property type: " + propDef.type);
        }
        successCount++;
      } catch (e) {
        results.push({
          key,
          success: false,
          error: e.message || String(e)
        });
        failureCount++;
      }
    }
    return {
      nodeId,
      totalProperties: results.length,
      successCount,
      failureCount,
      results
    };
  }
  async function optimizeStructure(params) {
    var nodeId = params.nodeId;
    var options = params.options || {};
    var dryRun = options.dryRun !== false;
    var maxDepth = options.maxDepth !== void 0 ? options.maxDepth : 20;
    var doFlatten = options.flatten !== false;
    var doRename = options.rename !== false;
    var doExposeProperties = options.exposeProperties === true;
    options.extractComponents === true;
    var root = await figma.getNodeByIdAsync(nodeId);
    if (!root) {
      throw new Error("Node not found with ID: " + nodeId);
    }
    var changes = [];
    var appliedCount = 0;
    var wrappers = [];
    if (doFlatten) {
      async function findWrappers(node, depth) {
        if (depth > maxDepth) return;
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
        var childName = "children" in wrapper && wrapper.children.length > 0 ? wrapper.children[0].name : "unknown";
        changes.push({
          action: "flatten",
          nodeId: wrapper.id,
          nodeName: wrapper.name,
          description: "Remove wrapper, promote child '" + childName + "'"
        });
      }
    }
    var textNodesToRename = [];
    if (doRename) {
      async function findTextNodes2(node, depth) {
        if (depth > maxDepth) return;
        if (node.type === "TEXT" && !node.name.startsWith("_")) {
          textNodesToRename.push(node);
        }
        if ("children" in node && node.children) {
          for (var i = 0; i < node.children.length; i++) {
            await findTextNodes2(node.children[i], depth + 1);
          }
        }
      }
      await findTextNodes2(root, 0);
      for (var ti = 0; ti < textNodesToRename.length; ti++) {
        var textNode = textNodesToRename[ti];
        changes.push({
          action: "rename",
          nodeId: textNode.id,
          oldName: textNode.name,
          newName: "_" + textNode.name
        });
      }
    }
    if (doExposeProperties && (root.type === "COMPONENT" || root.type === "COMPONENT_SET")) {
      async function findExposeCandidates(node, depth) {
        if (depth > maxDepth) return;
        if (node.type === "TEXT") {
          changes.push({
            action: "expose_property",
            nodeId: node.id,
            nodeName: node.name,
            description: "TEXT node could be exposed as a component text property",
            propertyType: "TEXT"
          });
        }
        if (node.type === "INSTANCE") {
          changes.push({
            action: "expose_property",
            nodeId: node.id,
            nodeName: node.name,
            description: "INSTANCE node could be exposed as an instance-swap property",
            propertyType: "INSTANCE_SWAP"
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
    if (!dryRun) {
      if (doFlatten) {
        for (var ai = 0; ai < wrappers.length; ai++) {
          var w = wrappers[ai];
          try {
            if (w.removed) continue;
            if (!isWrapperFrame(w)) continue;
            var parent = w.parent;
            if (!parent || !("children" in parent)) continue;
            var child = w.children[0];
            var wrapperIndex = -1;
            for (var pi = 0; pi < parent.children.length; pi++) {
              if (parent.children[pi].id === w.id) {
                wrapperIndex = pi;
                break;
              }
            }
            if (wrapperIndex === -1) continue;
            child.x = child.x + w.x;
            child.y = child.y + w.y;
            parent.insertChild(wrapperIndex, child);
            w.remove();
            appliedCount++;
          } catch (e) {
          }
        }
      }
      if (doRename) {
        for (var ri = 0; ri < textNodesToRename.length; ri++) {
          try {
            var tn = textNodesToRename[ri];
            if (tn.removed) continue;
            tn.name = "_" + tn.name;
            appliedCount++;
          } catch (e) {
          }
        }
      }
    }
    return {
      nodeId,
      dryRun,
      totalChanges: changes.length,
      changes,
      appliedCount
    };
  }
  async function designQuery(params) {
    var select = params.select;
    var update = params.update;
    var limit = params.limit;
    var includeProperties = params.includeProperties === true;
    var rootNode;
    if (select.parentId) {
      rootNode = await figma.getNodeByIdAsync(select.parentId);
      if (!rootNode) throw new Error("Parent node not found: " + select.parentId);
    } else {
      rootNode = figma.currentPage;
    }
    var typeFilter = null;
    if (select.type) {
      if (Array.isArray(select.type)) {
        typeFilter = new Set(select.type);
      } else {
        typeFilter = /* @__PURE__ */ new Set([select.type]);
      }
    }
    var nameFilter = select.name || null;
    var nameRegex = null;
    if (select.nameRegex) {
      try {
        nameRegex = new RegExp(select.nameRegex);
      } catch (e) {
        throw new Error("Invalid regex pattern: " + e.message);
      }
    }
    var componentFilter = select.component || null;
    var whereFilter = select.where || null;
    var maxDepth = select.maxDepth || 100;
    if (!typeFilter && !nameFilter && !nameRegex && !componentFilter && !whereFilter && !select.parentId) {
      throw new Error("At least one selection filter is required to prevent unintended bulk operations");
    }
    var matches = [];
    var totalScanned = 0;
    var startTime = Date.now();
    var TIMEOUT_MS = 12e4;
    async function walkTree(node, depth) {
      if (depth > maxDepth) return;
      if (limit && matches.length >= limit) return;
      if (Date.now() - startTime > TIMEOUT_MS) return;
      totalScanned++;
      if (totalScanned % 50 === 0) {
        figma.ui.postMessage({
          type: "command_progress",
          status: "in_progress",
          message: "Scanned " + totalScanned + " nodes, " + matches.length + " matches so far..."
        });
        await new Promise(function(r) {
          setTimeout(r, 0);
        });
      }
      if (depth > 0 || !select.parentId) {
        var passed = true;
        if (passed && typeFilter) {
          if (!typeFilter.has(node.type)) passed = false;
        }
        if (passed && nameFilter) {
          if (!node.name || node.name.indexOf(nameFilter) === -1) passed = false;
        }
        if (passed && nameRegex) {
          if (!node.name || !nameRegex.test(node.name)) passed = false;
        }
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
      if ("children" in node && node.children) {
        for (var i = 0; i < node.children.length; i++) {
          if (limit && matches.length >= limit) break;
          await walkTree(node.children[i], depth + 1);
        }
      }
    }
    await walkTree(rootNode, 0);
    var results = [];
    var updatedCount = 0;
    var failedCount = 0;
    for (var mi = 0; mi < matches.length; mi++) {
      var matchNode = matches[mi];
      var resultEntry = {
        id: matchNode.id,
        name: matchNode.name,
        type: matchNode.type
      };
      if (includeProperties) {
        try {
          var introResult = await introspectNode({ nodeId: matchNode.id, maxDepth: 5 });
          resultEntry.properties = introResult.properties;
        } catch (e) {
          resultEntry.properties = { error: e.message || String(e) };
        }
      }
      if (update) {
        try {
          var setResult = await setProperties({
            nodeId: matchNode.id,
            properties: update
          });
          resultEntry.updateResult = {
            successCount: setResult.successCount,
            failureCount: setResult.failureCount
          };
          if (setResult.successCount > 0) updatedCount++;
          if (setResult.failureCount > 0) failedCount++;
        } catch (e) {
          resultEntry.updateResult = {
            successCount: 0,
            failureCount: 1,
            error: e.message || String(e)
          };
          failedCount++;
        }
      }
      results.push(resultEntry);
    }
    return {
      totalScanned,
      matched: matches.length,
      updated: update ? updatedCount : void 0,
      failed: update ? failedCount : void 0,
      results
    };
  }
  function safeSerialize(value, depth) {
    if (depth === void 0) depth = 0;
    if (depth > 20) return "[max depth]";
    if (value === null || value === void 0) return value;
    var t = typeof value;
    if (t === "string" || t === "number" || t === "boolean") return value;
    if (value.id && value.type && typeof value.remove === "function") {
      return { __nodeRef: true, id: value.id, name: value.name, type: value.type };
    }
    if (value instanceof Uint8Array) {
      return { __binary: true, length: value.length };
    }
    if (Array.isArray(value)) {
      return value.map(function(item) {
        return safeSerialize(item, depth + 1);
      });
    }
    if (t === "object") {
      var result = {};
      for (var key in value) {
        if (value.hasOwnProperty(key)) result[key] = safeSerialize(value[key], depth + 1);
      }
      return result;
    }
    return String(value);
  }
  async function figmaEval(params) {
    var AsyncFunction = Object.getPrototypeOf(async function() {
    }).constructor;
    var fn = new AsyncFunction(
      "figma",
      "hexToFigmaColor",
      "appendOrInsertChild",
      "loadAllFonts",
      "getVariableByName",
      "bindVariableToColor",
      "resolveColorValue",
      "sendProgressUpdate",
      "introspectNode",
      "setProperties",
      params.code
    );
    try {
      var rawResult = await fn(
        figma,
        hexToFigmaColor,
        appendOrInsertChild,
        loadAllFonts,
        getVariableByName,
        bindVariableToColor,
        resolveColorValue,
        sendProgressUpdate,
        introspectNode,
        setProperties
      );
      return { success: true, result: safeSerialize(rawResult) };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  }
  function autoMapProperties(sourceProps, targetProps, strategy) {
    if (!strategy) strategy = "auto";
    var mapping = {};
    var usedTargetKeys = {};
    var sourceKeys = Object.keys(sourceProps);
    var targetKeys = Object.keys(targetProps);
    function lastSegment(key) {
      var parts = key.split(".");
      return parts[parts.length - 1];
    }
    function propType(props, key) {
      return props[key] ? props[key].type : null;
    }
    function similarity(a, b) {
      a = a.toLowerCase();
      b = b.toLowerCase();
      if (a === b) return 1;
      if (a.length < 2 || b.length < 2) return 0;
      var aBigrams = {};
      var bBigrams = {};
      var aCount = 0;
      var bCount = 0;
      for (var i2 = 0; i2 < a.length - 1; i2++) {
        var bg = a.substring(i2, i2 + 2);
        aBigrams[bg] = (aBigrams[bg] || 0) + 1;
        aCount++;
      }
      for (var i2 = 0; i2 < b.length - 1; i2++) {
        var bg = b.substring(i2, i2 + 2);
        bBigrams[bg] = (bBigrams[bg] || 0) + 1;
        bCount++;
      }
      var intersection = 0;
      for (var bg in aBigrams) {
        if (bBigrams[bg]) {
          intersection += Math.min(aBigrams[bg], bBigrams[bg]);
        }
      }
      return 2 * intersection / (aCount + bCount);
    }
    function tryAssign(sourceKey, targetKey, confidence, matchType) {
      if (usedTargetKeys[targetKey]) return false;
      if (mapping[sourceKey]) return false;
      mapping[sourceKey] = {
        targetKey,
        confidence,
        matchType
      };
      usedTargetKeys[targetKey] = true;
      return true;
    }
    if (strategy === "auto" || strategy === "name") {
      for (var i = 0; i < sourceKeys.length; i++) {
        var sk = sourceKeys[i];
        if (targetProps[sk] && propType(sourceProps, sk) === propType(targetProps, sk)) {
          tryAssign(sk, sk, 1, "exact");
        }
      }
    }
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
    if (strategy === "auto" || strategy === "name") {
      for (var i = 0; i < sourceKeys.length; i++) {
        var sk = sourceKeys[i];
        if (mapping[sk]) continue;
        var sType = propType(sourceProps, sk);
        var bestScore = 0;
        var bestTarget = null;
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
    if (strategy === "auto" || strategy === "position") {
      var sourceByType = {};
      var targetByType = {};
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
  async function diffComponents(params) {
    var sourceId = params.sourceId;
    var targetId = params.targetId;
    var strategy = params.matchStrategy || "auto";
    var manualMappings = params.manualMappings;
    var sourceResult = await introspectNode({ nodeId: sourceId });
    var targetResult = await introspectNode({ nodeId: targetId });
    var mapping;
    if (strategy === "manual" && manualMappings) {
      mapping = {};
      for (var sk in manualMappings) {
        if (manualMappings.hasOwnProperty(sk)) {
          mapping[sk] = {
            targetKey: manualMappings[sk],
            confidence: 1,
            matchType: "manual"
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
              confidence: 1,
              matchType: "manual"
            };
          }
        }
      }
    }
    var mappedSourceKeys = {};
    var mappedTargetKeys = {};
    for (var sk in mapping) {
      if (mapping.hasOwnProperty(sk)) {
        mappedSourceKeys[sk] = true;
        mappedTargetKeys[mapping[sk].targetKey] = true;
      }
    }
    var unmappedSource = [];
    for (var sk in sourceResult.properties) {
      if (sourceResult.properties.hasOwnProperty(sk) && !mappedSourceKeys[sk]) {
        unmappedSource.push(sk);
      }
    }
    var unmappedTarget = [];
    for (var tk in targetResult.properties) {
      if (targetResult.properties.hasOwnProperty(tk) && !mappedTargetKeys[tk]) {
        unmappedTarget.push(tk);
      }
    }
    return {
      sourceComponent: sourceResult.component || sourceResult.name,
      targetComponent: targetResult.component || targetResult.name,
      mapping,
      unmappedSource,
      unmappedTarget,
      structuralChanges: {
        depthChange: {
          source: sourceResult.depth,
          target: targetResult.depth
        },
        wrapperFramesDelta: targetResult.wrapperFrames - sourceResult.wrapperFrames,
        sourcePropertyCount: sourceResult.propertyCount,
        targetPropertyCount: targetResult.propertyCount
      }
    };
  }
  async function migrateInstance(params) {
    var instanceId = params.instanceId;
    var targetComponentId = params.targetComponentId;
    var propertyMapping = params.propertyMapping;
    var preservePosition = params.preservePosition !== void 0 ? params.preservePosition : true;
    var preserveSize = params.preserveSize !== void 0 ? params.preserveSize : false;
    var dryRun = params.dryRun !== void 0 ? params.dryRun : false;
    var instance = await figma.getNodeByIdAsync(instanceId);
    if (!instance) throw new Error("Instance not found: " + instanceId);
    if (instance.type !== "INSTANCE") throw new Error("Node is not an INSTANCE: " + instanceId);
    var targetComponent = await figma.getNodeByIdAsync(targetComponentId);
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
    var sourceIntrospection = await introspectNode({ nodeId: instanceId });
    var sourceProps = sourceIntrospection.properties;
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
    var overridesToApply = {};
    var mappedCount = 0;
    var unmappedKeys = [];
    for (var sk in sourceProps) {
      if (!sourceProps.hasOwnProperty(sk)) continue;
      if (propertyMapping[sk]) {
        overridesToApply[propertyMapping[sk]] = sourceProps[sk].value;
        mappedCount++;
      } else {
        unmappedKeys.push(sk);
      }
    }
    var position = { x: instance.x, y: instance.y };
    var size = { width: instance.width, height: instance.height };
    var parentNode = instance.parent;
    var childIndex = parentNode ? Array.prototype.indexOf.call(parentNode.children, instance) : 0;
    if (dryRun) {
      return {
        dryRun: true,
        instanceId,
        instanceName: instance.name,
        targetComponent: targetComponent.name,
        position,
        size,
        overridesToApply,
        mappedCount,
        unmappedKeys
      };
    }
    var isNested = false;
    var checkParent = instance.parent;
    while (checkParent) {
      if (checkParent.type === "INSTANCE") {
        isNested = true;
        break;
      }
      checkParent = checkParent.parent;
    }
    var newInstanceId;
    var errorResults = [];
    if (isNested) {
      try {
        instance.swapComponent(targetComponent);
        newInstanceId = instance.id;
      } catch (e) {
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
    var applyResult = { successCount: 0, failureCount: 0, results: [] };
    if (Object.keys(overridesToApply).length > 0) {
      try {
        applyResult = await setProperties({
          nodeId: newInstanceId,
          properties: overridesToApply
        });
      } catch (e) {
        errorResults.push("Failed to apply overrides: " + (e.message || String(e)));
      }
    }
    return {
      success: true,
      instanceId: newInstanceId,
      targetComponent: targetComponent.name,
      isNested,
      mappedCount,
      unmappedKeys,
      overridesApplied: applyResult.successCount || 0,
      overridesFailed: applyResult.failureCount || 0,
      errors: errorResults.length > 0 ? errorResults : void 0
    };
  }
  async function batchMigrate(params) {
    var commandId = params.commandId || generateCommandId();
    var sourceComponentName = params.sourceComponentName;
    var sourceComponentId = params.sourceComponentId;
    var targetComponentId = params.targetComponentId;
    var propertyMapping = params.propertyMapping;
    var parentId = params.parentId;
    var limit = params.limit;
    var dryRun = params.dryRun !== void 0 ? params.dryRun : false;
    var searchRoot;
    if (parentId) {
      searchRoot = await figma.getNodeByIdAsync(parentId);
      if (!searchRoot) throw new Error("Parent node not found: " + parentId);
    } else {
      searchRoot = figma.currentPage;
    }
    var instances = [];
    async function findInstances(node) {
      if (limit && instances.length >= limit) return;
      if (node.type === "INSTANCE") {
        var match = false;
        var mainComp = null;
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
        for (var i2 = 0; i2 < node.children.length; i2++) {
          if (limit && instances.length >= limit) break;
          await findInstances(node.children[i2]);
        }
      }
    }
    await findInstances(searchRoot);
    if (dryRun) {
      var dryResults = [];
      for (var i = 0; i < instances.length; i++) {
        dryResults.push({
          instanceId: instances[i].id,
          instanceName: instances[i].name,
          success: true
        });
      }
      return {
        totalFound: instances.length,
        migrated: 0,
        failed: 0,
        dryRun: true,
        results: dryResults
      };
    }
    var results = [];
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
            Math.round(i / instances.length * 100),
            instances.length,
            i,
            "Migrating instance " + (i + 1) + " of " + instances.length + ": " + inst.name
          );
        }
        var result = await migrateInstance({
          instanceId: inst.id,
          targetComponentId,
          propertyMapping,
          preservePosition: true,
          preserveSize: false,
          dryRun: false
        });
        results.push({
          instanceId: result.instanceId,
          instanceName: inst.name,
          success: true,
          mappedCount: result.mappedCount,
          overridesApplied: result.overridesApplied
        });
        migratedCount++;
      } catch (e) {
        results.push({
          instanceId: inst.id,
          instanceName: inst.name,
          success: false,
          error: e.message || String(e)
        });
        failedCount++;
      }
    }
    return {
      totalFound: instances.length,
      migrated: migratedCount,
      failed: failedCount,
      dryRun: false,
      results
    };
  }

  // src/claude_figma_plugin/src/main.ts
  var state = {
    serverPort: 3055,
    // Default port
    firstOnTop: true,
    // Default auto-layout stacking: first child on top
    autoConnect: true
    // Auto-connect on plugin launch
  };
  figma.showUI(__html__, { width: 350, height: 600 });
  figma.ui.onmessage = async (msg) => {
    switch (msg.type) {
      case "update-settings":
        updateSettings(msg);
        break;
      case "notify":
        figma.notify(msg.message);
        break;
      case "close-plugin":
        figma.closePlugin();
        break;
      case "execute-command":
        try {
          const result = await handleCommand(msg.command, msg.params);
          figma.ui.postMessage({
            type: "command-result",
            id: msg.id,
            result
          });
        } catch (error) {
          figma.ui.postMessage({
            type: "command-error",
            id: msg.id,
            error: error.message || "Error executing command"
          });
        }
        break;
    }
  };
  figma.on("run", ({ command }) => {
    if (state.autoConnect) {
      figma.ui.postMessage({ type: "auto-connect" });
    }
  });
  function updateSettings(settings) {
    if (settings.serverPort) {
      state.serverPort = settings.serverPort;
    }
    if (settings.firstOnTop !== void 0) {
      state.firstOnTop = !!settings.firstOnTop;
    }
    if (settings.autoConnect !== void 0) {
      state.autoConnect = !!settings.autoConnect;
    }
    figma.clientStorage.setAsync("settings", {
      serverPort: state.serverPort,
      firstOnTop: state.firstOnTop,
      autoConnect: state.autoConnect
    });
  }
  async function handleCommand(command, params) {
    switch (command) {
      case "get_document_info":
        return await getDocumentInfo();
      case "get_selection":
        return await getSelection();
      case "get_node_info":
        if (!params || !params.nodeId) {
          throw new Error("Missing nodeId parameter");
        }
        return await getNodeInfo(params.nodeId);
      case "get_nodes_info":
        if (!params || !params.nodeIds || !Array.isArray(params.nodeIds)) {
          throw new Error("Missing or invalid nodeIds parameter");
        }
        return await getNodesInfo(params.nodeIds);
      case "read_my_design":
        return await readMyDesign();
      case "create_rectangle":
        return await createRectangle(params);
      case "create_frame":
        return await createFrame(params, state.firstOnTop);
      case "create_text":
        return await createText(params);
      case "set_fill_color":
        return await setFillColor(params);
      case "set_stroke_color":
        return await setStrokeColor(params);
      case "move_node":
        return await moveNode(params);
      case "resize_node":
        return await resizeNode(params);
      case "delete_node":
        return await deleteNode(params);
      case "delete_multiple_nodes":
        return await deleteMultipleNodes(params);
      case "get_styles":
        return await getStyles();
      case "get_local_components":
        return await getLocalComponents(params);
      case "create_component_instance":
        return await createComponentInstance(params);
      case "export_node_as_image":
        return await exportNodeAsImage(params);
      case "set_corner_radius":
        return await setCornerRadius(params);
      case "set_text_content":
        return await setTextContent(params);
      case "clone_node":
        return await cloneNode(params);
      case "scan_text_nodes":
        return await scanTextNodes(params);
      case "set_multiple_text_contents":
        return await setMultipleTextContents(params);
      case "get_annotations":
        return await getAnnotations(params);
      case "set_annotation":
        return await setAnnotation(params);
      case "scan_nodes_by_types":
        return await scanNodesByTypes(params);
      case "set_multiple_annotations":
        return await setMultipleAnnotations(params);
      case "get_instance_overrides":
        if (params && params.instanceNodeId) {
          const instanceNode = await figma.getNodeByIdAsync(params.instanceNodeId);
          if (!instanceNode) {
            throw new Error(`Instance node not found with ID: ${params.instanceNodeId}`);
          }
          return await getInstanceOverrides(instanceNode);
        }
        return await getInstanceOverrides();
      case "set_instance_overrides":
        if (params && params.targetNodeIds) {
          if (!Array.isArray(params.targetNodeIds)) {
            throw new Error("targetNodeIds must be an array");
          }
          const targetNodes = await getValidTargetInstances(params.targetNodeIds);
          if (!targetNodes.success) {
            figma.notify(targetNodes.message);
            return { success: false, message: targetNodes.message };
          }
          if (params.sourceInstanceId) {
            let sourceInstanceData = null;
            sourceInstanceData = await getSourceInstanceData(params.sourceInstanceId);
            if (!sourceInstanceData.success) {
              figma.notify(sourceInstanceData.message);
              return { success: false, message: sourceInstanceData.message };
            }
            return await setInstanceOverrides(targetNodes.targetInstances, sourceInstanceData);
          } else {
            throw new Error("Missing sourceInstanceId parameter");
          }
        } else {
          throw new Error("Missing required parameter: targetNodeIds");
        }
      case "swap_instance_variant":
        return await swapInstanceVariant(params);
      case "set_component_properties":
        return await setComponentProperties(params);
      case "set_layout_mode":
        return await setLayoutMode(params, state.firstOnTop);
      case "set_padding":
        return await setPadding(params);
      case "set_axis_align":
        return await setAxisAlign(params);
      case "set_layout_sizing":
        return await setLayoutSizing(params);
      case "set_item_spacing":
        return await setItemSpacing(params);
      case "get_reactions":
        if (!params || !params.nodeIds || !Array.isArray(params.nodeIds)) {
          throw new Error("Missing or invalid nodeIds parameter");
        }
        return await getReactions(params.nodeIds);
      case "set_default_connector":
        return await setDefaultConnector(params);
      case "create_connections":
        return await createConnections(params);
      case "set_focus":
        return await setFocus(params);
      case "set_selections":
        return await setSelections(params);
      case "set_font_family":
        return await setFontFamily(params);
      case "set_text_auto_resize":
        return await setTextAutoResize(params);
      case "insert_child_at":
        return await insertChildAt(params);
      case "reorder_child":
        return await reorderChild(params);
      case "create_component":
        return await createComponent(params);
      case "create_vector":
        return await createVector(params);
      case "create_svg":
        if (!params || !params.svg) {
          throw new Error("Missing required parameter: svg");
        }
        return await createSvg(params);
      case "set_stroke_dash":
        return await setStrokeDash(params);
      case "set_stroke_properties":
        return await setStrokeProperties(params);
      case "remove_fill":
        return await removeFill(params);
      case "create_section":
        return await createSection(params);
      case "set_text_decoration":
        return await setTextDecoration(params);
      case "create_node_tree":
        return await createNodeTree(params, state.firstOnTop);
      case "get_local_variables":
        return await getLocalVariables();
      case "create_line":
        return await createLine(params);
      case "rename_node":
        if (!params || !params.nodeId || !params.name) {
          throw new Error("Missing required parameters: nodeId and name");
        }
        return await renameNode(params);
      case "batch_rename":
        if (!params || !params.mappings || !Array.isArray(params.mappings)) {
          throw new Error("Missing or invalid mappings parameter");
        }
        return await batchRename(params);
      case "group_nodes":
        if (!params || !params.nodeIds || !Array.isArray(params.nodeIds)) {
          throw new Error("Missing or invalid nodeIds parameter");
        }
        return await groupNodes(params);
      case "batch_reparent":
        if (!params || !params.nodeIds || !Array.isArray(params.nodeIds) || !params.parentId) {
          throw new Error("Missing required parameters: nodeIds array and parentId");
        }
        return await batchReparent(params);
      case "batch_set_fill_color":
        if (!params || !params.nodeIds || !Array.isArray(params.nodeIds)) {
          throw new Error("Missing or invalid nodeIds parameter");
        }
        return await batchSetFillColor(params);
      case "batch_clone":
        if (!params || !params.sourceId || !params.positions || !Array.isArray(params.positions)) {
          throw new Error("Missing required parameters: sourceId and positions array");
        }
        return await batchClone(params);
      case "set_vector_path":
        if (!params || !params.nodeId || !params.pathData) {
          throw new Error("Missing required parameters: nodeId and pathData");
        }
        return await setVectorPath(params);
      case "get_vector_network":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await getVectorNetwork(params);
      case "set_vector_network":
        if (!params || !params.nodeId || !params.vertices || !params.segments) {
          throw new Error("Missing required parameters: nodeId, vertices, and segments");
        }
        return await setVectorNetwork(params);
      case "screenshot_region":
        if (params.x === void 0 || params.y === void 0 || !params.width || !params.height) {
          throw new Error("Missing required parameters: x, y, width, height");
        }
        return await screenshotRegion(params);
      case "batch_mutate":
        if (!params || !params.operations || !Array.isArray(params.operations)) {
          throw new Error("Missing required parameter: operations array");
        }
        return await batchMutate(params);
      case "set_text_align":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await setTextAlign(params);
      case "set_text_format":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await setTextFormat(params);
      case "set_text_list":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await setTextList(params);
      case "set_range_format":
        if (!params || !params.nodeId || !params.ranges) {
          throw new Error("Missing required parameters: nodeId and ranges");
        }
        return await setRangeFormat(params);
      case "set_clips_content":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await setClipsContent(params);
      case "set_effects":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await setEffects(params);
      case "set_opacity":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await setOpacity(params);
      case "set_blend_mode":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await setBlendMode(params);
      case "set_layout_positioning":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await setLayoutPositioning(params);
      case "set_rotation":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await setRotation(params);
      case "create_ellipse":
        return await createEllipse(params);
      case "set_constraints":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await setConstraints(params);
      case "set_min_max_size":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await setMinMaxSize(params);
      case "set_mask":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await setMask(params);
      case "create_component_set":
        if (!params || !params.componentIds || !Array.isArray(params.componentIds)) {
          throw new Error("Missing required parameter: componentIds array");
        }
        return await createComponentSet(params);
      case "scan_node_styles":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await scanNodeStyles(params);
      case "introspect_node":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await introspectNode(params);
      case "set_properties":
        if (!params || !params.nodeId || !params.properties) {
          throw new Error("Missing required parameters: nodeId and properties");
        }
        return await setProperties(params);
      case "optimize_structure":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await optimizeStructure(params);
      case "design_query":
        if (!params || !params.select) {
          throw new Error("Missing required parameter: select");
        }
        return await designQuery(params);
      case "figma_eval":
        if (!params || !params.code) {
          throw new Error("Missing required parameter: code");
        }
        return await figmaEval(params);
      case "diff_components":
        if (!params || !params.sourceId || !params.targetId) {
          throw new Error("Missing required parameters: sourceId and targetId");
        }
        return await diffComponents(params);
      case "migrate_instance":
        if (!params || !params.instanceId || !params.targetComponentId) {
          throw new Error("Missing required parameters: instanceId and targetComponentId");
        }
        return await migrateInstance(params);
      case "batch_migrate":
        if (!params || !params.targetComponentId) {
          throw new Error("Missing required parameter: targetComponentId");
        }
        if (!params.sourceComponentName && !params.sourceComponentId) {
          throw new Error("Missing required parameter: sourceComponentName or sourceComponentId");
        }
        return await batchMigrate(params);
      case "set_reactions":
        if (!params || !params.nodeId || !params.reactions) {
          throw new Error("Missing required parameters: nodeId and reactions");
        }
        return await setReactions(params);
      case "add_reaction":
        if (!params || !params.nodeId || !params.trigger || !params.action) {
          throw new Error("Missing required parameters: nodeId, trigger, and action");
        }
        return await addReaction(params);
      case "remove_reactions":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await removeReactions(params);
      case "get_interactions":
        if (!params || !params.nodeId) {
          throw new Error("Missing required parameter: nodeId");
        }
        return await getInteractions(params);
      case "batch_set_reactions":
        if (!params || !params.operations || !Array.isArray(params.operations)) {
          throw new Error("Missing or invalid operations parameter");
        }
        return await batchSetReactions(params);
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }
  (async function initializePlugin() {
    try {
      const savedSettings = await figma.clientStorage.getAsync("settings");
      if (savedSettings) {
        if (savedSettings.serverPort) {
          state.serverPort = savedSettings.serverPort;
        }
        if (savedSettings.firstOnTop !== void 0) {
          state.firstOnTop = !!savedSettings.firstOnTop;
        }
        if (savedSettings.autoConnect !== void 0) {
          state.autoConnect = !!savedSettings.autoConnect;
        }
      }
      figma.ui.postMessage({
        type: "init-settings",
        settings: {
          serverPort: state.serverPort,
          firstOnTop: state.firstOnTop,
          autoConnect: state.autoConnect
        }
      });
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  })();

})();
