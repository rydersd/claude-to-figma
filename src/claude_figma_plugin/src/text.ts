// Text operations module for the Figma plugin.
// `figma` is a global provided by the Figma plugin runtime — do NOT import it.

import { sendProgressUpdate, generateCommandId, loadAllFonts, safeMixed } from './utils';
import { delay, hexToFigmaColor } from './utils';

// --- Set text content on a single text node ---
export async function setTextContent(params: any) {
  const { nodeId, text } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  if (text === undefined) {
    throw new Error("Missing text parameter");
  }

  const node: any = await figma.getNodeByIdAsync(nodeId);
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
      fontName: safeMixed(node.fontName),
    };
  } catch (error: any) {
    throw new Error(`Error setting text content: ${error.message}`);
  }
}

// --- Unique-by helper ---
export function uniqBy(arr: any, predicate: any) {
  const cb = typeof predicate === "function" ? predicate : (o: any) => o[predicate];
  return [
    ...arr
      .reduce((map: any, item: any) => {
        const key = item === null || item === undefined ? item : cb(item);

        map.has(key) || map.set(key, item);

        return map;
      }, new Map())
      .values(),
  ];
}

// --- Set characters on a text node with font handling ---
export const setCharacters = async (node: any, characters: any, options?: any) => {
  const fallbackFont = (options && options.fallbackFont) || {
    family: "Inter",
    style: "Regular",
  };
  try {
    if (node.fontName === figma.mixed) {
      if (options && options.smartStrategy === "prevail") {
        const fontHashTree: any = {};
        for (let i = 1; i < node.characters.length; i++) {
          const charFont = node.getRangeFontName(i - 1, i);
          const key = `${charFont.family}::${charFont.style}`;
          fontHashTree[key] = fontHashTree[key] ? fontHashTree[key] + 1 : 1;
        }
        const prevailedTreeItem = Object.entries(fontHashTree).sort(
          (a: any, b: any) => b[1] - a[1]
        )[0];
        const [family, style] = (prevailedTreeItem[0] as string).split("::");
        const prevailedFont = {
          family,
          style,
        };
        await figma.loadFontAsync(prevailedFont);
        node.fontName = prevailedFont;
      } else if (options && options.smartStrategy === "strict") {
        return setCharactersWithStrictMatchFont(node, characters, fallbackFont);
      } else if (options && options.smartStrategy === "experimental") {
        return setCharactersWithSmartMatchFont(node, characters, fallbackFont);
      } else {
        const firstCharFont = node.getRangeFontName(0, 1);
        await figma.loadFontAsync(firstCharFont);
        node.fontName = firstCharFont;
      }
    } else {
      await figma.loadFontAsync({
        family: node.fontName.family,
        style: node.fontName.style,
      });
    }
  } catch (err: any) {
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

// --- Strict match font replacement ---
export const setCharactersWithStrictMatchFont = async (
  node: any,
  characters: any,
  fallbackFont: any
) => {
  const fontHashTree: any = {};
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
    Object.keys(fontHashTree).map(async (range: any) => {
      console.log(range, fontHashTree[range]);
      const [start, end] = range.split("_");
      const [family, style] = fontHashTree[range].split("::");
      const matchedFont = {
        family,
        style,
      };
      await figma.loadFontAsync(matchedFont);
      return node.setRangeFontName(Number(start), Number(end), matchedFont);
    })
  );
  return true;
};

// --- Get delimiter positions in a string ---
export const getDelimiterPos = (str: any, delimiter: any, startIdx = 0, endIdx = str.length) => {
  const indices: any[] = [];
  let temp = startIdx;
  for (let i = startIdx; i < endIdx; i++) {
    if (
      str[i] === delimiter &&
      i + startIdx !== endIdx &&
      temp !== i + startIdx
    ) {
      indices.push([temp, i + startIdx]);
      temp = i + startIdx + 1;
    }
  }
  temp !== endIdx && indices.push([temp, endIdx]);
  return indices.filter(Boolean);
};

// --- Build linear font order from a text node ---
export const buildLinearOrder = (node: any) => {
  const fontTree: any[] = [];
  const newLinesPos = getDelimiterPos(node.characters, "\n");
  newLinesPos.forEach(([newLinesRangeStart, newLinesRangeEnd]: any, n: any) => {
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
      spacesPos.forEach(([spacesRangeStart, spacesRangeEnd]: any, s: any) => {
        const spacesRangeFont = node.getRangeFontName(
          spacesRangeStart,
          spacesRangeEnd
        );
        if (spacesRangeFont === figma.mixed) {
          const spacesRangeFont = node.getRangeFontName(
            spacesRangeStart,
            spacesRangeStart[0]
          );
          fontTree.push({
            start: spacesRangeStart,
            delimiter: " ",
            family: spacesRangeFont.family,
            style: spacesRangeFont.style,
          });
        } else {
          fontTree.push({
            start: spacesRangeStart,
            delimiter: " ",
            family: spacesRangeFont.family,
            style: spacesRangeFont.style,
          });
        }
      });
    } else {
      fontTree.push({
        start: newLinesRangeStart,
        delimiter: "\n",
        family: newLinesRangeFont.family,
        style: newLinesRangeFont.style,
      });
    }
  });
  return fontTree
    .sort((a: any, b: any) => +a.start - +b.start)
    .map(({ family, style, delimiter }: any) => ({ family, style, delimiter }));
};

