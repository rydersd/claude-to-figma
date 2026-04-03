import { sendProgressUpdate, generateCommandId } from './utils';

// --- Prototyping / Reactions ---

export async function getReactions(nodeIds: any[]) {
  try {
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

    // Function to find nodes with reactions from the node and all its children
    async function findNodesWithReactions(node: any, processedNodes = new Set(), depth = 0, results: any[] = []) {
      // Skip already processed nodes (prevent circular references)
      if (processedNodes.has(node.id)) {
        return results;
      }

      processedNodes.add(node.id);

      // Check if the current node has reactions
      let filteredReactions: any[] = [];
      if (node.reactions && node.reactions.length > 0) {
        // Filter out reactions with navigation === 'CHANGE_TO'
        filteredReactions = node.reactions.filter((r: any) => {
          // Some reactions may have action or actions array
          if (r.action && r.action.navigation === 'CHANGE_TO') return false;
          if (Array.isArray(r.actions)) {
            // If any action in actions array is CHANGE_TO, exclude
            return !r.actions.some((a: any) => a.navigation === 'CHANGE_TO');
          }
          return true;
        });
      }
      const hasFilteredReactions = filteredReactions.length > 0;

      // If the node has filtered reactions, add it to results and apply highlight effect
      if (hasFilteredReactions) {
        results.push({
          id: node.id,
          name: node.name,
          type: node.type,
          depth: depth,
          hasReactions: true,
          reactions: filteredReactions,
          path: getNodePath(node)
        });
        // Apply highlight effect (orange border)
        await highlightNodeWithAnimation(node);
      }

      // If node has children, recursively search them
      if (node.children) {
        for (const child of node.children) {
          await findNodesWithReactions(child, processedNodes, depth + 1, results);
        }
      }

      return results;
    }

    // Function to apply animated highlight effect to a node
    async function highlightNodeWithAnimation(node: any) {
      // Save original stroke properties (guard against figma.mixed Symbol)
      const originalStrokeWeight = typeof node.strokeWeight === "number" ? node.strokeWeight : 1;
      const originalStrokes = (node.strokes && node.strokes !== figma.mixed) ? [...node.strokes] : [];

      try {
        // Apply orange border stroke
        node.strokeWeight = 4;
        node.strokes = [{
          type: 'SOLID',
          color: { r: 1, g: 0.5, b: 0 }, // Orange color
          opacity: 0.8
        }];

        // Set timeout for animation effect (restore to original after 1.5 seconds)
        setTimeout(() => {
          try {
            // Restore original stroke properties
            node.strokeWeight = originalStrokeWeight;
            node.strokes = originalStrokes;
          } catch (restoreError: any) {
            console.error(`Error restoring node stroke: ${restoreError.message}`);
          }
        }, 1500);
      } catch (highlightError: any) {
        console.error(`Error highlighting node: ${highlightError.message}`);
        // Continue even if highlighting fails
      }
    }

    // Get node hierarchy path as a string
    function getNodePath(node: any) {
      const path: string[] = [];
      let current = node;

      while (current && current.parent) {
        path.unshift(current.name);
        current = current.parent;
      }

      return path.join(' > ');
    }

    // Array to store all results
    let allResults: any[] = [];
    let processedCount = 0;
    const totalCount = nodeIds.length;

    // Iterate through each node and its children to search for reactions
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

        // Search for reactions in the node and its children
        const processedNodes = new Set();
        const nodeResults = await findNodesWithReactions(node, processedNodes);

        // Add results
        allResults = allResults.concat(nodeResults);

        // Update progress
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
      } catch (error: any) {
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

    // Completion update
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
  } catch (error: any) {
    throw new Error(`Failed to get reactions: ${error.message}`);
  }
}

