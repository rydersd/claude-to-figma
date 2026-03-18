// Define TypeScript interfaces for Figma responses
export interface FigmaResponse {
  id: string;
  result?: any;
  error?: string;
}

// Define interface for command progress updates
export interface CommandProgressUpdate {
  type: 'command_progress';
  commandId: string;
  commandType: string;
  status: 'started' | 'in_progress' | 'completed' | 'error';
  progress: number;
  totalItems: number;
  processedItems: number;
  currentChunk?: number;
  totalChunks?: number;
  chunkSize?: number;
  message: string;
  payload?: any;
  timestamp: number;
}

export interface getInstanceOverridesResult {
  success: boolean;
  message: string;
  sourceInstanceId: string;
  mainComponentId: string;
  overridesCount: number;
}

export interface setInstanceOverridesResult {
  success: boolean;
  message: string;
  totalCount?: number;
  results?: Array<{
    success: boolean;
    instanceId: string;
    instanceName: string;
    appliedCount?: number;
    message?: string;
  }>;
}

export interface SetMultipleAnnotationsParams {
  nodeId: string;
  annotations: Array<{
    nodeId: string;
    labelMarkdown: string;
    categoryId?: string;
    annotationId?: string;
    properties?: Array<{ type: string }>;
  }>;
}

export type FigmaCommand =
  | "get_document_info"
  | "get_selection"
  | "get_node_info"
  | "get_nodes_info"
  | "read_my_design"
  | "create_rectangle"
  | "create_frame"
  | "create_text"
  | "set_fill_color"
  | "set_stroke_color"
  | "move_node"
  | "resize_node"
  | "delete_node"
  | "delete_multiple_nodes"
  | "get_styles"
  | "get_local_components"
  | "create_component_instance"
  | "get_instance_overrides"
  | "set_instance_overrides"
  | "swap_instance_variant"
  | "set_component_properties"
  | "export_node_as_image"
  | "join"
  | "set_corner_radius"
  | "clone_node"
  | "set_text_content"
  | "scan_text_nodes"
  | "set_multiple_text_contents"
  | "get_annotations"
  | "set_annotation"
  | "set_multiple_annotations"
  | "scan_nodes_by_types"
  | "set_layout_mode"
  | "set_padding"
  | "set_axis_align"
  | "set_layout_sizing"
  | "set_item_spacing"
  | "get_reactions"
  | "set_default_connector"
  | "create_connections"
  | "set_focus"
  | "set_selections"
  | "set_font_family"
  | "set_text_auto_resize"
  | "insert_child_at"
  | "reorder_child"
  | "create_component"
  | "create_vector"
  | "set_stroke_dash"
  | "set_stroke_properties"
  | "remove_fill"
  | "create_section"
  | "set_text_decoration"
  | "create_node_tree"
  | "get_local_variables"
  | "rename_node"
  | "batch_rename"
  | "create_line"
  | "group_nodes"
  | "batch_reparent"
  | "batch_set_fill_color"
  | "batch_clone"
  | "set_vector_path"
  | "get_vector_network"
  | "set_vector_network"
  | "screenshot_region"
  | "batch_mutate"
  | "scan_node_styles"
  | "introspect_node"
  | "set_properties"
  | "optimize_structure"
  | "set_text_align"
  | "set_text_format"
  | "set_text_list"
  | "set_range_format"
  | "set_clips_content"
  | "set_effects"
  | "set_opacity"
  | "set_blend_mode"
  | "set_layout_positioning"
  | "set_rotation"
  | "create_ellipse"
  | "set_constraints"
  | "set_min_max_size"
  | "set_mask"
  | "create_component_set"
  | "create_svg"
  | "design_query"
  | "figma_eval";