// --- Smart match font replacement ---
export const setCharactersWithSmartMatchFont = async (
  node: any,
  characters: any,
  fallbackFont: any
) => {
  const rangeTree = buildLinearOrder(node);
  const fontsToLoad = uniqBy(
    rangeTree,
    ({ family, style }: any) => `${family}::${style}`
  ).map(({ family, style }: any) => ({
    family,
    style,
  }));

  await Promise.all([...fontsToLoad, fallbackFont].map(figma.loadFontAsync));

  node.fontName = fallbackFont;
  node.characters = characters;

  let prevPos = 0;
  rangeTree.forEach(({ family, style, delimiter }: any) => {
    if (prevPos < node.characters.length) {
      const delimeterPos = node.characters.indexOf(delimiter, prevPos);
      const endPos =
        delimeterPos > prevPos ? delimeterPos : node.characters.length;
      const matchedFont = {
        family,
        style,
      };
      node.setRangeFontName(prevPos, endPos, matchedFont);
      prevPos = endPos + 1;
    }
  });
  return true;
};

// --- Scan text nodes with chunked progress ---
export async function scanTextNodes(params: any) {
  console.log(`Starting to scan text nodes from node ID: ${params.nodeId}`);
  const {
    nodeId,
    useChunking = true,
    chunkSize = 10,
    commandId = generateCommandId(),
  } = params || {};

  const node: any = await figma.getNodeByIdAsync(nodeId);

  if (!node) {
    console.error(`Node with ID ${nodeId} not found`);
    // Send error progress update
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

  // If chunking is not enabled, use the original implementation
  if (!useChunking) {
    const textNodes: any[] = [];
    try {
      // Send started progress update
      sendProgressUpdate(
        commandId,
        "scan_text_nodes",
        "started",
        0,
        1, // Not known yet how many nodes there are
        0,
        `Starting scan of node "${node.name || nodeId}" without chunking`,
        null
      );

      await findTextNodes(node, [], 0, textNodes);

      // Send completed progress update
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
        textNodes: textNodes,
        commandId,
      };
    } catch (error: any) {
      console.error("Error scanning text nodes:", error);

      // Send error progress update
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

  // Chunked implementation
  console.log(`Using chunked scanning with chunk size: ${chunkSize}`);

  // First, collect all nodes to process (without processing them yet)
  const nodesToProcess: any[] = [];

  // Send started progress update
  sendProgressUpdate(
    commandId,
    "scan_text_nodes",
    "started",
    0,
    0, // Not known yet how many nodes there are
    0,
    `Starting chunked scan of node "${node.name || nodeId}"`,
    { chunkSize }
  );

  await collectNodesToProcess(node, [], 0, nodesToProcess);

  const totalNodes = nodesToProcess.length;
  console.log(`Found ${totalNodes} total nodes to process`);

  // Calculate number of chunks needed
  const totalChunks = Math.ceil(totalNodes / chunkSize);
  console.log(`Will process in ${totalChunks} chunks`);

  // Send update after node collection
  sendProgressUpdate(
    commandId,
    "scan_text_nodes",
    "in_progress",
    5, // 5% progress for collection phase
    totalNodes,
    0,
    `Found ${totalNodes} nodes to scan. Will process in ${totalChunks} chunks.`,
    {
      totalNodes,
      totalChunks,
      chunkSize,
    }
  );

  // Process nodes in chunks
  const allTextNodes: any[] = [];
  let processedNodes = 0;
  let chunksProcessed = 0;

  for (let i = 0; i < totalNodes; i += chunkSize) {
    const chunkEnd = Math.min(i + chunkSize, totalNodes);
    console.log(
      `Processing chunk ${chunksProcessed + 1}/${totalChunks} (nodes ${i} to ${chunkEnd - 1
      })`
    );

    // Send update before processing chunk
    sendProgressUpdate(
      commandId,
      "scan_text_nodes",
      "in_progress",
      Math.round(5 + (chunksProcessed / totalChunks) * 90), // 5-95% for processing
      totalNodes,
      processedNodes,
      `Processing chunk ${chunksProcessed + 1}/${totalChunks}`,
      {
        currentChunk: chunksProcessed + 1,
        totalChunks,
        textNodesFound: allTextNodes.length,
      }
    );

    const chunkNodes = nodesToProcess.slice(i, chunkEnd);
    const chunkTextNodes: any[] = [];

    // Process each node in this chunk
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
        } catch (error: any) {
          console.error(`Error processing text node: ${error.message}`);
          // Continue with other nodes
        }
      }

      // Brief delay to allow UI updates and prevent freezing
      await delay(5);
    }

    // Add results from this chunk
    allTextNodes.push(...chunkTextNodes);
    processedNodes += chunkNodes.length;
    chunksProcessed++;

    // Send update after processing chunk
    sendProgressUpdate(
      commandId,
      "scan_text_nodes",
      "in_progress",
      Math.round(5 + (chunksProcessed / totalChunks) * 90), // 5-95% for processing
      totalNodes,
      processedNodes,
      `Processed chunk ${chunksProcessed}/${totalChunks}. Found ${allTextNodes.length} text nodes so far.`,
      {
        currentChunk: chunksProcessed,
        totalChunks,
        processedNodes,
        textNodesFound: allTextNodes.length,
        chunkResult: chunkTextNodes,
      }
    );

    // Small delay between chunks to prevent UI freezing
    if (i + chunkSize < totalNodes) {
      await delay(50);
    }
  }

  // Send completed progress update
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
      chunks: chunksProcessed,
    }
  );

  return {
    success: true,
    message: `Chunked scan complete. Found ${allTextNodes.length} text nodes.`,
    totalNodes: allTextNodes.length,
    processedNodes: processedNodes,
    chunks: chunksProcessed,
    textNodes: allTextNodes,
    commandId,
  };
}

