// ---------------------------------------------------------------------------
// Page Compiler Tools
// build_page_section — compile a compact semantic spec into a full Figma
//                      node tree and create it via create_node_tree.
// get_section_templates — list available templates with props documentation.
// ---------------------------------------------------------------------------

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";
import { sendCommandWithRetry } from "../connection.js";
import { SECTION_TEMPLATES, getTemplateSummaries } from "../templates/pcp-sections.js";
import { logger } from "../helpers.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {

  // -------------------------------------------------------------------------
  // build_page_section
  // -------------------------------------------------------------------------
  server.tool(
    "build_page_section",
    "Build a single page section in Figma using a compact semantic spec. Accepts a template name and props — the server handles zone-aware token selection, node tree generation, and dispatches via create_node_tree internally. ~10x fewer tokens than manual create_node_tree calls. Use get_section_templates to see available templates and their required props.",
    {
      template: z.string().describe("Template name (e.g., 'hero_takeover', 'slds_data_table')"),
      parentId: z.string().describe("Parent frame ID to add the section into"),
      props: z.record(z.any()).describe("Template-specific properties — see get_section_templates for schema"),
      width: z.number().optional().describe("Override the template's default section width"),
      insertAt: z.number().optional().describe("Position index within parent's children (omit to append)"),
    },
    async ({ template, parentId, props, width, insertAt }: {
      template: string;
      parentId: string;
      props: Record<string, any>;
      width?: number;
      insertAt?: number;
    }) => {
      try {
        // 1. Look up the template
        const tmpl = SECTION_TEMPLATES[template];
        if (!tmpl) {
          const available = Object.keys(SECTION_TEMPLATES).join(", ");
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                error: `Unknown template "${template}". Available templates: ${available}`,
              }),
            }],
          };
        }

        // 2. Build the node tree spec from props
        const tree = tmpl.buildTree(props, width);

        logger.info(
          `build_page_section: template="${template}" zone="${tmpl.zone}" ` +
          `parentId="${parentId}" width=${width ?? tmpl.defaultWidth}`
        );

        // 3. Send via create_node_tree with 60s timeout
        //    If insertAt is specified, we include it in the params so the
        //    Figma plugin can insert at the correct position.
        const params: Record<string, any> = { tree, parentId };
        if (insertAt !== undefined) {
          params.insertAt = insertAt;
        }

        // M6 fix: use retry wrapper instead of raw sendCommandToFigma
        const result = await sendCommandWithRetry("create_node_tree", params, { timeoutMs: 60000 });

        // 4. Return the result with zone metadata
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              template,
              zone: tmpl.zone,
              result,
            }),
          }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`build_page_section error: ${message}`);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: `Failed to build section "${template}": ${message}`,
            }),
          }],
        };
      }
    }
  );

  // -------------------------------------------------------------------------
  // get_section_templates
  // -------------------------------------------------------------------------
  server.tool(
    "get_section_templates",
    "List available section templates for build_page_section, grouped by zone. Returns template names, zones, descriptions, default widths, and required/optional props for each template.",
    {},
    async () => {
      const summaries = getTemplateSummaries();

      // Group by zone for readability
      const grouped: Record<string, typeof summaries> = {
        full_brand: [],
        brand_tinted: [],
        no_brand: [],
      };

      for (const s of summaries) {
        grouped[s.zone].push(s);
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            totalTemplates: summaries.length,
            zones: grouped,
          }, null, 2),
        }],
      };
    }
  );
}
