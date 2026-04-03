import { sendProgressUpdate, generateCommandId, customBase64Encode, appendOrInsertChild, loadAllFonts } from './utils';
import { setCharacters } from './text';

export async function getStyles() {
  const styles = {
    colors: await figma.getLocalPaintStylesAsync(),
    texts: await figma.getLocalTextStylesAsync(),
    effects: await figma.getLocalEffectStylesAsync(),
    grids: await figma.getLocalGridStylesAsync(),
  };

  return {
    colors: styles.colors.map((style: any) => ({
      id: style.id,
      name: style.name,
      key: style.key,
      paint: style.paints[0],
    })),
    texts: styles.texts.map((style: any) => ({
      id: style.id,
      name: style.name,
      key: style.key,
      fontSize: style.fontSize,
      fontName: style.fontName,
    })),
    effects: styles.effects.map((style: any) => ({
      id: style.id,
      name: style.name,
      key: style.key,
    })),
    grids: styles.grids.map((style: any) => ({
      id: style.id,
      name: style.name,
      key: style.key,
    })),
  };
}

export async function getLocalComponents(params: any) {
  const commandId = (params && params.commandId) || generateCommandId();
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

  var allComponents: any[] = [];

  for (var i = 0; i < totalPages; i++) {
    var page = pages[i];
    await page.loadAsync();

    var pageComponents = page.findAllWithCriteria({ types: ["COMPONENT"] });

    for (var j = 0; j < pageComponents.length; j++) {
      var component = pageComponents[j];
      allComponents.push({
        id: component.id,
        name: component.name,
        key: "key" in component ? (component as any).key : null,
      });
    }

    var progress = Math.round(((i + 1) / totalPages) * 100);
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
    components: allComponents,
  };
}

export async function createComponentInstance(params: any) {
  const { componentKey, componentId, x = 0, y = 0, parentId } = params || {};

  if (!componentKey && !componentId) {
    throw new Error("Missing componentKey or componentId parameter. Use componentId for local components (from get_local_components), or componentKey for published library components.");
  }

  try {
    let component: any;

    if (componentId) {
      // Local component: get node directly by ID
      const node = await figma.getNodeByIdAsync(componentId);
      if (!node) {
        throw new Error(`Component node not found with id: ${componentId}`);
      }
      if (node.type !== "COMPONENT") {
        throw new Error(`Node ${componentId} is not a COMPONENT (got type: ${node.type}). Use get_local_components to find valid component IDs.`);
      }
      component = node;
    } else {
      // Published library component: import by key
      component = await figma.importComponentByKeyAsync(componentKey);
    }

    const instance = component.createInstance();
    instance.x = x;
    instance.y = y;

    await appendOrInsertChild(instance, parentId, params.insertAt);

    // Apply component property overrides if provided
    if (params.properties && typeof params.properties === "object") {
      try {
        instance.setProperties(params.properties);
      } catch (e) {
        // Non-fatal — instance is created, overrides just failed
        console.error("Error setting component properties:", e);
      }
    }

    // Apply text overrides by child name if provided
    if (params.textOverrides && typeof params.textOverrides === "object") {
      async function applyTextOverrides(node: any, overrides: any) {
        if (node.type === "TEXT" && overrides[node.name] !== undefined) {
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
      mainComponentId: mainComponent ? mainComponent.id : undefined,
    };
  } catch (error: any) {
    throw new Error(`Error creating component instance: ${error.message}`);
  }
}

export async function swapInstanceVariant(params: any) {
  const { nodeId, componentKey } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }
  if (!componentKey) {
    throw new Error("Missing componentKey parameter");
  }

  try {
    const instanceNode: any = await figma.getNodeByIdAsync(nodeId);
    if (!instanceNode) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    if (instanceNode.type !== "INSTANCE") {
      throw new Error(`Node ${nodeId} is not an INSTANCE (got type: ${instanceNode.type}). Only INSTANCE nodes can be swapped.`);
    }

    const targetComponent: any = await figma.getNodeByIdAsync(componentKey);
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
      mainComponentId: mainComponent ? mainComponent.id : undefined,
      width: instanceNode.width,
      height: instanceNode.height,
    };
  } catch (error: any) {
    throw new Error(`Error swapping instance variant: ${error.message}`);
  }
}