// Helper function to collect all nodes that need to be processed
export async function collectNodesToProcess(
  node: any,
  parentPath: any[] = [],
  depth = 0,
  nodesToProcess: any[] = []
) {
  // Skip invisible nodes
  if (node.visible === false) return;

  // Get the path to this node
  const nodePath = [...parentPath, node.name || `Unnamed ${node.type}`];

  // Add this node to the processing list
  nodesToProcess.push({
    node: node,
    parentPath: nodePath,
    depth: depth,
  });

  // Recursively add children
  if ("children" in node) {
    for (const child of node.children) {
      await collectNodesToProcess(child, nodePath, depth + 1, nodesToProcess);
    }
  }
}

// Process a single text node
export async function processTextNode(node: any, parentPath: any, depth: any) {
  if (node.type !== "TEXT") return null;

  try {
    // Safely extract font information
    let fontFamily = "";
    let fontStyle = "";

    if (node.fontName) {
      if (typeof node.fontName === "object") {
        if ("family" in node.fontName) fontFamily = node.fontName.family;
        if ("style" in node.fontName) fontStyle = node.fontName.style;
      }
    }

    // Create a safe representation of the text node
    const safeTextNode = {
      id: node.id,
      name: node.name || "Text",
      type: node.type,
      characters: node.characters,
      fontSize: typeof node.fontSize === "number" ? node.fontSize : 0,
      fontFamily: fontFamily,
      fontStyle: fontStyle,
      x: typeof node.x === "number" ? node.x : 0,
      y: typeof node.y === "number" ? node.y : 0,
      width: typeof node.width === "number" ? node.width : 0,
      height: typeof node.height === "number" ? node.height : 0,
      path: parentPath.join(" > "),
      depth: depth,
    };

    // Highlight the node briefly (optional visual feedback)
    try {
      const originalFills = node.fills !== figma.mixed ? JSON.parse(JSON.stringify(node.fills)) : [];
      node.fills = [
        {
          type: "SOLID",
          color: { r: 1, g: 0.5, b: 0 },
          opacity: 0.3,
        },
      ];

      // Brief delay for the highlight to be visible
      await delay(100);

      try {
        node.fills = originalFills;
      } catch (err) {
        console.error("Error resetting fills:", err);
      }
    } catch (highlightErr) {
      console.error("Error highlighting text node:", highlightErr);
      // Continue anyway, highlighting is just visual feedback
    }

    return safeTextNode;
  } catch (nodeErr) {
    console.error("Error processing text node:", nodeErr);
    return null;
  }
}

