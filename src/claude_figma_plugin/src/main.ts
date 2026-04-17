// Main entry point for the Claude to Figma plugin
// Handles state, UI events, and command dispatching

// Module imports
import { getDocumentInfo, getSelection, getNodeInfo, getNodesInfo, readMyDesign, getAnnotations, setAnnotation, scanNodesByTypes, setMultipleAnnotations } from './document';
import { setTextContent, scanTextNodes, setMultipleTextContents, setFontFamily, setTextAutoResize, setTextDecoration, setTextAlign, setTextFormat, setTextList, setRangeFormat } from './text';
import { createRectangle, createFrame, createText, createEllipse, createSection, createSvg } from './creation';
import { setFillColor, batchSetFillColor, setStrokeColor, setCornerRadius, removeFill, setStrokeDash, setStrokeProperties, setClipsContent, setEffects, setOpacity, setBlendMode, setRotation, setConstraints, setMinMaxSize, setMask } from './styling';
import { moveNode, resizeNode, deleteNode, deleteMultipleNodes, cloneNode, batchClone, renameNode, batchRename, groupNodes, batchReparent, insertChildAt, reorderChild, setLayoutPositioning } from './transforms';
import { setLayoutMode, setPadding, setAxisAlign, setLayoutSizing, setItemSpacing } from './layout';
import { getStyles, getLocalComponents, createComponentInstance, swapInstanceVariant, setComponentProperties, exportNodeAsImage, createComponent, getInstanceOverrides, getValidTargetInstances, getSourceInstanceData, setInstanceOverrides, createComponentSet, getLocalVariables } from './components';
import { normalizeSvgPath, createVector, createLine, setVectorPath, getVectorNetwork, setVectorNetwork } from './vectors';
import { getReactions, setReactions, addReaction, removeReactions, getInteractions, batchSetReactions, setDefaultConnector, createConnections, setFocus, setSelections } from './prototyping';
import { createNodeTree } from './node-tree';
import { screenshotRegion, batchMutate, scanNodeStyles, introspectNode, setProperties, optimizeStructure, designQuery, figmaEval, diffComponents, migrateInstance, batchMigrate } from './analysis';
import { startEventStreaming, stopEventStreaming, setPluginOperationGuard } from './events';

// Plugin state
const state = {
  serverPort: 3055, // Default port
  firstOnTop: true, // Default auto-layout stacking: first child on top
  autoConnect: true, // Auto-connect on plugin launch
};

// Show UI
figma.showUI(__html__, { width: 350, height: 600 });

// Plugin commands from UI
figma.ui.onmessage = async (msg: any) => {
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
      // Execute commands received from UI (which gets them from WebSocket)
      // Wrap in plugin operation guard so event listeners can tag self-caused events
      setPluginOperationGuard(true);
      try {
        const result = await handleCommand(msg.command, msg.params);
        // Send result back to UI
        figma.ui.postMessage({
          type: "command-result",
          id: msg.id,
          result,
        });
      } catch (error: any) {
        figma.ui.postMessage({
          type: "command-error",
          id: msg.id,
          error: error.message || "Error executing command",
        });
      } finally {
        setPluginOperationGuard(false);
      }
      break;
  }
};

// Listen for plugin commands from menu
figma.on("run", ({ command }: any) => {
  if (state.autoConnect) {
    figma.ui.postMessage({ type: "auto-connect" });
  }
});

// Update plugin settings
function updateSettings(settings: any) {
  if (settings.serverPort) {
    state.serverPort = settings.serverPort;
  }
  if (settings.firstOnTop !== undefined) {
    state.firstOnTop = !!settings.firstOnTop;
  }
  if (settings.autoConnect !== undefined) {
    state.autoConnect = !!settings.autoConnect;
  }

  figma.clientStorage.setAsync("settings", {
    serverPort: state.serverPort,
    firstOnTop: state.firstOnTop,
    autoConnect: state.autoConnect,
  });
}

// Handle commands from UI
async function handleCommand(command: string, params: any) {
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
      // Check if instanceNode parameter is provided
      if (params && params.instanceNodeId) {
        // Get the instance node by ID
        const instanceNode = await figma.getNodeByIdAsync(params.instanceNodeId);
        if (!instanceNode) {
          throw new Error(`Instance node not found with ID: ${params.instanceNodeId}`);
        }
        return await getInstanceOverrides(instanceNode);
      }
      // Call without instance node if not provided
      return await getInstanceOverrides();
      break;

    case "set_instance_overrides":
      // Check if instanceNodeIds parameter is provided
      if (params && params.targetNodeIds) {
        // Validate that targetNodeIds is an array
        if (!Array.isArray(params.targetNodeIds)) {
          throw new Error("targetNodeIds must be an array");
        }

        // Get the instance nodes by IDs
        const targetNodes = await getValidTargetInstances(params.targetNodeIds);
        if (!targetNodes.success) {
          figma.notify(targetNodes.message);
          return { success: false, message: targetNodes.message };
        }

        if (params.sourceInstanceId) {

          // get source instance data
          let sourceInstanceData: any = null;
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
      break;
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
      if (params.x === undefined || params.y === undefined || !params.width || !params.height) {
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
    // Event streaming commands
    case "subscribe_events":
      startEventStreaming();
      return { success: true, message: "Event streaming started" };
    case "unsubscribe_events":
      stopEventStreaming();
      return { success: true, message: "Event streaming stopped" };
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

// Initialize settings on load
(async function initializePlugin() {
  try {
    const savedSettings = await figma.clientStorage.getAsync("settings");
    if (savedSettings) {
      if (savedSettings.serverPort) {
        state.serverPort = savedSettings.serverPort;
      }
      if (savedSettings.firstOnTop !== undefined) {
        state.firstOnTop = !!savedSettings.firstOnTop;
      }
      if (savedSettings.autoConnect !== undefined) {
        state.autoConnect = !!savedSettings.autoConnect;
      }
    }

    // Send initial settings to UI
    figma.ui.postMessage({
      type: "init-settings",
      settings: {
        serverPort: state.serverPort,
        firstOnTop: state.firstOnTop,
        autoConnect: state.autoConnect,
      },
    });
  } catch (error) {
    console.error("Error loading settings:", error);
  }
})();
