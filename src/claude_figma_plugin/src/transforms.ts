// Node transform operations: move, resize, delete, clone, rename, group, reparent, reorder.
// `figma` is a global provided by the Figma plugin runtime — do NOT import it.

import { sendProgressUpdate, generateCommandId, delay } from './utils';

export async function moveNode(params: any) {
  const { nodeId, x, y } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  if (x === undefined || y === undefined) {
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
    y: node.y,
  };
}

export async function resizeNode(params: any) {
  const { nodeId, width, height } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  if (width === undefined || height === undefined) {
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
    (node as any).resize(width, height);
  } else {
    (node as any).resizeWithoutConstraints(width, height);
  }

  return {
    id: node.id,
    name: node.name,
    width: (node as any).width,
    height: (node as any).height,
  };
}

export async function deleteNode(params: any) {
  const { nodeId } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  // Save node info before deleting
  const nodeInfo = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  node.remove();

  return nodeInfo;
}

export async function deleteMultipleNodes(params: any) {
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

  // Send started progress update
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

  const results: any[] = [];
  let successCount = 0;
  let failureCount = 0;

  // Process nodes in chunks of 5 to avoid overwhelming Figma
  const CHUNK_SIZE = 5;
  const chunks: any[] = [];

  for (let i = 0; i < nodeIds.length; i += CHUNK_SIZE) {
    chunks.push(nodeIds.slice(i, i + CHUNK_SIZE));
  }

  console.log(`Split ${nodeIds.length} deletions into ${chunks.length} chunks`);

  // Send chunking info update
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
      chunkSize: CHUNK_SIZE,
    }
  );

  // Process each chunk sequentially
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    console.log(
      `Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length
      } nodes`
    );

    // Send chunk processing start update
    sendProgressUpdate(
      commandId,
      "delete_multiple_nodes",
      "in_progress",
      Math.round(5 + (chunkIndex / chunks.length) * 90),
      nodeIds.length,
      successCount + failureCount,
      `Processing deletion chunk ${chunkIndex + 1}/${chunks.length}`,
      {
        currentChunk: chunkIndex + 1,
        totalChunks: chunks.length,
        successCount,
        failureCount,
      }
    );

    // Process deletions within a chunk in parallel
    const chunkPromises = chunk.map(async (nodeId: any) => {
      try {
        const node = await figma.getNodeByIdAsync(nodeId);

        if (!node) {
          console.error(`Node not found: ${nodeId}`);
          return {
            success: false,
            nodeId: nodeId,
            error: `Node not found: ${nodeId}`,
          };
        }

        // Save node info before deleting
        const nodeInfo = {
          id: node.id,
          name: node.name,
          type: node.type,
        };

        // Delete the node
        node.remove();

        console.log(`Successfully deleted node: ${nodeId}`);
        return {
          success: true,
          nodeId: nodeId,
          nodeInfo: nodeInfo,
        };
      } catch (error: any) {
        console.error(`Error deleting node ${nodeId}: ${error.message}`);
        return {
          success: false,
          nodeId: nodeId,
          error: error.message,
        };
      }
    });

    // Wait for all deletions in this chunk to complete
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

    // Send chunk processing complete update
    sendProgressUpdate(
      commandId,
      "delete_multiple_nodes",
      "in_progress",
      Math.round(5 + ((chunkIndex + 1) / chunks.length) * 90),
      nodeIds.length,
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

    // Add a small delay between chunks
    if (chunkIndex < chunks.length - 1) {
      console.log("Pausing between chunks...");
      await delay(1000);
    }
  }

  console.log(
    `Deletion complete: ${successCount} successful, ${failureCount} failed`
  );

  // Send completed progress update
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
      results: results,
    }
  );

  return {
    success: successCount > 0,
    nodesDeleted: successCount,
    nodesFailed: failureCount,
    totalNodes: nodeIds.length,
    results: results,
    completedInChunks: chunks.length,
    commandId,
  };
}