// --- Find text nodes recursively ---
export async function findTextNodes(node: any, parentPath: any[] = [], depth = 0, textNodes: any[] = []) {
  // Skip invisible nodes
  if (node.visible === false) return;

  // Get the path to this node including its name
  const nodePath = [...parentPath, node.name || `Unnamed ${node.type}`];

  if (node.type === "TEXT") {
    try {
      // Safely extract font information to avoid Symbol serialization issues
      let fontFamily = "";
      let fontStyle = "";

      if (node.fontName) {
        if (typeof node.fontName === "object") {
          if ("family" in node.fontName) fontFamily = node.fontName.family;
          if ("style" in node.fontName) fontStyle = node.fontName.style;
        }
      }

      // Create a safe representation of the text node with only serializable properties
      const safeTextNode = {
        id: node.id,
        name: node.name || "Text",
        type: node.type,
        characters: node.characters,
        fontSize: typeof node.fontSize === "number" ? node.fontSize : 0,
        fontFamily: fontFamily,
        fontStyle: fontStyle,
        x: typeof node.x === "number" ? node.x : 0,
        y: typeof node.y === "number" ? node.y : 0,
        width: typeof node.width === "number" ? node.width : 0,
        height: typeof node.height === "number" ? node.height : 0,
        path: nodePath.join(" > "),
        depth: depth,
      };

      // Only highlight the node if it's not being done via API
      try {
        // Safe way to create a temporary highlight without causing serialization issues
        const originalFills = node.fills !== figma.mixed ? JSON.parse(JSON.stringify(node.fills)) : [];
        node.fills = [
          {
            type: "SOLID",
            color: { r: 1, g: 0.5, b: 0 },
            opacity: 0.3,
          },
        ];

        // Promise-based delay instead of setTimeout
        await delay(500);

        try {
          node.fills = originalFills;
        } catch (err) {
          console.error("Error resetting fills:", err);
        }
      } catch (highlightErr) {
        console.error("Error highlighting text node:", highlightErr);
        // Continue anyway, highlighting is just visual feedback
      }

      textNodes.push(safeTextNode);
    } catch (nodeErr) {
      console.error("Error processing text node:", nodeErr);
      // Skip this node but continue with others
    }
  }

  // Recursively process children of container nodes
  if ("children" in node) {
    for (const child of node.children) {
      await findTextNodes(child, nodePath, depth + 1, textNodes);
    }
  }
}

