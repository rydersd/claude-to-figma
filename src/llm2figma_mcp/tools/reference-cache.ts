import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export class ReferenceCache {
  private entries = new Map<string, { scope: string; key: string; json: string; expiresAt: number }>();
  constructor(private now = Date.now) {}
  private purge() {
    for (const [id, entry] of this.entries) if (entry.expiresAt <= this.now()) this.entries.delete(id);
  }
  set(scope: string, key: string, data: unknown, ttlSeconds = 1800) {
    const json = JSON.stringify(data);
    if (!json || new TextEncoder().encode(json).length > 65536) throw new Error("Reference data must fit within 64KB");
    this.purge();
    const id = JSON.stringify([scope, key]);
    this.entries.delete(id);
    if (this.entries.size >= 64) this.entries.delete(this.entries.keys().next().value!);
    const expiresAt = this.now() + ttlSeconds * 1000;
    this.entries.set(id, { scope, key, json, expiresAt });
    return { scope, key, cached: true, expiresAt };
  }
  get(scope: string, key: string) {
    this.purge();
    const entry = this.entries.get(JSON.stringify([scope, key]));
    return entry ? { scope, key, found: true, expiresAt: entry.expiresAt, data: JSON.parse(entry.json) } : { scope, key, found: false };
  }
  list(scope: string) {
    this.purge();
    return [...this.entries.values()].filter(entry => entry.scope === scope).map(({ key, expiresAt }) => ({ key, expiresAt }));
  }
  clear(scope: string, key?: string) {
    let cleared = 0;
    for (const [id, entry] of this.entries) {
      if (entry.scope === scope && (key === undefined || key === entry.key)) { this.entries.delete(id); cleared++; }
    }
    return { scope, cleared };
  }
}

export function registerTools(server: McpServer) {
  const cache = new ReferenceCache();
  server.tool("reference_cache", "Reuse palettes, font choices, component/root IDs, layout helper snippets, and already-read skill guidance within this MCP session. Scope every entry to a file/page or task ID. Entries expire after 30 minutes by default; refresh after library updates, deletions, or reference changes. List returns keys only. Max 64 entries, 64KB each; oldest entries are evicted.", {
    action: z.enum(["get", "set", "list", "clear"]),
    scope: z.string().min(1).max(200).describe("Figma file/page ID or explicit task ID; use the same scope on every call"),
    key: z.string().min(1).max(100).optional().describe("Reference name, e.g. design-system or composition-ids; required for get/set"),
    data: z.record(z.unknown()).optional().describe("Reference snapshot for set; keep only reusable properties"),
    ttlSeconds: z.number().int().min(1).max(3600).optional(),
  }, async ({ action, scope, key, data, ttlSeconds }) => {
    try {
      if ((action === "set" || action === "get") && !key) throw new Error("key is required for get/set");
      if (action === "set" && data === undefined) throw new Error("data is required for set");
      const result = action === "set" ? cache.set(scope, key!, data, ttlSeconds)
        : action === "get" ? cache.get(scope, key!)
        : action === "list" ? { scope, entries: cache.list(scope) }
        : cache.clear(scope, key);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    } catch (error) {
      return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }] };
    }
  });
}
