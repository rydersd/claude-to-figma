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
import { registerTools as registerIntrospectTools } from "./tools/introspect.js";
import { registerTools as registerVisualTools } from "./tools/visual.js";
import { registerTools as registerEvalTools } from "./tools/eval.js";
import { registerTools as registerMigrationTools } from "./tools/migration.js";
import { registerTools as registerPrototypingTools, registerFlowTools } from "./tools/prototyping.js";
import { registerTools as registerWireframeParserTools } from "./tools/wireframe-parser.js";
import { registerTools as registerPageCompilerTools } from "./tools/page-compiler.js";
import { registerTools as registerImageTools } from "./tools/images.js";
import { registerTools as registerLibraryTools } from "./tools/library.js";
import { registerTools as registerEventTools } from "./tools/events.js";
import { registerTools as registerVerifyTools } from "./tools/verify.js";
import { registerReadTools as registerCommentReadTools, registerWriteTools as registerCommentWriteTools } from "./tools/comments.js";
import { registerWhenEnabled, type Feature } from "../shared/flags.js";
import { registerPrompts } from "./tools/prompts.js";
import { installFigmaPluginFiles, isPluginInstall } from "./plugin-runtime.js";
import { registerSetupTools } from "./tools/setup.js";

import { registerTools as registerReferenceCacheTools } from "./tools/reference-cache.js";
import { registerTools as registerCodeMapTools } from "./tools/code-map.js";

// Create MCP server
const server = new McpServer({
  name: "llm2figma",
  version: "1.0.0",
});

// Feature modules register through this and are skipped unless L2F_<FEATURE> is set
// in the server environment (see src/shared/flags.ts).
const registerFeature = (feature: Feature, register: (server: McpServer, send: typeof sendCommandToFigma) => void) =>
  registerWhenEnabled(feature, register, server, sendCommandToFigma);

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
registerIntrospectTools(server, sendCommandToFigma);
registerVisualTools(server, sendCommandToFigma);
registerEvalTools(server, sendCommandToFigma);
registerMigrationTools(server, sendCommandToFigma);
registerPrototypingTools(server, sendCommandToFigma);
registerWireframeParserTools(server, sendCommandToFigma);
registerPageCompilerTools(server, sendCommandToFigma);
registerImageTools(server, sendCommandToFigma);
registerLibraryTools(server, sendCommandToFigma);
registerEventTools(server, sendCommandToFigma);
registerFeature("VERIFY", registerVerifyTools);
registerFeature("COMMENTS", registerCommentReadTools);
registerFeature("COMMENTS_WRITE", registerCommentWriteTools);
registerReferenceCacheTools(server);
registerSetupTools(server);
registerFeature("FLOWS", registerFlowTools);
registerFeature("CODE_MAP", (s) => registerCodeMapTools(s));

// Register prompts
registerPrompts(server);

// Start the server
async function main() {
  installFigmaPluginFiles();

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
  logger.info('llm2figma server running on stdio');

  // As a plugin, Claude Code always talks to us over a stdin pipe: exit when
  // it closes, or the relay reconnect timer keeps an orphaned server alive.
  if (isPluginInstall) process.stdin.on("end", () => process.exit(0));
}

// Run the server
main().catch(error => {
  logger.error(`Error starting llm2figma server: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