// --- Replace text in multiple nodes ---
export async function setMultipleTextContents(params: any) {
  const { nodeId, text } = params || {};
  const commandId = params.commandId || generateCommandId();

  if (!nodeId || !text || !Array.isArray(text)) {
    const errorMsg = "Missing required parameters: nodeId and text array";

    // Send error progress update
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

  // Send started progress update
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

  // Define the results array and counters
  const results: any[] = [];
  let successCount = 0;
  let failureCount = 0;

  // Split text replacements into chunks of 5
  const CHUNK_SIZE = 5;
  const chunks: any[] = [];

  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }

  console.log(`Split ${text.length} replacements into ${chunks.length} chunks`);

  // Send chunking info update
  sendProgressUpdate(
    commandId,
    "set_multiple_text_contents",
    "in_progress",
    5, // 5% progress for planning phase
    text.length,
    0,
    `Preparing to replace text in ${text.length} nodes using ${chunks.length} chunks`,
    {
      totalReplacements: text.length,
      chunks: chunks.length,
      chunkSize: CHUNK_SIZE,
    }
  );

  // Process each chunk sequentially
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    console.log(
      `Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length
      } replacements`
    );

    // Send chunk processing start update
    sendProgressUpdate(
      commandId,
      "set_multiple_text_contents",
      "in_progress",
      Math.round(5 + (chunkIndex / chunks.length) * 90), // 5-95% for processing
      text.length,
      successCount + failureCount,
      `Processing text replacements chunk ${chunkIndex + 1}/${chunks.length}`,
      {
        currentChunk: chunkIndex + 1,
        totalChunks: chunks.length,
        successCount,
        failureCount,
      }
    );

    // Process replacements within a chunk in parallel
    const chunkPromises = chunk.map(async (replacement: any) => {
      if (!replacement.nodeId || replacement.text === undefined) {
        console.error(`Missing nodeId or text for replacement`);
        return {
          success: false,
          nodeId: replacement.nodeId || "unknown",
          error: "Missing nodeId or text in replacement entry",
        };
      }

      try {
        console.log(
          `Attempting to replace text in node: ${replacement.nodeId}`
        );

        // Get the text node to update (just to check it exists and get original text)
        const textNode: any = await figma.getNodeByIdAsync(replacement.nodeId);

        if (!textNode) {
          console.error(`Text node not found: ${replacement.nodeId}`);
          return {
            success: false,
            nodeId: replacement.nodeId,
            error: `Node not found: ${replacement.nodeId}`,
          };
        }

        if (textNode.type !== "TEXT") {
          console.error(
            `Node is not a text node: ${replacement.nodeId} (type: ${textNode.type})`
          );
          return {
            success: false,
            nodeId: replacement.nodeId,
            error: `Node is not a text node: ${replacement.nodeId} (type: ${textNode.type})`,
          };
        }

        // Save original text for the result
        const originalText = textNode.characters;
        console.log(`Original text: "${originalText}"`);
        console.log(`Will translate to: "${replacement.text}"`);

        // Highlight the node before changing text
        let originalFills: any;
        try {
          // Save original fills for restoration later
          originalFills = JSON.parse(JSON.stringify(textNode.fills));
          // Apply highlight color (orange with 30% opacity)
          textNode.fills = [
            {
              type: "SOLID",
              color: { r: 1, g: 0.5, b: 0 },
              opacity: 0.3,
            },
          ];
        } catch (highlightErr: any) {
          console.error(
            `Error highlighting text node: ${highlightErr.message}`
          );
          // Continue anyway, highlighting is just visual feedback
        }

        // Use the existing setTextContent function to handle font loading and text setting
        await setTextContent({
          nodeId: replacement.nodeId,
          text: replacement.text,
        });

        // Keep highlight for a moment after text change, then restore original fills
        if (originalFills) {
          try {
            // Use delay function for consistent timing
            await delay(500);
            textNode.fills = originalFills;
          } catch (restoreErr: any) {
            console.error(`Error restoring fills: ${restoreErr.message}`);
          }
        }

        console.log(
          `Successfully replaced text in node: ${replacement.nodeId}`
        );
        return {
          success: true,
          nodeId: replacement.nodeId,
          originalText: originalText,
          translatedText: replacement.text,
        };
      } catch (error: any) {
        console.error(
          `Error replacing text in node ${replacement.nodeId}: ${error.message}`
        );
        return {
          success: false,
          nodeId: replacement.nodeId,
          error: `Error applying replacement: ${error.message}`,
        };
      }
    });

    // Wait for all replacements in this chunk to complete
    const chunkResults = await Promise.all(chunkPromises);

    // Process results for this chunk
    chunkResults.forEach((result: any) => {
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
      results.push(result);
    });

    // Send chunk processing complete update with partial results
    sendProgressUpdate(
      commandId,
      "set_multiple_text_contents",
      "in_progress",
      Math.round(5 + ((chunkIndex + 1) / chunks.length) * 90), // 5-95% for processing
      text.length,
      successCount + failureCount,
      `Completed chunk ${chunkIndex + 1}/${chunks.length
      }. ${successCount} successful, ${failureCount} failed so far.`,
      {
        currentChunk: chunkIndex + 1,
        totalChunks: chunks.length,
        successCount,
        failureCount,
        chunkResults: chunkResults,
      }
    );

    // Add a small delay between chunks to avoid overloading Figma
    if (chunkIndex < chunks.length - 1) {
      console.log("Pausing between chunks to avoid overloading Figma...");
      await delay(1000); // 1 second delay between chunks
    }
  }

  console.log(
    `Replacement complete: ${successCount} successful, ${failureCount} failed`
  );

  // Send completed progress update
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
      results: results,
    }
  );

  return {
    success: successCount > 0,
    nodeId: nodeId,
    replacementsApplied: successCount,
    replacementsFailed: failureCount,
    totalReplacements: text.length,
    results: results,
    completedInChunks: chunks.length,
    commandId,
  };
}