export type CommandParams = {
  get_document_info: Record<string, never>;
  get_selection: Record<string, never>;
  get_node_info: { nodeId: string };
  get_nodes_info: { nodeIds: string[] };
  create_rectangle: {
    x: number;
    y: number;
    width: number;
    height: number;
    name?: string;
    parentId?: string;
  };
  create_frame: {
    x: number;
    y: number;
    width: number;
    height: number;
    name?: string;
    parentId?: string;
    fillColor?: { r: number; g: number; b: number; a?: number };
    strokeColor?: { r: number; g: number; b: number; a?: number };
    strokeWeight?: number;
  };
  create_text: {
    x: number;
    y: number;
    text: string;
    fontSize?: number;
    fontWeight?: number;
    fontColor?: { r: number; g: number; b: number; a?: number };
    name?: string;
    parentId?: string;
    width?: number;
  };
  set_fill_color: {
    nodeId: string;
    r: number;
    g: number;
    b: number;
    a?: number;
  };
  set_stroke_color: {
    nodeId: string;
    r: number;
    g: number;
    b: number;
    a?: number;
    weight?: number;
  };
  move_node: {
    nodeId: string;
    x: number;
    y: number;
  };
  resize_node: {
    nodeId: string;
    width: number;
    height: number;
  };
  delete_node: {
    nodeId: string;
  };
  delete_multiple_nodes: {
    nodeIds: string[];
  };
  get_styles: Record<string, never>;
  get_local_components: Record<string, never>;
  get_team_components: Record<string, never>;
  create_component_instance: {
    componentKey: string;
    x: number;
    y: number;
  };
  get_instance_overrides: {
    instanceNodeId: string | null;
  };
  set_instance_overrides: {
    targetNodeIds: string[];
    sourceInstanceId: string;
  };
  swap_instance_variant: {
    nodeId: string;
    componentKey: string;
  };
  set_component_properties: {
    nodeId: string;
    properties: Record<string, string | boolean>;
  };
  export_node_as_image: {
    nodeId: string;
    format?: "PNG" | "JPG" | "SVG" | "PDF";
    scale?: number;
  };
  execute_code: {
    code: string;
  };
  join: {
    channel: string;
  };
  set_corner_radius: {
    nodeId: string;
    radius: number;
    corners?: boolean[];
  };
  clone_node: {
    nodeId: string;
    x?: number;
    y?: number;
  };
  set_text_content: {
    nodeId: string;
    text: string;
  };
  scan_text_nodes: {
    nodeId: string;
    useChunking: boolean;
    chunkSize: number;
  };
  set_multiple_text_contents: {
    nodeId: string;
    text: Array<{ nodeId: string; text: string }>;
  };
  get_annotations: {
    nodeId?: string;
    includeCategories?: boolean;
  };
  set_annotation: {
    nodeId: string;
    annotationId?: string;
    labelMarkdown: string;
    categoryId?: string;
    properties?: Array<{ type: string }>;
  };
  set_multiple_annotations: SetMultipleAnnotationsParams;
  scan_nodes_by_types: {
    nodeId: string;
    types: Array<string>;
  };
  get_reactions: { nodeIds: string[] };
  set_default_connector: {
    connectorId?: string | undefined;
  };
  create_connections: {
    connections: Array<{
      startNodeId: string;
      endNodeId: string;
      text?: string;
    }>;
  };
  set_focus: {
    nodeId: string;
  };
  set_selections: {
    nodeIds: string[];
  };
  set_font_family: {
    nodeId: string;
    fontFamily: string;
    fontStyle?: string;
  };
  set_text_auto_resize: {
    nodeId: string;
    textAutoResize: "NONE" | "WIDTH_AND_HEIGHT" | "HEIGHT" | "TRUNCATE";
  };
  insert_child_at: {
    parentId: string;
    childId: string;
    index: number;
  };
  reorder_child: {
    childId: string;
    index: number;
  };
  create_component: {
    nodeId: string;
  };
  create_vector: {
    pathData: string;
    x: number;
    y: number;
    width: number;
    height: number;
    name?: string;
    parentId?: string;
    fillColor?: { r: number; g: number; b: number; a?: number };
  };
  set_stroke_dash: {
    nodeId: string;
    dashPattern: number[];
  };
  set_stroke_properties: {
    nodeId: string;
    weight?: number;
    cap?: "NONE" | "ROUND" | "SQUARE" | "ARROW_LINES" | "ARROW_EQUILATERAL" | "TRIANGLE_FILLED" | "DIAMOND_FILLED" | "CIRCLE_FILLED";
    join?: "MITER" | "BEVEL" | "ROUND";
    align?: "INSIDE" | "OUTSIDE" | "CENTER";
    dashPattern?: number[];
  };
  remove_fill: {
    nodeId: string;
  };
  create_section: {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    childIds?: string[];
  };
  set_text_decoration: {
    nodeId: string;
    decoration: "NONE" | "UNDERLINE" | "STRIKETHROUGH";
  };
  create_node_tree: {
    tree: any;
    parentId?: string;
  };
  get_local_variables: Record<string, never>;
  rename_node: {
    nodeId: string;
    name: string;
  };
  batch_rename: {
    mappings: Array<{ nodeId: string; name: string }>;
  };
  create_line: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    strokeWeight?: number;
    strokeColor?: { r: number; g: number; b: number; a?: number } | string;
    startCap?: string;
    endCap?: string;
    name?: string;
    parentId?: string;
  };
  group_nodes: {
    nodeIds: string[];
    name?: string;
  };
  batch_reparent: {
    nodeIds: string[];
    parentId: string;
    index?: number;
  };
  batch_set_fill_color: {
    nodeIds: string[];
    color: { r: number; g: number; b: number; a: number };
  };
  batch_clone: {
    sourceId: string;
    positions: Array<{ x: number; y: number }>;
    names?: string[];
  };
  set_vector_path: {
    nodeId: string;
    pathData: string;
    width?: number;
    height?: number;
  };
  get_vector_network: {
    nodeId: string;
  };
  set_vector_network: {
    nodeId: string;
    vertices: Array<{ x: number; y: number; strokeCap?: string; cornerRadius?: number }>;
    segments: Array<{ start: number; end: number; tangentStart?: { x: number; y: number }; tangentEnd?: { x: number; y: number } }>;
    regions?: Array<{ windingRule?: string; loops: number[][] }>;
  };
  screenshot_region: {
    x: number;
    y: number;
    width: number;
    height: number;
    scale?: number;
  };
  batch_mutate: {
    operations: Array<{ op: string; nodeId: string; [key: string]: any }>;
  };
  scan_node_styles: {
    nodeId: string;
    maxDepth?: number;
  };
  introspect_node: {
    nodeId: string;
    maxDepth?: number;
  };
  set_properties: {
    nodeId: string;
    properties: Record<string, any>;
    propertyMap?: Record<string, any>;
  };
  optimize_structure: {
    nodeId: string;
    options?: {
      dryRun?: boolean;
      maxDepth?: number;
      flatten?: boolean;
      rename?: boolean;
      exposeProperties?: boolean;
      extractComponents?: boolean;
    };
  };
  set_text_align: {
    nodeId: string;
    horizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
    vertical?: "TOP" | "CENTER" | "BOTTOM";
  };
  set_text_format: {
    nodeId: string;
    lineHeight?: number | "AUTO" | { value: number; unit: "PIXELS" | "PERCENT" | "AUTO" };
    paragraphIndent?: number;
    paragraphSpacing?: number;
    letterSpacing?: number | { value: number; unit: "PIXELS" | "PERCENT" };
    textCase?: "ORIGINAL" | "UPPER" | "LOWER" | "TITLE" | "SMALL_CAPS" | "SMALL_CAPS_FORCED";
    leadingTrim?: "NONE" | "CAP_HEIGHT";
    hangingPunctuation?: boolean;
    hangingList?: boolean;
    listSpacing?: number;
    textTruncation?: "DISABLED" | "ENDING";
    maxLines?: number | null;
  };
  set_text_list: {
    nodeId: string;
    listType?: "ORDERED" | "UNORDERED" | "NONE";
    indentation?: number;
    listSpacing?: number;
    hangingList?: boolean;
    lines?: Array<{ line: number; type?: "ORDERED" | "UNORDERED" | "NONE"; indentation?: number }>;
  };
  set_range_format: {
    nodeId: string;
    ranges: Array<{
      start: number;
      end: number;
      fontFamily?: string;
      fontStyle?: string;
      fontSize?: number;
      color?: string | { r: number; g: number; b: number; a?: number };
      textCase?: string;
      textDecoration?: string;
      letterSpacing?: number | { value: number; unit: string };
      lineHeight?: number | "AUTO" | { value: number; unit: string };
      listType?: "ORDERED" | "UNORDERED" | "NONE";
      indentation?: number;
      hyperlink?: { type: "URL"; value: string } | null;
    }>;
  };
  set_clips_content: {
    nodeId: string;
    clipsContent: boolean;
  };
  set_effects: {
    nodeId: string;
    effects: Array<{
      type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
      visible?: boolean;
      color?: string | { r: number; g: number; b: number; a?: number };
      offset?: { x: number; y: number };
      radius?: number;
      spread?: number;
      blendMode?: string;
    }>;
  };
  set_opacity: {
    nodeId: string;
    opacity: number;
  };
  set_blend_mode: {
    nodeId: string;
    blendMode: string;
  };
  set_layout_positioning: {
    nodeId: string;
    positioning: "ABSOLUTE" | "AUTO";
    constraints?: { horizontal?: string; vertical?: string };
  };
  set_rotation: {
    nodeId: string;
    rotation: number;
  };
  create_ellipse: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    name?: string;
    parentId?: string;
    fillColor?: string | { r: number; g: number; b: number; a?: number };
    arcData?: { startingAngle?: number; endingAngle?: number; innerRadius?: number };
  };
  set_constraints: {
    nodeId: string;
    horizontal?: "MIN" | "MAX" | "CENTER" | "STRETCH" | "SCALE";
    vertical?: "MIN" | "MAX" | "CENTER" | "STRETCH" | "SCALE";
  };
  set_min_max_size: {
    nodeId: string;
    minWidth?: number | null;
    maxWidth?: number | null;
    minHeight?: number | null;
    maxHeight?: number | null;
  };
  set_mask: {
    nodeId: string;
    isMask?: boolean;
    groupWithIds?: string[];
    groupName?: string;
  };
  create_component_set: {
    componentIds: string[];
    name?: string;
  };
  create_svg: {
    svg: string;
    name?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    parentId?: string;
    insertAt?: number;
  };
  design_query: {
    select: {
      type?: string | string[];
      component?: string;
      name?: string;
      nameRegex?: string;
      parentId?: string;
      where?: Record<string, any>;
      maxDepth?: number;
    };
    update?: Record<string, any>;
    limit?: number;
    includeProperties?: boolean;
  };
  figma_eval: {
    code: string;
  };
};

// Type for the sendCommandToFigma function signature used by tool modules
export type SendCommandFn = (
  command: FigmaCommand,
  params?: unknown,
  timeoutMs?: number
) => Promise<unknown>;
