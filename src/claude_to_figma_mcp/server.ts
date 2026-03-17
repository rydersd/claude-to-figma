#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logger } from "./helpers.js";
import { connectToFigma, sendCommandToFigma } from "./connection.js";

// Import tool registration modules
import { registerTools as registerDocumentTools } from "./tools/document.js";
import { registerTools as registerCreationTools } from "./tools/creation.js";
import { registerTools as registerStylingTools } from "./tools/styling.js";
import { registerTools as registerLayoutTools } from "./tools/layout.js";
import { registerTools as registerTextTools } from "./tools/text.js";
import { registerTools as registerComponentTools } from "./tools/components.js";
import { registerTools as registerVectorTools } from "./tools/vectors.js";
import { registerTools as registerBatchTools } from "./tools/batch.js";
import { registerTools as registerAnnotationTools } from "./tools/annotations.js";
import { registerTools as registerConnectionTools } from "./tools/connections.js";
import { registerTools as registerNavigationTools } from "./tools/navigation.js";
import { registerTools as registerNodeTreeTools } from "./tools/node-tree.js";
import { registerTools as registerScreenshotTools } from "./tools/screenshot.js";
import { registerTools as registerBatchMutateTools } from "./tools/batch-mutate.js";
import { registerTools as registerLintTools } from "./tools/lint.js";
import { registerPrompts } from "./tools/prompts.js";

// Create MCP server
const server = new McpServer({
  name: "ClaudeToFigmaMCP",
  version: "1.0.0",
});

// Register all tools
registerDocumentTools(server, sendCommandToFigma);
registerCreationTools(server, sendCommandToFigma);
registerStylingTools(server, sendCommandToFigma);
registerLayoutTools(server, sendCommandToFigma);
registerTextTools(server, sendCommandToFigma);
registerComponentTools(server, sendCommandToFigma);
registerVectorTools(server, sendCommandToFigma);
registerBatchTools(server, sendCommandToFigma);
registerAnnotationTools(server, sendCommandToFigma);
registerConnectionTools(server, sendCommandToFigma);
registerNavigationTools(server, sendCommandToFigma);
registerNodeTreeTools(server, sendCommandToFigma);
registerScreenshotTools(server, sendCommandToFigma);
registerBatchMutateTools(server, sendCommandToFigma);
registerLintTools(server, sendCommandToFigma);

// Register prompts
registerPrompts(server);

// Start the server
async function main() {
  try {
    // Try to connect to Figma socket server
    connectToFigma();
  } catch (error) {
    logger.warn(`Could not connect to Figma initially: ${error instanceof Error ? error.message : String(error)}`);
    logger.warn('Will try to connect when the first command is sent');
  }

  // Start the MCP server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('FigmaMCP server running on stdio');
}

// Run the server
main().catch(error => {
  logger.error(`Error starting FigmaMCP server: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