// --- Set font family on a text node ---
export async function setFontFamily(params: any) {
  const { nodeId, fontFamily, fontStyle = "Regular" } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node: any = await figma.getNodeByIdAsync(nodeId);
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
    fontFamily: fontFamily,
    fontStyle: fontStyle,
  };
}

// Set Text Auto Resize
export async function setTextAutoResize(params: any) {
  const { nodeId, textAutoResize } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node: any = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  if (node.type !== "TEXT") {
    throw new Error(`Node is not a text node: ${nodeId}`);
  }

  // Load all fonts before changing auto-resize (required by Figma API)
  await loadAllFonts(node);
  node.textAutoResize = textAutoResize;

  return {
    id: node.id,
    name: node.name,
    textAutoResize: node.textAutoResize,
  };
}

// --- Set text decoration ---
export async function setTextDecoration(params: any) {
  const { nodeId, decoration } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node: any = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  if (node.type !== "TEXT") {
    throw new Error(`Node is not a text node: ${nodeId}`);
  }

  // Load all fonts (handles mixed font text)
  await loadAllFonts(node);
  node.textDecoration = decoration;

  return {
    id: node.id,
    name: node.name,
    textDecoration: node.textDecoration,
  };
}

// --- Set text alignment ---
export async function setTextAlign(params: any) {
  var nodeId = params.nodeId;
  var horizontal = params.horizontal;
  var vertical = params.vertical;

  var node: any = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found with ID: " + nodeId);
  if (node.type !== "TEXT") throw new Error("Node is not a TEXT node (type: " + node.type + ")");

  if (horizontal !== undefined) {
    var validH = ["LEFT", "CENTER", "RIGHT", "JUSTIFIED"];
    if (validH.indexOf(horizontal) === -1) throw new Error("Invalid horizontal alignment: " + horizontal + ". Must be one of: " + validH.join(", "));
    node.textAlignHorizontal = horizontal;
  }
  if (vertical !== undefined) {
    var validV = ["TOP", "CENTER", "BOTTOM"];
    if (validV.indexOf(vertical) === -1) throw new Error("Invalid vertical alignment: " + vertical + ". Must be one of: " + validV.join(", "));
    node.textAlignVertical = vertical;
  }

  return {
    id: node.id,
    name: node.name,
    textAlignHorizontal: node.textAlignHorizontal,
    textAlignVertical: node.textAlignVertical,
  };
}