export async function setComponentProperties(params: any) {
  const { nodeId, properties } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }
  if (!properties || typeof properties !== "object") {
    throw new Error("Missing or invalid properties parameter. Must be an object of key-value pairs.");
  }

  try {
    const node: any = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    if (node.type !== "INSTANCE") {
      throw new Error(`Node ${nodeId} is not an INSTANCE (got type: ${node.type}). Only INSTANCE nodes have component properties.`);
    }

    node.setProperties(properties);

    // Read back the current properties after the update
    const currentProperties = node.componentProperties;

    return {
      success: true,
      instanceId: node.id,
      instanceName: node.name,
      componentProperties: currentProperties,
    };
  } catch (error: any) {
    throw new Error(`Error setting component properties: ${error.message}`);
  }
}

export async function exportNodeAsImage(params: any) {
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
    const settings: any = {
      format: format,
      constraint: { type: "SCALE", value: scale },
    };

    const bytes = await (node as any).exportAsync(settings);

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

    // Proper way to convert Uint8Array to base64
    const base64 = customBase64Encode(bytes);
    // const imageData = `data:${mimeType};base64,${base64}`;

    return {
      nodeId,
      format,
      scale,
      mimeType,
      imageData: base64,
    };
  } catch (error: any) {
    throw new Error(`Error exporting node as image: ${error.message}`);
  }
}

export async function createComponent(params: any) {
  const { nodeId } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node: any = await figma.getNodeByIdAsync(nodeId);
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

  // Copy properties
  if (node.fills && node.fills !== figma.mixed) {
    component.fills = JSON.parse(JSON.stringify(node.fills));
  }
  if (node.strokes && node.strokes !== figma.mixed) {
    component.strokes = JSON.parse(JSON.stringify(node.strokes));
  }
  if (node.strokeWeight !== undefined && node.strokeWeight !== figma.mixed) {
    component.strokeWeight = node.strokeWeight;
  }
  if (node.cornerRadius !== undefined && node.cornerRadius !== figma.mixed) {
    component.cornerRadius = node.cornerRadius;
  }
  if (node.layoutMode) {
    component.layoutMode = node.layoutMode;
    if (node.itemReverseZIndex !== undefined) {
      component.itemReverseZIndex = node.itemReverseZIndex;
    }
  }
  if (node.paddingTop !== undefined) {
    component.paddingTop = node.paddingTop;
    component.paddingRight = node.paddingRight;
    component.paddingBottom = node.paddingBottom;
    component.paddingLeft = node.paddingLeft;
  }
  if (node.itemSpacing !== undefined) {
    component.itemSpacing = node.itemSpacing;
  }
  if (node.primaryAxisAlignItems) {
    component.primaryAxisAlignItems = node.primaryAxisAlignItems;
  }
  if (node.counterAxisAlignItems) {
    component.counterAxisAlignItems = node.counterAxisAlignItems;
  }

  // Move children from frame to component
  const children = [...node.children];
  for (const child of children) {
    component.appendChild(child);
  }

  // Insert component where the frame was
  if (node.parent) {
    const parent = node.parent;
    const idx = parent.children.indexOf(node);
    parent.insertChild(idx, component);
  }

  // Remove the original frame
  node.remove();

  return {
    id: component.id,
    name: component.name,
    key: component.key,
  };
}