export async function cloneNode(params: any) {
  const { nodeId, x, y, parentId } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  // Clone the node
  const clone = node.clone();

  // If x and y are provided, move the clone to that position
  if (x !== undefined && y !== undefined) {
    if (!("x" in clone) || !("y" in clone)) {
      throw new Error(`Cloned node does not support position: ${nodeId}`);
    }
    (clone as any).x = x;
    (clone as any).y = y;
  }

  // Determine where to place the clone
  // If parentId is explicitly provided, use that
  // Otherwise try the source's parent — but if it's inside an instance, fall back to the page
  if (parentId) {
    const targetParent = await figma.getNodeByIdAsync(parentId);
    if (!targetParent) {
      throw new Error(`Parent node not found with ID: ${parentId}`);
    }
    if (!("appendChild" in targetParent)) {
      throw new Error(`Parent node does not support children: ${parentId}`);
    }
    (targetParent as any).appendChild(clone);
  } else {
    // Check if source parent is safe to clone into (not inside an instance)
    let safeParent: any = node.parent;
    if (safeParent) {
      let ancestor: any = safeParent;
      while (ancestor) {
        if (ancestor.type === "INSTANCE") {
          safeParent = null; // Can't place inside an instance
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
    x: "x" in clone ? (clone as any).x : undefined,
    y: "y" in clone ? (clone as any).y : undefined,
    width: "width" in clone ? (clone as any).width : undefined,
    height: "height" in clone ? (clone as any).height : undefined,
  };
}

export async function batchClone(params: any) {
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

  const parent: any = node.parent || figma.currentPage;
  const clones: any[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < positions.length; i++) {
    try {
      const clone = node.clone();
      const pos = positions[i];

      if ("x" in clone && "y" in clone) {
        (clone as any).x = pos.x;
        (clone as any).y = pos.y;
      }

      if (names && names[i]) {
        clone.name = names[i];
      }

      parent.appendChild(clone);

      clones.push({
        id: clone.id,
        name: clone.name,
        x: "x" in clone ? (clone as any).x : undefined,
        y: "y" in clone ? (clone as any).y : undefined,
      });
      successCount++;
    } catch (error: any) {
      clones.push({
        id: null,
        name: names ? names[i] : null,
        x: positions[i].x,
        y: positions[i].y,
        error: error instanceof Error ? error.message : String(error),
      });
      failureCount++;
    }

    if (useProgress && (i + 1) % 5 === 0) {
      const progress = Math.round(((i + 1) / totalItems) * 100);
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
    totalItems,
  };
}

export async function renameNode(params: any) {
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
    oldName: oldName,
    newName: node.name,
  };
}

export async function batchRename(params: any) {
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

  const results: any[] = [];
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
        oldName: oldName,
        newName: node.name,
      });
    } catch (err: any) {
      failureCount++;
      results.push({
        success: false,
        nodeId: mapping.nodeId,
        error: err.message || String(err),
      });
    }

    if (useProgress && (i + 1) % 5 === 0) {
      const progress = Math.round(((i + 1) / mappings.length) * 100);
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
    successCount: successCount,
    failureCount: failureCount,
    results: results,
  };
}

// Group Nodes
export async function groupNodes(params: any) {
  const { nodeIds, name } = params || {};

  if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
    throw new Error("Missing or empty nodeIds array");
  }

  const nodes: any[] = [];
  for (const id of nodeIds) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node) {
      throw new Error(`Node not found with ID: ${id}`);
    }
    nodes.push(node);
  }

  // Validate all nodes share the same parent
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
    childrenCount: group.children.length,
  };
}

// Batch Reparent
export async function batchReparent(params: any) {
  const { nodeIds, parentId, index } = params || {};
  const commandId = params.commandId || generateCommandId();

  if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
    throw new Error("Missing or empty nodeIds array");
  }
  if (!parentId) {
    throw new Error("Missing parentId parameter");
  }

  const parentNode: any = await figma.getNodeByIdAsync(parentId);
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

  const results: any[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < nodeIds.length; i++) {
    const nodeId = nodeIds[i];

    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`);
      }

      if (index !== undefined && index !== null) {
        parentNode.insertChild(index + i, node);
      } else {
        parentNode.appendChild(node);
      }

      successCount++;
      results.push({
        success: true,
        nodeId: nodeId,
        nodeName: node.name,
      });
    } catch (err: any) {
      failureCount++;
      results.push({
        success: false,
        nodeId: nodeId,
        error: err.message || String(err),
      });
    }

    if (useProgress && (i + 1) % 5 === 0) {
      const progress = Math.round(((i + 1) / nodeIds.length) * 100);
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
    successCount: successCount,
    failureCount: failureCount,
    parentName: parentNode.name,
    results: results,
  };
}

export async function insertChildAt(params: any) {
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

  (parentNode as any).insertChild(index, childNode);

  return {
    parentName: parentNode.name,
    childName: childNode.name,
    index: index,
  };
}

// Reorder Child
export async function reorderChild(params: any) {
  const { childId, index } = params || {};

  if (!childId) {
    throw new Error("Missing childId parameter");
  }

  const childNode = await figma.getNodeByIdAsync(childId);
  if (!childNode) {
    throw new Error(`Child node not found with ID: ${childId}`);
  }

  const parentNode: any = childNode.parent;
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
    index: index,
  };
}

export async function setLayoutPositioning(params: any) {
  var nodeId = params.nodeId;
  var node: any = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error("Node not found with ID: " + nodeId);
  if (!("layoutPositioning" in node)) throw new Error("Node does not support layoutPositioning (type: " + node.type + ")");

  node.layoutPositioning = params.positioning;

  // If setting to ABSOLUTE, also set x/y constraints if provided
  if (params.positioning === "ABSOLUTE" && params.constraints) {
    if ("constraints" in node) {
      var c = params.constraints;
      node.constraints = {
        horizontal: c.horizontal || "MIN",
        vertical: c.vertical || "MIN",
      };
    }
  }

  return {
    id: node.id,
    name: node.name,
    layoutPositioning: node.layoutPositioning,
    constraints: "constraints" in node ? node.constraints : undefined,
  };
}