// --- set_text_format: Set paragraph/node-level formatting on a text node ---
export async function setTextFormat(params: any) {
  var nodeId = params.nodeId;
  var node: any = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found with ID: " + nodeId);
  if (node.type !== "TEXT") throw new Error("Node is not a TEXT node (type: " + node.type + ")");

  // Load all fonts used in the text node
  await loadAllFonts(node);

  if (params.lineHeight !== undefined) {
    if (params.lineHeight === "AUTO") {
      node.lineHeight = { unit: "AUTO" };
    } else if (typeof params.lineHeight === "number") {
      node.lineHeight = { value: params.lineHeight, unit: "PIXELS" };
    } else if (params.lineHeight.value !== undefined && params.lineHeight.unit !== undefined) {
      node.lineHeight = params.lineHeight;
    }
  }
  if (params.paragraphIndent !== undefined) {
    node.paragraphIndent = params.paragraphIndent;
  }
  if (params.paragraphSpacing !== undefined) {
    node.paragraphSpacing = params.paragraphSpacing;
  }
  if (params.letterSpacing !== undefined) {
    if (typeof params.letterSpacing === "number") {
      node.letterSpacing = { value: params.letterSpacing, unit: "PIXELS" };
    } else if (params.letterSpacing.value !== undefined && params.letterSpacing.unit !== undefined) {
      node.letterSpacing = params.letterSpacing;
    }
  }
  if (params.textCase !== undefined) {
    node.textCase = params.textCase;
  }
  if (params.leadingTrim !== undefined) {
    node.leadingTrim = params.leadingTrim;
  }
  if (params.hangingPunctuation !== undefined) {
    node.hangingPunctuation = !!params.hangingPunctuation;
  }
  if (params.hangingList !== undefined) {
    node.hangingList = !!params.hangingList;
  }
  if (params.listSpacing !== undefined) {
    node.listSpacing = params.listSpacing;
  }
  if (params.textTruncation !== undefined) {
    node.textTruncation = params.textTruncation;
  }
  if (params.maxLines !== undefined) {
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
    maxLines: node.maxLines,
  };
}

// --- set_text_list: Set native list formatting on a text node ---
export async function setTextList(params: any) {
  var nodeId = params.nodeId;
  var node: any = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found with ID: " + nodeId);
  if (node.type !== "TEXT") throw new Error("Node is not a TEXT node (type: " + node.type + ")");

  await loadAllFonts(node);

  var lines = params.lines;
  var listType = params.listType || "UNORDERED";
  var start = 0;
  var end = node.characters.length;

  // If specific lines are provided, apply per-line
  if (lines && Array.isArray(lines)) {
    // Split text into lines to find character ranges
    var text = node.characters;
    var lineStarts: any[] = [0];
    for (var i = 0; i < text.length; i++) {
      if (text[i] === "\n") lineStarts.push(i + 1);
    }
    lineStarts.push(text.length); // sentinel

    for (var li = 0; li < lines.length; li++) {
      var lineSpec = lines[li];
      var lineIdx = lineSpec.line; // 0-based line index
      if (lineIdx < 0 || lineIdx >= lineStarts.length - 1) continue;

      var ls = lineStarts[lineIdx];
      var le = lineStarts[lineIdx + 1];
      // Don't include trailing newline in range
      if (le > ls && text[le - 1] === "\n") le--;
      if (le <= ls) continue;

      var lt = lineSpec.type || listType;
      node.setRangeListOptions(ls, le, { type: lt });

      if (lineSpec.indentation !== undefined) {
        node.setRangeIndentation(ls, le, lineSpec.indentation);
      }
    }
  } else {
    // Apply to entire text
    node.setRangeListOptions(start, end, { type: listType });
    if (params.indentation !== undefined) {
      node.setRangeIndentation(start, end, params.indentation);
    }
  }

  // Node-level list properties
  if (params.listSpacing !== undefined) {
    node.listSpacing = params.listSpacing;
  }
  if (params.hangingList !== undefined) {
    node.hangingList = !!params.hangingList;
  }

  return {
    id: node.id,
    name: node.name,
    characters: node.characters,
    listSpacing: node.listSpacing,
    hangingList: node.hangingList,
  };
}

