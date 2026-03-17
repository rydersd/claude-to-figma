# Claude to Figma MCP

This project implements a Model Context Protocol (MCP) integration between Claude Code and Figma, allowing Claude Code to communicate with Figma for reading designs and modifying them programmatically.

https://github.com/user-attachments/assets/129a14d2-ed73-470f-9a4c-2240b2a4885c

## Project Structure

- `src/claude_to_figma_mcp/` - TypeScript MCP server for Figma integration
- `src/claude_figma_plugin/` - Figma plugin for communicating with Claude Code
- `src/socket.ts` - WebSocket server that facilitates communication between the MCP server and Figma plugin

## How to use

1. Install Bun if you haven't already:

```bash
curl -fsSL https://bun.sh/install | bash
```

2. Run setup, this will also install MCP in your project

```bash
bun setup
```

3. Start the Websocket server

```bash
bun socket
```

4. Install Figma plugin from the Figma community page or [install locally](#figma-plugin)

## Design Automation Example

**Bulk text content replacement**

Thanks to [@dusskapark](https://github.com/dusskapark) for contributing the bulk text replacement feature. Here is the [demo video](https://www.youtube.com/watch?v=j05gGT3xfCs).

**Instance Override Propagation**
Another contribution from [@dusskapark](https://github.com/dusskapark)
Propagate component instance overrides from a source instance to multiple target instances with a single command. This feature dramatically reduces repetitive design work when working with component instances that need similar customizations. Check out our [demo video](https://youtu.be/uvuT8LByroI).

## Manual Setup and Installation

### MCP Server: Integration with Claude Code

Add the server to your MCP configuration in `.mcp.json`:

```json
{
  "mcpServers": {
    "ClaudeToFigma": {
      "command": "bun",
      "args": ["/path-to-repo/src/claude_to_figma_mcp/server.ts"]
    }
  }
}
```

Or add via CLI:

```bash
claude mcp add ClaudeToFigma -- bun /path-to-repo/src/claude_to_figma_mcp/server.ts
```

### WebSocket Server

Start the WebSocket server:

```bash
bun socket
```

### Figma Plugin

1. In Figma, go to Plugins > Development > New Plugin
2. Choose "Link existing plugin"
3. Select the `src/claude_figma_plugin/manifest.json` file
4. The plugin should now be available in your Figma development plugins

## Windows + WSL Guide

1. Install bun via powershell

```bash
powershell -c "irm bun.sh/install.ps1|iex"
```

2. Uncomment the hostname `0.0.0.0` in `src/socket.ts`

```typescript
// uncomment this to allow connections in windows wsl
hostname: "0.0.0.0",
```

3. Start the websocket

```bash
bun socket
```

## Usage

1. Start the WebSocket server
2. Install the MCP server in Claude Code
3. Open Figma and run the Claude to Figma Plugin
4. Connect the plugin to the WebSocket server by joining a channel using `join_channel`
5. Use Claude Code to communicate with Figma using the MCP tools

## Local Development Setup

To develop, update your mcp config to direct to your local directory.

```json
{
  "mcpServers": {
    "ClaudeToFigma": {
      "command": "bun",
      "args": ["/path-to-repo/src/claude_to_figma_mcp/server.ts"]
    }
  }
}
```

## MCP Tools

The MCP server provides the following tools for interacting with Figma:

### Document & Selection

- `get_document_info` - Returns the current page name, ID, and a list of all top-level children (id, name, type)
- `get_selection` - Returns detailed node data for whatever is currently selected in Figma
- `read_my_design` - Same as `get_selection` but takes no parameters — a shorthand for quick reads
- `get_node_info` - Returns full details (type, size, position, styles, children) for a single node by ID
- `get_nodes_info` - Returns full details for multiple nodes by ID array in one round-trip
- `set_focus` - Selects a node and scrolls the viewport to center it on screen
- `set_selections` - Selects multiple nodes and zooms the viewport to fit them all

### Annotations

- `get_annotations` - Returns all native Figma annotations on the document or a specific node, optionally including category metadata
- `set_annotation` - Creates or updates a single native annotation with markdown content and optional category
- `set_multiple_annotations` - Creates or updates many annotations in one call to avoid per-annotation round-trips
- `scan_nodes_by_types` - Returns all descendant nodes matching specified types (e.g. TEXT, INSTANCE) under a given root — useful for finding annotation targets

### Prototyping & Connections

- `get_reactions` - Returns all prototype interaction triggers and actions from the given nodes, highlighting them in Figma
- `set_default_connector` - Sets the style template for subsequent `create_connections` calls by copying a FigJam connector's appearance
- `create_connections` - Creates FigJam connector lines between pairs of nodes, with optional text labels on each connector

### Creating Elements

- `create_rectangle` - Places a rectangle at (x, y) with given width/height, optional name and parent
- `create_frame` - Places a frame at (x, y) with given width/height, optional fill/stroke colors and parent
- `create_text` - Places a text node at (x, y) with given content, optional font size, weight, color, width, and parent
- `create_line` - Draws a line from (startX, startY) to (endX, endY) with optional stroke color, weight, and start/end caps (e.g. arrows)
- `create_section` - Places a labeled section container at (x, y) with given size, optionally adopting existing nodes as children
- `create_vector` - Places a vector node from an SVG path string at (x, y) with given size and optional fill color
- `create_node_tree` - Builds an entire node hierarchy from a JSON spec in one round-trip — supports nested frames, `$repeat` for data-driven repetition, `$var:` for Figma variable binding, and hex color shorthand

### Text

- `scan_text_nodes` - Returns all text nodes under a root, with chunked responses for large trees to avoid timeouts
- `set_text_content` - Replaces the text content of a single text node, loading the required font automatically
- `set_multiple_text_contents` - Replaces text on many nodes in one call, each identified by node ID
- `set_font_family` - Changes the font family and style (e.g. "Inter", "Bold") on a text node
- `set_text_auto_resize` - Controls how a text node resizes to fit content: NONE, WIDTH_AND_HEIGHT, HEIGHT, or TRUNCATE
- `set_text_decoration` - Applies underline, strikethrough, or removes decoration from a text node
- `set_text_align` - Sets horizontal (LEFT, CENTER, RIGHT, JUSTIFIED) and/or vertical (TOP, CENTER, BOTTOM) text alignment
- `set_text_format` - Sets node-level text formatting: line height, paragraph indent/spacing, letter spacing, text case (including SMALL_CAPS), leading trim, hanging punctuation/list, list spacing, truncation, and max lines
- `set_text_list` - Applies native Figma ordered/unordered list formatting to a text node, with per-line type and indentation control for nested lists
- `set_range_format` - Applies formatting to specific character ranges: font family/size/style, color, text case, decoration, letter spacing, line height, list type, indentation, and hyperlinks — for rich text with mixed fonts, bold spans, colored text, and inline links

### Auto Layout & Spacing

- `set_layout_mode` - Switches a frame to HORIZONTAL, VERTICAL, or NONE auto-layout, with optional wrap behavior
- `set_padding` - Sets top, right, bottom, left padding on an auto-layout frame
- `set_axis_align` - Sets primary axis (e.g. space-between) and counter axis (e.g. center) alignment on an auto-layout frame
- `set_layout_sizing` - Sets horizontal and vertical sizing modes (FIXED, HUG, FILL) on an auto-layout frame
- `set_item_spacing` - Sets the gap between children in an auto-layout frame

### Styling

- `set_fill_color` - Sets a solid fill color on a node using RGBA values (0–1 range)
- `set_stroke_color` - Sets a solid stroke color and optional weight on a node
- `set_corner_radius` - Sets corner radius on a node, with optional per-corner control (top-left, top-right, bottom-right, bottom-left)
- `set_stroke_dash` - Sets the dash pattern (array of dash/gap lengths) on a node's stroke
- `set_stroke_properties` - Sets stroke weight, end cap, join style, alignment, and dash pattern in one call
- `remove_fill` - Clears all fills from a node

### Layout & Organization

- `move_node` - Repositions a node to new (x, y) coordinates
- `resize_node` - Changes a node's width and height
- `delete_node` - Removes a single node from the document
- `delete_multiple_nodes` - Removes multiple nodes by ID array in one call
- `clone_node` - Duplicates a node with an optional (x, y) offset for the copy
- `insert_child_at` - Moves a node into a parent at a specific child index, controlling layer order
- `reorder_child` - Changes a node's position (z-order) within its current parent
- `set_clips_content` - Sets whether a frame clips children to its boundary — set to false for overflow-visible patterns like floating badges

### Components & Styles

- `get_styles` - Returns all local paint, text, effect, and grid styles in the document
- `get_local_variables` - Returns all local variables (design tokens) organized by collection — use names with `$var:Collection/Name` in color fields to bind real Figma variables
- `get_local_components` - Returns all local components with their IDs, names, descriptions, and published keys
- `create_component` - Converts an existing frame into a reusable Figma component, returning its new component ID and key
- `create_component_instance` - Places an instance of a component by local ID or published key at (x, y), with optional parent
- `get_instance_overrides` - Extracts all override properties (text, fills, visibility, etc.) from a component instance for later replication
- `set_instance_overrides` - Applies a source instance's overrides to one or more target instances, swapping them to match
- `swap_instance_variant` - Swaps a component instance to a different component or variant while preserving compatible overrides
- `set_component_properties` - Sets exposed component properties (text, boolean, instance swap, variant) on an instance using key#id pairs

### Component Introspection & AI Manipulation

- `introspect` - Returns a flat property map of every editable surface in a component or frame — text nodes, fill/stroke colors, instance variants, visibility toggles, and component properties — keyed by semantic path (e.g. `badge.text`, `header.fill`). Also reports tree depth, wrapper frame count, and name collisions.
- `set_properties` - Applies value changes to multiple properties by semantic key in one call. Accepts text strings, hex colors, variant names, booleans, and component property values. Each property is applied independently — one failure won't abort others.
- `optimize_structure` - Analyzes a component or frame for structural inefficiencies (wrapper frames, unnamed text nodes) and optionally applies fixes. Dry-run by default — reports proposed changes without modifying anything.

### Vectors

- `create_vector` - Places a vector node from an SVG path string (also listed under Creating Elements)
- `set_vector_path` - Replaces the SVG path data on an existing vector node, with optional resize
- `get_vector_network` - Returns the full vector network (vertices, segments, regions) of a vector node for programmatic editing
- `set_vector_network` - Replaces the vector network with new vertices, segments, and optional fill regions

### Batch Operations

- `rename_node` - Renames a single node by ID
- `batch_rename` - Renames multiple nodes in one call using an array of {nodeId, name} mappings
- `group_nodes` - Wraps multiple nodes into a new Figma group with an optional name
- `batch_reparent` - Moves multiple nodes under a new parent node at an optional child index
- `batch_set_fill_color` - Applies the same fill color to multiple nodes at once
- `batch_clone` - Duplicates one source node to multiple (x, y) positions with optional names per clone
- `batch_mutate` - Executes a mixed array of operations (rename, set_fill, set_stroke, move, resize, delete, set_text, set_visible, set_font, set_text_align, set_vector_path) in a single round-trip — each operation runs independently

### Inspection & Linting

- `scan_node_styles` - Walks a frame tree and returns fill, stroke, font, layout, corner-radius, and component data for every descendant — includes a `boundVariable` flag on each color for detecting hardcoded vs token-bound values
- `screenshot_region` - Captures a PNG screenshot of a rectangular canvas region at optional scale

### Export

- `export_node_as_image` - Exports a node as PNG, JPG, SVG, or PDF at optional scale, returning base64-encoded image data

### Connection Management

- `join_channel` - Joins a named WebSocket channel to establish communication between the MCP server and the Figma plugin

### MCP Prompts

The MCP server includes several helper prompts to guide you through complex design tasks:

- `design_strategy` - Best practices for working with Figma designs
- `read_design_strategy` - Best practices for reading Figma designs
- `text_replacement_strategy` - Systematic approach for replacing text in Figma designs
- `annotation_conversion_strategy` - Strategy for converting manual annotations to Figma's native annotations
- `swap_overrides_instances` - Strategy for transferring overrides between component instances in Figma
- `reaction_to_connector_strategy` - Strategy for converting Figma prototype reactions to connector lines using the output of 'get_reactions', and guiding the use 'create_connections' in sequence

## Development

### Building the Figma Plugin

1. Navigate to the Figma plugin directory:

   ```
   cd src/claude_figma_plugin
   ```

2. Edit code.js and ui.html

## Best Practices

When working with the Figma MCP:

1. Always join a channel before sending commands
2. Get document overview using `get_document_info` first
3. Check current selection with `get_selection` before modifications
4. Use appropriate creation tools based on needs:
   - `create_frame` for containers
   - `create_rectangle` for basic shapes
   - `create_text` for text elements
5. Verify changes using `get_node_info`
6. Use component instances when possible for consistency
7. Handle errors appropriately as all commands can throw exceptions
8. For large designs:
   - Use chunking parameters in `scan_text_nodes`
   - Monitor progress through WebSocket updates
   - Implement appropriate error handling
9. For text operations:
   - Use batch operations when possible
   - Consider structural relationships
   - Verify changes with targeted exports
10. For converting legacy annotations:
    - Scan text nodes to identify numbered markers and descriptions
    - Use `scan_nodes_by_types` to find UI elements that annotations refer to
    - Match markers with their target elements using path, name, or proximity
    - Categorize annotations appropriately with `get_annotations`
    - Create native annotations with `set_multiple_annotations` in batches
    - Verify all annotations are properly linked to their targets
    - Delete legacy annotation nodes after successful conversion
11. Visualize prototype noodles as FigJam connectors:
    - Use `get_reactions` to extract prototype flows,
    - set a default connector with `set_default_connector`,
    - and generate connector lines with `create_connections` for clear visual flow mapping.
12. For efficient component manipulation:
    - Call `introspect` first to discover all editable properties in one round-trip
    - Use `set_properties` with the returned property map to make multiple changes at once
    - Run `optimize_structure` in dry-run mode to identify structural inefficiencies before applying

## License

MIT
