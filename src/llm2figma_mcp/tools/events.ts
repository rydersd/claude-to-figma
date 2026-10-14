/**
 * MCP tools for Figma event streaming.
 *
 * figma_events_subscribe -- start/stop receiving Figma design events
 * figma_events_poll      -- read buffered events with optional filters
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";
import {
  isSubscribed,
  setSubscribed,
  pollEvents,
  getBufferSize,
} from "../events.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {

  // --- figma_events_subscribe ---
  server.tool(
    "figma_events_subscribe",
    "Start or stop receiving Figma design events (selection changes, node mutations, page switches). Events accumulate in a buffer and are read with figma_events_poll.",
    {
      enabled: z.boolean().describe("true to start streaming, false to stop"),
    },
    async ({ enabled }: any) => {
      try {
        if (enabled) {
          const result = await sendCommandToFigma("subscribe_events", {});
          if (result && (result as any).success) {
            setSubscribed(true);
            return {
              content: [{ type: "text", text: "Event streaming started. Use figma_events_poll to read events." }],
            };
          }
          return {
            content: [{ type: "text", text: "Failed to start event streaming on the Figma side." }],
          };
        } else {
          try {
            await sendCommandToFigma("unsubscribe_events", {});
            return {
              content: [{ type: "text", text: "Event streaming stopped." }],
            };
          } finally {
            // Always mark unsubscribed even if the command throws (e.g. timeout),
            // so MCP-side state stays consistent with user intent.
            setSubscribed(false);
          }
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  // --- figma_events_poll ---
  server.tool(
    "figma_events_poll",
    "Read buffered Figma design events. Returns events accumulated since last poll (or since subscribe). Events are drained from the buffer unless peek is true.",
    {
      peek: z.boolean().optional().describe("If true, read events without clearing them from the buffer"),
      eventTypes: z.array(
        z.enum(["selectionchange", "nodechange", "currentpagechange"])
      ).optional().describe("Only return events of these types"),
      since: z.number().optional().describe("Only return events after this timestamp (ms epoch)"),
      limit: z.number().int().positive().optional().describe("Max number of events to return (most recent)"),
      excludePluginOperations: z.boolean().optional().describe("If true, filter out events caused by plugin commands"),
    },
    async ({ peek, eventTypes, since, limit, excludePluginOperations }: any) => {
      const active = isSubscribed();
      const events = pollEvents({ peek, eventTypes, since, limit, excludePluginOperations });

      // Not subscribed and no buffered events — tell the user to subscribe
      if (!active && events.length === 0) {
        return {
          content: [{ type: "text", text: "Not subscribed to events. Call figma_events_subscribe first." }],
        };
      }

      if (events.length === 0) {
        return {
          content: [{ type: "text", text: `No events in buffer. (Buffer size: ${getBufferSize()})` }],
        };
      }

      // If not subscribed but buffer had leftover events, note it alongside the data
      const prefix = active ? "" : "[Note: not currently subscribed — returning buffered events from before disconnect]\n";
      return {
        content: [{ type: "text", text: prefix + JSON.stringify(events, null, 2) }],
      };
    }
  );
}