// --- set_range_format: Per-range text formatting ---
export async function setRangeFormat(params: any) {
  var nodeId = params.nodeId;
  var node: any = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found with ID: " + nodeId);
  if (node.type !== "TEXT") throw new Error("Node is not a TEXT node (type: " + node.type + ")");

  await loadAllFonts(node);

  var ranges = params.ranges;
  if (!ranges || !Array.isArray(ranges) || ranges.length === 0) {
    throw new Error("Missing or empty ranges array");
  }

  var results: any[] = [];

  for (var ri = 0; ri < ranges.length; ri++) {
    var range = ranges[ri];
    var start = range.start;
    var end = range.end;

    if (start === undefined || end === undefined) {
      results.push({ index: ri, success: false, error: "Missing start or end" });
      continue;
    }
    if (start < 0 || end > node.characters.length || start >= end) {
      results.push({ index: ri, success: false, error: "Invalid range: start=" + start + " end=" + end + " length=" + node.characters.length });
      continue;
    }

    try {
      // Font family + style
      if (range.fontFamily !== undefined) {
        var fontStyle = range.fontStyle || "Regular";
        await figma.loadFontAsync({ family: range.fontFamily, style: fontStyle });
        node.setRangeFontName(start, end, { family: range.fontFamily, style: fontStyle });
      }

      // Font size
      if (range.fontSize !== undefined) {
        node.setRangeFontSize(start, end, range.fontSize);
      }

      // Text color (fills)
      if (range.color !== undefined) {
        var color: any = range.color;
        if (typeof color === "string") {
          color = hexToFigmaColor(color);
          if (!color) throw new Error("Invalid hex color");
        }
        node.setRangeFills(start, end, [{
          type: "SOLID",
          color: { r: color.r, g: color.g, b: color.b },
          opacity: color.a !== undefined ? color.a : 1,
        }]);
      }

      // Text case
      if (range.textCase !== undefined) {
        node.setRangeTextCase(start, end, range.textCase);
      }

      // Text decoration
      if (range.textDecoration !== undefined) {
        node.setRangeTextDecoration(start, end, range.textDecoration);
      }

      // Letter spacing
      if (range.letterSpacing !== undefined) {
        if (typeof range.letterSpacing === "number") {
          node.setRangeLetterSpacing(start, end, { value: range.letterSpacing, unit: "PIXELS" });
        } else {
          node.setRangeLetterSpacing(start, end, range.letterSpacing);
        }
      }

      // Line height
      if (range.lineHeight !== undefined) {
        if (range.lineHeight === "AUTO") {
          node.setRangeLineHeight(start, end, { unit: "AUTO" });
        } else if (typeof range.lineHeight === "number") {
          node.setRangeLineHeight(start, end, { value: range.lineHeight, unit: "PIXELS" });
        } else {
          node.setRangeLineHeight(start, end, range.lineHeight);
        }
      }

      // List options
      if (range.listType !== undefined) {
        node.setRangeListOptions(start, end, { type: range.listType });
      }

      // Indentation (for nested lists)
      if (range.indentation !== undefined) {
        node.setRangeIndentation(start, end, range.indentation);
      }

      // Hyperlink
      if (range.hyperlink !== undefined) {
        node.setRangeHyperlink(start, end, range.hyperlink);
      }

      results.push({ index: ri, success: true, start: start, end: end });
    } catch (e: any) {
      results.push({ index: ri, success: false, start: start, end: end, error: e.message || String(e) });
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
    successCount: successCount,
    failureCount: failureCount,
    results: results,
  };
}