export async function getInstanceOverrides(instanceNode: any = null) {
  let sourceInstance: any = null;

  // Check if an instance node was passed directly
  if (instanceNode) {
    // Validate that the provided node is an instance
    if (instanceNode.type !== "INSTANCE") {
      console.error("Provided node is not an instance");
      figma.notify("Provided node is not a component instance");
      return { success: false, message: "Provided node is not a component instance" };
    }

    sourceInstance = instanceNode;
  } else {
    // No node provided, use selection
    const selection = figma.currentPage.selection;

    // Check if there's anything selected
    if (selection.length === 0) {
      figma.notify("Please select at least one instance");
      return { success: false, message: "No nodes selected" };
    }

    // Filter for instances in the selection
    const instances = selection.filter((node: any) => node.type === "INSTANCE");

    if (instances.length === 0) {
      figma.notify("Please select at least one component instance");
      return { success: false, message: "No instances found in selection" };
    }

    // Take the first instance from the selection
    sourceInstance = instances[0];
  }

  try {
    // Get component overrides and main component
    const overrides = sourceInstance.overrides || [];

    // Get main component
    const mainComponent = await sourceInstance.getMainComponentAsync();
    if (!mainComponent) {
      console.error("Failed to get main component");
      figma.notify("Failed to get main component");
      return { success: false, message: "Failed to get main component" };
    }

    // return data to MCP server
    const returnData = {
      success: true,
      message: `Got component information from "${sourceInstance.name}" for overrides.length: ${overrides.length}`,
      sourceInstanceId: sourceInstance.id,
      mainComponentId: mainComponent.id,
      overridesCount: overrides.length
    };

    figma.notify(`Got component information from "${sourceInstance.name}"`);

    return returnData;
  } catch (error: any) {
    console.error("Error in getInstanceOverrides:", error);
    figma.notify(`Error: ${error.message}`);
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Helper function to validate and get target instances
 * @param {string[]} targetNodeIds - Array of instance node IDs
 * @returns {instanceNode[]} targetInstances - Array of target instances
 */
export async function getValidTargetInstances(targetNodeIds: any) {
  let targetInstances: any[] = [];

  // Handle array of instances or single instance
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

/**
 * Helper function to validate and get saved override data
 * @param {string} sourceInstanceId - Source instance ID
 * @returns {Promise<Object>} - Validation result with source instance data or error
 */
export async function getSourceInstanceData(sourceInstanceId: any) {
  if (!sourceInstanceId) {
    return { success: false, message: "Missing source instance ID" };
  }

  // Get source instance by ID
  const sourceInstance: any = await figma.getNodeByIdAsync(sourceInstanceId);
  if (!sourceInstance) {
    return {
      success: false,
      message: "Source instance not found. The original instance may have been deleted."
    };
  }

  // Verify it's an instance
  if (sourceInstance.type !== "INSTANCE") {
    return {
      success: false,
      message: "Source node is not a component instance."
    };
  }

  // Get main component
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

/**
 * Sets saved overrides to the selected component instance(s)
 * @param {InstanceNode[] | null} targetInstances - Array of instance nodes to set overrides to
 * @param {Object} sourceResult - Source instance data from getSourceInstanceData
 * @returns {Promise<Object>} - Result of the set operation
 */
export async function setInstanceOverrides(targetInstances: any, sourceResult: any) {
  try {


    const { sourceInstance, mainComponent, overrides } = sourceResult;

    console.log(`Processing ${targetInstances.length} instances with ${overrides.length} overrides`);
    console.log(`Source instance: ${sourceInstance.id}, Main component: ${mainComponent.id}`);
    console.log(`Overrides:`, overrides);

    // Process all instances
    const results: any[] = [];
    let totalAppliedCount = 0;

    for (const targetInstance of targetInstances) {
      try {
        // // Skip if trying to apply to the source instance itself
        // if (targetInstance.id === sourceInstance.id) {
        //   console.log(`Skipping source instance itself: ${targetInstance.id}`);
        //   results.push({
        //     success: false,
        //     instanceId: targetInstance.id,
        //     instanceName: targetInstance.name,
        //     message: "This is the source instance itself, skipping"
        //   });
        //   continue;
        // }

        // Swap component
        try {
          targetInstance.swapComponent(mainComponent);
          console.log(`Swapped component for instance "${targetInstance.name}"`);
        } catch (error: any) {
          console.error(`Error swapping component for instance "${targetInstance.name}":`, error);
          results.push({
            success: false,
            instanceId: targetInstance.id,
            instanceName: targetInstance.name,
            message: `Error: ${error.message}`
          });
        }

        // Prepare overrides by replacing node IDs
        let appliedCount = 0;

        // Apply each override
        for (const override of overrides) {
          // Skip if no ID or overriddenFields
          if (!override.id || !override.overriddenFields || override.overriddenFields.length === 0) {
            continue;
          }

          // Replace source instance ID with target instance ID in the node path
          const overrideNodeId = override.id.replace(sourceInstance.id, targetInstance.id);
          const overrideNode: any = await figma.getNodeByIdAsync(overrideNodeId);

          if (!overrideNode) {
            console.log(`Override node not found: ${overrideNodeId}`);
            continue;
          }

          // Get source node to copy properties from
          const sourceNode: any = await figma.getNodeByIdAsync(override.id);
          if (!sourceNode) {
            console.log(`Source node not found: ${override.id}`);
            continue;
          }

          // Apply each overridden field
          let fieldApplied = false;
          for (const field of override.overriddenFields) {
            try {
              if (field === "componentProperties") {
                // Apply component properties
                if (sourceNode.componentProperties && overrideNode.componentProperties) {
                  const properties: any = {};
                  for (const key in sourceNode.componentProperties) {
                    // if INSTANCE_SWAP use id, otherwise use value
                    if (sourceNode.componentProperties[key].type === 'INSTANCE_SWAP') {
                      properties[key] = sourceNode.componentProperties[key].value;

                    } else {
                      properties[key] = sourceNode.componentProperties[key].value;
                    }
                  }
                  overrideNode.setProperties(properties);
                  fieldApplied = true;
                }
              } else if (field === "characters" && overrideNode.type === "TEXT") {
                // For text nodes, need to load fonts first
                await loadAllFonts(overrideNode);
                overrideNode.characters = sourceNode.characters;
                fieldApplied = true;
              } else if (field in overrideNode) {
                // Direct property assignment
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
      } catch (instanceError: any) {
        console.error(`Error processing instance "${targetInstance.name}":`, instanceError);
        results.push({
          success: false,
          instanceId: targetInstance.id,
          instanceName: targetInstance.name,
          message: `Error: ${instanceError.message}`
        });
      }
    }

    // Return results
    if (totalAppliedCount > 0) {
      const instanceCount = results.filter((r: any) => r.success).length;
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

  } catch (error: any) {
    console.error("Error in setInstanceOverrides:", error);
    const message = `Error: ${error.message}`;
    figma.notify(message);
    return { success: false, message };
  }
}

export async function createComponentSet(params: any) {
  var componentIds = params.componentIds;
  var name = params.name;

  // Fetch all component nodes
  var components: any[] = [];
  for (var i = 0; i < componentIds.length; i++) {
    var comp: any = await figma.getNodeByIdAsync(componentIds[i]);
    if (!comp) throw new Error("Component not found with ID: " + componentIds[i]);
    if (comp.type !== "COMPONENT") throw new Error("Node " + componentIds[i] + " is not a COMPONENT (type: " + comp.type + "). Convert frames to components first with create_component.");
    components.push(comp);
  }

  if (components.length < 2) {
    throw new Error("Need at least 2 components to create a component set. Got " + components.length);
  }

  // All components must share the same parent
  var parent: any = components[0].parent;
  for (var i = 1; i < components.length; i++) {
    if (components[i].parent !== parent) {
      throw new Error("All components must share the same parent. Component " + components[i].id + " has a different parent.");
    }
  }

  // Combine into variants
  var componentSet = figma.combineAsVariants(components, parent);

  if (name) {
    componentSet.name = name;
  }

  // Collect variant info
  var variants: any[] = [];
  for (var i = 0; i < componentSet.children.length; i++) {
    var child = componentSet.children[i];
    if (child.type === "COMPONENT") {
      variants.push({
        id: child.id,
        name: child.name,
      });
    }
  }

  return {
    id: componentSet.id,
    name: componentSet.name,
    type: "COMPONENT_SET",
    variantCount: variants.length,
    variants: variants,
    width: componentSet.width,
    height: componentSet.height,
  };
}

export async function getLocalVariables() {
  var collections = await figma.variables.getLocalVariableCollectionsAsync();
  var result: any[] = [];

  for (var c = 0; c < collections.length; c++) {
    var collection = collections[c];
    var variables: any[] = [];

    for (var v = 0; v < collection.variableIds.length; v++) {
      var variable = await figma.variables.getVariableByIdAsync(collection.variableIds[v]);
      if (!variable) continue;

      // Get resolved values for each mode
      var values: any = {};
      for (var m = 0; m < collection.modes.length; m++) {
        var mode = collection.modes[m];
        var val = variable.valuesByMode[mode.modeId];
        values[mode.name] = val;
      }

      variables.push({
        id: variable.id,
        name: variable.name,
        resolvedType: variable.resolvedType,
        values: values,
      });
    }

    result.push({
      id: collection.id,
      name: collection.name,
      modes: collection.modes.map(function(m: any) { return { id: m.modeId, name: m.name }; }),
      variables: variables,
    });
  }

  return { collections: result };
}