// Build a Figma Reaction object from a spec trigger+action pair
export function buildReaction(trigger: any, action: any) {
  var reaction: any = { trigger: {}, actions: [] };

  // Trigger
  reaction.trigger.type = trigger.type;
  if (trigger.delay !== undefined) reaction.trigger.delay = trigger.delay;
  if (trigger.keyCodes) reaction.trigger.keyCodes = trigger.keyCodes;

  // Action
  var act: any;
  if (action.type === "NODE" && action.navigation) {
    act = {
      type: "NODE",
      navigation: action.navigation,
      destinationId: action.destinationId || null,
      preserveScrollPosition: action.preserveScrollPosition || false,
      resetScrollPosition: action.resetScrollPosition || false,
      resetInteractiveComponents: action.resetInteractiveComponents || false,
      resetVideoPosition: action.resetVideoPosition || false,
    };
    if (action.overlayRelativePosition) act.overlayRelativePosition = action.overlayRelativePosition;
    if (action.transition) {
      var dur = action.transition.duration !== undefined ? action.transition.duration : 0.3;
      if (dur > 10) dur = dur / 1000;
      act.transition = {
        type: action.transition.type,
        duration: dur,
        easing: action.transition.easing || { type: "EASE_IN_AND_OUT" },
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
    if (action.variableValue !== undefined) act.variableValue = action.variableValue;
  }

  reaction.actions = [act];
  return reaction;
}

// Build a full Figma Reaction from a spec reaction (trigger + actions array)
export function buildFullReaction(spec: any) {
  var reaction: any = { trigger: {}, actions: [] };

  reaction.trigger.type = spec.trigger.type;
  if (spec.trigger.delay !== undefined) reaction.trigger.delay = spec.trigger.delay;
  if (spec.trigger.keyCodes) reaction.trigger.keyCodes = spec.trigger.keyCodes;

  reaction.actions = (spec.actions || []).map(function(action: any) {
    if (action.type === "NODE" && action.navigation) {
      var act: any = {
        type: "NODE",
        navigation: action.navigation,
        destinationId: action.destinationId || null,
        preserveScrollPosition: action.preserveScrollPosition || false,
        resetScrollPosition: action.resetScrollPosition || false,
        resetInteractiveComponents: action.resetInteractiveComponents || false,
        resetVideoPosition: action.resetVideoPosition || false,
      };
      if (action.overlayRelativePosition) act.overlayRelativePosition = action.overlayRelativePosition;
      if (action.transition) {
        var dur = action.transition.duration !== undefined ? action.transition.duration : 0.3;
        // Convert ms to seconds if value looks like ms (>10)
        if (dur > 10) dur = dur / 1000;
        act.transition = {
          type: action.transition.type,
          duration: dur,
          easing: action.transition.easing || { type: "EASE_IN_AND_OUT" },
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
    // Non-NODE actions: BACK, CLOSE, URL, SET_VARIABLE, etc.
    var act: any = { type: action.type };
    if (action.url) act.url = action.url;
    if (action.variableId) act.variableId = action.variableId;
    if (action.variableValue !== undefined) act.variableValue = action.variableValue;
    return act;
  });

  return reaction;
}

// Helper: execute reactions code via dynamic function (same mechanism as figma_eval)
// This is needed because node.setReactionsAsync is only accessible via dynamic execution
export async function execReactionsCode(code: string) {
  var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  var fn = new AsyncFunction("figma", code);
  try {
    return await fn(figma);
  } catch (e: any) {
    throw new Error("in execReactionsCode: " + (e.message || String(e)));
  }
}

export async function setReactions(params: any) {
  var nodeId = params.nodeId;
  var reactions = params.reactions;
  var built = reactions.map(function(r: any) { return buildFullReaction(r); });
  var reactionsJson = JSON.stringify(built);

  var result = await execReactionsCode(
    'var node = await figma.getNodeByIdAsync("' + nodeId + '");' +
    'if (!node) throw new Error("Node not found: ' + nodeId + '");' +
    'var reactions = ' + reactionsJson + ';' +
    // Clear existing reactions first to avoid "Reaction was invalid" on replacement
    'await node.setReactionsAsync([]);' +
    'await node.setReactionsAsync(reactions);' +
    'return { success: true, nodeId: "' + nodeId + '", nodeName: node.name, reactionsSet: reactions.length };'
  );
  return result;
}

export async function addReaction(params: any) {
  var nodeId = params.nodeId;
  var node = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found: " + nodeId);

  var newReaction = buildReaction(params.trigger, params.action);
  var newReactionJson = JSON.stringify(newReaction);

  // Read existing + append inside dynamic context to avoid format round-trip
  var result = await execReactionsCode(
    'var node = await figma.getNodeByIdAsync("' + nodeId + '");' +
    'var existing = JSON.parse(JSON.stringify(node.reactions || []));' +
    'var newR = ' + newReactionJson + ';' +
    'existing.push(newR);' +
    'await node.setReactionsAsync(existing);' +
    'return existing.length;'
  );

  return {
    success: true,
    nodeId: nodeId,
    nodeName: (node as any).name,
    totalReactions: result || 1,
  };
}

export async function removeReactions(params: any) {
  var nodeId = params.nodeId;
  var triggerType = params.triggerType;

  var node = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found: " + nodeId);

  var filterCode = triggerType
    ? 'var updated = existing.filter(function(r) { return r.trigger && r.trigger.type !== "' + triggerType + '"; });'
    : 'var updated = [];';

  // Read, filter, and write inside dynamic context to avoid format round-trip
  var result: any = await execReactionsCode(
    'var node = await figma.getNodeByIdAsync("' + nodeId + '");' +
    'var existing = JSON.parse(JSON.stringify(node.reactions || []));' +
    'var before = existing.length;' +
    filterCode +
    'await node.setReactionsAsync(updated);' +
    'return { before: before, after: updated.length };'
  );

  var before = result ? result.before : 0;
  var after = result ? result.after : 0;

  return {
    success: true,
    nodeId: nodeId,
    nodeName: (node as any).name,
    removedCount: before - after,
    remainingCount: after,
    filter: triggerType || "ALL",
  };
}

export async function getInteractions(params: any) {
  var nodeId = params.nodeId;
  var recursive = params.recursive || false;

  var node = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found: " + nodeId);

  var interactions: any[] = [];

  async function extractInteractions(n: any) {
    var nodeReactions = n.reactions ? Array.from(n.reactions) : [];
    if (nodeReactions.length > 0) {
      for (var i = 0; i < nodeReactions.length; i++) {
        var reaction: any = nodeReactions[i];
        var actions = reaction.actions || (reaction.action ? [reaction.action] : []);
        var resolvedActions: any[] = [];

        for (var j = 0; j < actions.length; j++) {
          var act = actions[j];
          var resolved: any = {
            type: act.type,
            navigation: act.navigation || null,
            destinationId: act.destinationId || null,
            destinationName: null,
            transition: act.transition || null,
            url: act.url || null,
          };

          if (act.destinationId) {
            try {
              var destNode = await figma.getNodeByIdAsync(act.destinationId);
              if (destNode) resolved.destinationName = (destNode as any).name;
            } catch (e) { /* ignore */ }
          }

          resolvedActions.push(resolved);
        }

        interactions.push({
          nodeId: n.id,
          nodeName: n.name,
          nodeType: n.type,
          trigger: reaction.trigger ? reaction.trigger.type : "UNKNOWN",
          actions: resolvedActions,
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
    nodeId: nodeId,
    nodeName: (node as any).name,
    interactionCount: interactions.length,
    interactions: interactions,
  };
}

export async function batchSetReactions(params: any) {
  var operations = params.operations;
  var results: any[] = [];
  var successCount = 0;
  var errorCount = 0;

  for (var i = 0; i < operations.length; i++) {
    var op = operations[i];
    try {
      var built = op.reactions.map(function(r: any) { return buildFullReaction(r); });
      var reactionsJson = JSON.stringify(built);

      await execReactionsCode(
        'var node = await figma.getNodeByIdAsync("' + op.nodeId + '");' +
        'if (!node) throw new Error("Node not found: ' + op.nodeId + '");' +
        'var reactions = ' + reactionsJson + ';' +
        'await node.setReactionsAsync([]);' +
        'await node.setReactionsAsync(reactions);'
      );
      results.push({ nodeId: op.nodeId, success: true, reactionsSet: built.length });
      successCount++;
    } catch (err: any) {
      results.push({ nodeId: op.nodeId, success: false, error: err.message || String(err) });
      errorCount++;
    }
  }

  return {
    success: errorCount === 0,
    totalOperations: operations.length,
    successCount: successCount,
    errorCount: errorCount,
    results: results,
  };
}

// --- Connector / Connection tools ---

export async function setDefaultConnector(params: any) {
  const { connectorId } = params || {};

  // If connectorId is provided, search and set by that ID (do not check existing storage)
  if (connectorId) {
    // Get node by specified ID
    const node = await figma.getNodeByIdAsync(connectorId);
    if (!node) {
      throw new Error(`Connector node not found with ID: ${connectorId}`);
    }

    // Check node type
    if (node.type !== 'CONNECTOR') {
      throw new Error(`Node is not a connector: ${connectorId}`);
    }

    // Set the found connector as the default connector
    await figma.clientStorage.setAsync('defaultConnectorId', connectorId);

    return {
      success: true,
      message: `Default connector set to: ${connectorId}`,
      connectorId: connectorId
    };
  }
  // If connectorId is not provided, check existing storage
  else {
    // Check if there is an existing default connector in client storage
    try {
      const existingConnectorId = await figma.clientStorage.getAsync('defaultConnectorId');

      // If there is an existing connector ID, check if the node is still valid
      if (existingConnectorId) {
        try {
          const existingConnector = await figma.getNodeByIdAsync(existingConnectorId);

          // If the stored connector still exists and is of type CONNECTOR
          if (existingConnector && existingConnector.type === 'CONNECTOR') {
            return {
              success: true,
              message: `Default connector is already set to: ${existingConnectorId}`,
              connectorId: existingConnectorId,
              exists: true
            };
          }
          // The stored connector is no longer valid - find a new connector
          else {
            console.log(`Stored connector ID ${existingConnectorId} is no longer valid, finding a new connector...`);
          }
        } catch (error: any) {
          console.log(`Error finding stored connector: ${error.message}. Will try to set a new one.`);
        }
      }
    } catch (error: any) {
      console.log(`Error checking for existing connector: ${error.message}`);
    }

    // If there is no stored default connector or it is invalid, find one in the current page
    try {
      // Find CONNECTOR type nodes in the current page
      const currentPageConnectors = figma.currentPage.findAllWithCriteria({ types: ['CONNECTOR'] });

      if (currentPageConnectors && currentPageConnectors.length > 0) {
        // Use the first connector found
        const foundConnector = currentPageConnectors[0];
        const autoFoundId = foundConnector.id;

        // Set the found connector as the default connector
        await figma.clientStorage.setAsync('defaultConnectorId', autoFoundId);

        return {
          success: true,
          message: `Automatically found and set default connector to: ${autoFoundId}`,
          connectorId: autoFoundId,
          autoSelected: true
        };
      } else {
        // If no connector is found in the current page, show a guide message
        throw new Error('No connector found in the current page. Please create a connector in Figma first or specify a connector ID.');
      }
    } catch (error: any) {
      // Error occurred while running findAllWithCriteria
      throw new Error(`Failed to find a connector: ${error.message}`);
    }
  }
}

export async function createCursorNode(targetNodeId: string) {
  const svgString = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 8V35.2419L22 28.4315L27 39.7823C27 39.7823 28.3526 40.2722 29 39.7823C29.6474 39.2924 30.2913 38.3057 30 37.5121C28.6247 33.7654 25 26.1613 25 26.1613H32L16 8Z" fill="#202125" />
  </svg>`;
  try {
    const targetNode = await figma.getNodeByIdAsync(targetNodeId);
    if (!targetNode) throw new Error("Target node not found");

    // The targetNodeId has semicolons since it is a nested node.
    // So we need to get the parent node ID from the target node ID and check if we can appendChild to it or not.
    let parentNodeId = targetNodeId.includes(';')
      ? targetNodeId.split(';')[0]
      : targetNodeId;
    if (!parentNodeId) throw new Error("Could not determine parent node ID");

    // Find the parent node to append cursor node as child
    let parentNode: any = await figma.getNodeByIdAsync(parentNodeId);
    if (!parentNode) throw new Error("Parent node not found");

    // If the parent node is not eligible to appendChild, set the parentNode to the parent of the parentNode
    if (parentNode.type === 'INSTANCE' || parentNode.type === 'COMPONENT' || parentNode.type === 'COMPONENT_SET') {
      parentNode = parentNode.parent;
      if (!parentNode) throw new Error("Parent node not found");
    }

    // Create the cursor node
    const importedNode = await figma.createNodeFromSvg(svgString);
    if (!importedNode || !importedNode.id) {
      throw new Error("Failed to create imported cursor node");
    }
    importedNode.name = "TTF_Connector / Mouse Cursor";
    importedNode.resize(48, 48);

    const cursorNode = importedNode.findOne((node: any) => node.type === 'VECTOR');
    if (cursorNode) {
      cursorNode.fills = [{
        type: 'SOLID',
        color: { r: 0, g: 0, b: 0 },
        opacity: 1
      }];
      cursorNode.strokes = [{
        type: 'SOLID',
        color: { r: 1, g: 1, b: 1 },
        opacity: 1
      }];
      cursorNode.strokeWeight = 2;
      cursorNode.strokeAlign = 'OUTSIDE';
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

    // Append the cursor node to the parent node
    parentNode.appendChild(importedNode);

    // if the parentNode has auto-layout enabled, set the layoutPositioning to ABSOLUTE
    if ('layoutMode' in parentNode && parentNode.layoutMode !== 'NONE') {
      importedNode.layoutPositioning = 'ABSOLUTE';
    }

    // Adjust the importedNode's position to the targetNode's position
    if (
      (targetNode as any).absoluteBoundingBox &&
      parentNode.absoluteBoundingBox
    ) {
      // if the targetNode has absoluteBoundingBox, set the importedNode's absoluteBoundingBox to the targetNode's absoluteBoundingBox
      console.log('targetNode.absoluteBoundingBox', (targetNode as any).absoluteBoundingBox);
      console.log('parentNode.absoluteBoundingBox', parentNode.absoluteBoundingBox);
      importedNode.x = (targetNode as any).absoluteBoundingBox.x - parentNode.absoluteBoundingBox.x  + (targetNode as any).absoluteBoundingBox.width / 2 - 48 / 2
      importedNode.y = (targetNode as any).absoluteBoundingBox.y - parentNode.absoluteBoundingBox.y + (targetNode as any).absoluteBoundingBox.height / 2 - 48 / 2;
    } else if (
      'x' in targetNode && 'y' in targetNode && 'width' in targetNode && 'height' in targetNode) {
        // if the targetNode has x, y, width, height, calculate center based on relative position
        console.log('targetNode.x/y/width/height', (targetNode as any).x, (targetNode as any).y, (targetNode as any).width, (targetNode as any).height);
        importedNode.x = (targetNode as any).x + (targetNode as any).width / 2 - 48 / 2;
        importedNode.y = (targetNode as any).y + (targetNode as any).height / 2 - 48 / 2;
    } else {
      // Fallback: Place at top-left of target if possible, otherwise at (0,0) relative to parent
      if ('x' in targetNode && 'y' in targetNode) {
        console.log('Fallback to targetNode x/y');
        importedNode.x = (targetNode as any).x;
        importedNode.y = (targetNode as any).y;
      } else {
        console.log('Fallback to (0,0)');
        importedNode.x = 0;
        importedNode.y = 0;
      }
    }

    // get the importedNode ID and the importedNode
    console.log('importedNode', importedNode);


    return { id: importedNode.id, node: importedNode };

  } catch (error: any) {
    console.error("Error creating cursor from SVG:", error);
    return { id: null, node: null, error: error.message };
  }
}

export async function createConnections(params: any) {
  if (!params || !params.connections || !Array.isArray(params.connections)) {
    throw new Error('Missing or invalid connections parameter');
  }

  const { connections } = params;

  // Command ID for progress tracking
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

  // Get default connector ID from client storage
  const defaultConnectorId = await figma.clientStorage.getAsync('defaultConnectorId');
  if (!defaultConnectorId) {
    throw new Error('No default connector set. Please try one of the following options to create connections:\n1. Create a connector in FigJam and copy/paste it to your current page, then run the "set_default_connector" command.\n2. Select an existing connector on the current page, then run the "set_default_connector" command.');
  }

  // Get the default connector
  const defaultConnector: any = await figma.getNodeByIdAsync(defaultConnectorId);
  if (!defaultConnector) {
    throw new Error(`Default connector not found with ID: ${defaultConnectorId}`);
  }
  if (defaultConnector.type !== 'CONNECTOR') {
    throw new Error(`Node is not a connector: ${defaultConnectorId}`);
  }

  // Results array for connection creation
  const results: any[] = [];
  let processedCount = 0;
  const totalCount = connections.length;

  for (let i = 0; i < connections.length; i++) {
    try {
      const { startNodeId: originalStartId, endNodeId: originalEndId, text } = connections[i];
      let startId = originalStartId;
      let endId = originalEndId;

      // Check and potentially replace start node ID
      if (startId.includes(';')) {
        console.log(`Nested start node detected: ${startId}. Creating cursor node.`);
        const cursorResult = await createCursorNode(startId);
        if (!cursorResult || !cursorResult.id) {
          throw new Error(`Failed to create cursor node for nested start node: ${startId}`);
        }
        startId = cursorResult.id;
      }

      const startNode: any = await figma.getNodeByIdAsync(startId);
      if (!startNode) throw new Error(`Start node not found with ID: ${startId}`);

      // Check and potentially replace end node ID
      if (endId.includes(';')) {
        console.log(`Nested end node detected: ${endId}. Creating cursor node.`);
        const cursorResult = await createCursorNode(endId);
        if (!cursorResult || !cursorResult.id) {
          throw new Error(`Failed to create cursor node for nested end node: ${endId}`);
        }
        endId = cursorResult.id;
      }
      const endNode: any = await figma.getNodeByIdAsync(endId);
      if (!endNode) throw new Error(`End node not found with ID: ${endId}`);


      // Clone the default connector
      const clonedConnector: any = defaultConnector.clone();

      // Update connector name using potentially replaced node names
      clonedConnector.name = `TTF_Connector/${startNode.id}/${endNode.id}`;

      // Set start and end points using potentially replaced IDs
      clonedConnector.connectorStart = {
        endpointNodeId: startId,
        magnet: 'AUTO'
      };

      clonedConnector.connectorEnd = {
        endpointNodeId: endId,
        magnet: 'AUTO'
      };

      // Add text (if provided)
      if (text) {
        try {
          // Try to load the necessary fonts
          try {
            // First check if default connector has font and use the same
            if (defaultConnector.text && defaultConnector.text.fontName) {
              const fontName = defaultConnector.text.fontName;
              await figma.loadFontAsync(fontName);
              clonedConnector.text.fontName = fontName;
            } else {
              // Try default Inter font
              await figma.loadFontAsync({ family: "Inter", style: "Regular" });
            }
          } catch (fontError: any) {
            // If first font load fails, try another font style
            try {
              await figma.loadFontAsync({ family: "Inter", style: "Medium" });
            } catch (mediumFontError) {
              // If second font fails, try system font
              try {
                await figma.loadFontAsync({ family: "System", style: "Regular" });
              } catch (systemFontError) {
                // If all font loading attempts fail, throw error
                throw new Error(`Failed to load any font: ${fontError.message}`);
              }
            }
          }

          // Set the text
          clonedConnector.text.characters = text;
        } catch (textError: any) {
          console.error("Error setting text:", textError);
          // Continue with connection even if text setting fails
          results.push({
            id: clonedConnector.id,
            startNodeId: originalStartId,
            endNodeId: originalEndId,
            text: "",
            textError: textError.message
          });

          // Continue to next connection
          continue;
        }
      }

      // Add to results (using the *original* IDs for reference if needed)
      results.push({
        id: clonedConnector.id,
        originalStartNodeId: originalStartId,
        originalEndNodeId: originalEndId,
        usedStartNodeId: startId, // ID actually used for connection
        usedEndNodeId: endId,     // ID actually used for connection
        text: text || ""
      });

      // Update progress
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

    } catch (error: any) {
      console.error("Error creating connection", error);
      // Continue processing remaining connections even if an error occurs
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

  // Completion update
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

// Set focus on a specific node
export async function setFocus(params: any) {
  if (!params || !params.nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node: any = await figma.getNodeByIdAsync(params.nodeId);
  if (!node) {
    throw new Error(`Node with ID ${params.nodeId} not found`);
  }

  // Set selection to the node
  figma.currentPage.selection = [node];

  // Scroll and zoom to show the node in viewport
  figma.viewport.scrollAndZoomIntoView([node]);

  return {
    success: true,
    name: node.name,
    id: node.id,
    message: `Focused on node "${node.name}"`
  };
}

// Set selection to multiple nodes
export async function setSelections(params: any) {
  if (!params || !params.nodeIds || !Array.isArray(params.nodeIds)) {
    throw new Error("Missing or invalid nodeIds parameter");
  }

  if (params.nodeIds.length === 0) {
    throw new Error("nodeIds array cannot be empty");
  }

  // Get all valid nodes
  const nodes: any[] = [];
  const notFoundIds: string[] = [];

  for (const nodeId of params.nodeIds) {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (node) {
      nodes.push(node);
    } else {
      notFoundIds.push(nodeId);
    }
  }

  if (nodes.length === 0) {
    throw new Error(`No valid nodes found for the provided IDs: ${params.nodeIds.join(', ')}`);
  }

  // Set selection to the nodes
  figma.currentPage.selection = nodes;

  // Scroll and zoom to show all nodes in viewport
  figma.viewport.scrollAndZoomIntoView(nodes);

  const selectedNodes = nodes.map((node: any) => ({
    name: node.name,
    id: node.id
  }));

  return {
    success: true,
    count: nodes.length,
    selectedNodes: selectedNodes,
    notFoundIds: notFoundIds,
    message: `Selected ${nodes.length} nodes${notFoundIds.length > 0 ? ` (${notFoundIds.length} not found)` : ''}`
  };
}
