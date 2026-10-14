import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export function makeMcpConfig(previous: any, bunPath: string, repoRoot: string, stamp: any) {
  const servers = { ...(previous?.mcpServers || {}) };
  // Migrate the entry name while preserving credentials and unrelated servers.
  const previousServer = { ...servers.ClaudeToFigma, ...servers.LLM2Figma };
  const env = { ...servers.ClaudeToFigma?.env, ...servers.LLM2Figma?.env };
  delete servers.ClaudeToFigma;
  servers.LLM2Figma = {
    ...previousServer, type: "stdio", command: bunPath,
    args: [resolve(repoRoot, "src/llm2figma_mcp/server.ts")],
    env,
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
