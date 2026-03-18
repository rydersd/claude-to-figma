import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool(
    "diff_components",
    "Compare two components (old vs new) and produce a semantic property mapping + structural diff. Uses introspect on both components, then runs a 4-pass matching algorithm (exact key, suffix, type+name similarity, positional fallback) to map properties between versions. Use this before migrate_instance to understand what changed and review/adjust the mapping.",
    {
      sourceId: z.string().describe("Node ID of the old/source component"),
      targetId: z.string().describe("Node ID of the new/target component"),
      matchStrategy: z.enum(["auto", "name", "position", "manual"]).optional().describe("Matching strategy: 'auto' (default) runs all passes, 'name' only name-based, 'position' only positional, 'manual' uses manualMappings only"),
      manualMappings: z.record(z.string(), z.string()).optional().describe("Manual property mappings (sourceKey → targetKey) for 'manual' strategy or to supplement 'auto'"),
    },
    async ({ sourceId, targetId, matchStrategy, manualMappings }) => {
      try {
        const result = await sendCommandToFigma("diff_components", {
          sourceId,
          targetId,
          matchStrategy: matchStrategy || "auto",
          manualMappings,
        }, 60000);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error diffing components: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.tool(
    "migrate_instance",
    "Migrate a single component instance from one component to another while preserving overrides. Captures current override values via introspect, creates a new instance of the target component, and applies mapped overrides. Use diff_components first to generate the property mapping, or let it auto-map. Supports dryRun mode to preview changes without applying them.",
    {
      instanceId: z.string().describe("Node ID of the instance to migrate"),
      targetComponentId: z.string().describe("Node ID of the target component to migrate to"),
      propertyMapping: z.record(z.string(), z.string()).optional().describe("Property mapping from diff_components (sourceKey → targetKey). If omitted, auto-generates mapping."),
      preservePosition: z.boolean().optional().describe("Preserve x/y position of the instance (default: true)"),
      preserveSize: z.boolean().optional().describe("Preserve width/height of the instance (default: false)"),
      dryRun: z.boolean().optional().describe("Preview what would change without applying (default: false)"),
    },
    async ({ instanceId, targetComponentId, propertyMapping, preservePosition, preserveSize, dryRun }) => {
      try {
        const result = await sendCommandToFigma("migrate_instance", {
          instanceId,
          targetComponentId,
          propertyMapping,
          preservePosition: preservePosition !== undefined ? preservePosition : true,
          preserveSize: preserveSize !== undefined ? preserveSize : false,
          dryRun: dryRun !== undefined ? dryRun : false,
        }, 60000);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error migrating instance: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  server.tool(
    "batch_migrate",
    "Migrate all instances of a source component to a target component across the file or within a subtree. Finds instances by component name or ID, then applies migrate_instance to each with the provided property mapping. Supports dryRun to preview scope and changes before applying. Use diff_components first to generate the mapping.",
    {
      sourceComponentName: z.string().optional().describe("Find instances by main component name (substring match)"),
      sourceComponentId: z.string().optional().describe("Find instances by main component ID (exact match)"),
      targetComponentId: z.string().describe("Node ID of the target component to migrate to"),
      propertyMapping: z.record(z.string(), z.string()).optional().describe("Property mapping from diff_components (sourceKey → targetKey). If omitted, auto-generates mapping."),
      parentId: z.string().optional().describe("Scope migration to descendants of this node"),
      limit: z.number().optional().describe("Maximum number of instances to migrate"),
      dryRun: z.boolean().optional().describe("Preview scope and changes without applying (default: false)"),
    },
    async ({ sourceComponentName, sourceComponentId, targetComponentId, propertyMapping, parentId, limit, dryRun }) => {
      if (!sourceComponentName && !sourceComponentId) {
        return {
          content: [{ type: "text", text: "Error: Either sourceComponentName or sourceComponentId must be provided" }],
        };
      }
      try {
        const result = await sendCommandToFigma("batch_migrate", {
          sourceComponentName,
          sourceComponentId,
          targetComponentId,
          propertyMapping,
          parentId,
          limit,
          dryRun: dryRun !== undefined ? dryRun : false,
        }, 120000);

        const typedResult = result as {
          totalFound: number;
          migrated: number;
          failed: number;
          dryRun: boolean;
          results: Array<{ instanceId: string; instanceName: string; success: boolean; error?: string }>;
        };

        let text = `Found ${typedResult.totalFound} instances`;
        if (typedResult.dryRun) {
          text += ` (dry run — no changes applied)`;
        } else {
          text += `, migrated ${typedResult.migrated}`;
          if (typedResult.failed > 0) text += ` (${typedResult.failed} failed)`;
        }
        text += `\n\n${JSON.stringify(typedResult.results)}`;

        return { content: [{ type: "text", text }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error in batch migration: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
