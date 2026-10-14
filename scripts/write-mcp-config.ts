import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export function makeMcpConfig(previous: any, bunPath: string, repoRoot: string, stamp: any) {
  const servers = { ...(previous?.mcpServers || {}) };
  // Preserve existing client entry names and library credentials on regeneration.
  const key = servers.ClaudeToFigma && !servers.LLM2Figma ? "ClaudeToFigma" : "LLM2Figma";
  servers[key] = {
    ...servers[key], type: "stdio", command: bunPath,
    args: [resolve(repoRoot, "src/claude_to_figma_mcp/server.ts")],
    env: servers[key]?.env || {},
  };
  return { ...previous, mcpServers: servers, _generatedFor: stamp };
}

if (import.meta.main) {
  const [repoRoot, bunPath, hostname, user, generatedAt] = process.argv.slice(2);
  const path = resolve(repoRoot, ".mcp.json");
  let previous: any = {};
  try { previous = JSON.parse(await readFile(path, "utf8")); }
  catch (error: any) { if (error.code !== "ENOENT") throw error; }
  await writeFile(path, JSON.stringify(makeMcpConfig(previous, bunPath, repoRoot, { hostname, user, generatedAt }), null, 2) + "\n");
}
