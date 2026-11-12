import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FEATURES } from "../src/shared/flags";

// Pass each L2F_* flag through from the shell that starts Claude Code. The :- default keeps an unset flag empty (off) instead of failing config expansion.
const flagRefs = Object.fromEntries(FEATURES.map(f => [`L2F_${f}`, `\${L2F_${f}:-}`]));
export const FLAG_ENV_KEYS = ["L2F_ALL", ...FEATURES.map(f => `L2F_${f}`)];

// Arguments after the server entry path that the server reads (--server=…).
// The entry path is the first non-flag argument (after an optional runner
// subcommand such as `run`); only flags that follow it are carried over.
function connectionArgs(args: unknown): string[] {
  if (!Array.isArray(args)) return [];
  const first = args.findIndex((a) => typeof a === "string" && !a.startsWith("-"));
  if (first < 0) return [];
  return args.slice(first + 1).filter((a): a is string => typeof a === "string" && a.startsWith("-"));
}

/**
 * The LLM2Figma server entry built from any existing LLM2Figma or legacy
 * ClaudeToFigma entry: keeps env, extra fields and connection flags, and
 * replaces only the bun path and the server entry path.
 */
export function migrateServerEntry(servers: any, bunPath: string, serverPath: string) {
  const previousServer = { ...servers?.ClaudeToFigma, ...servers?.LLM2Figma };
  const env = { L2F_ALL: "${L2F_ALL:-}", ...flagRefs, ...servers?.ClaudeToFigma?.env, ...servers?.LLM2Figma?.env };
  // The Figma token lives in the macOS Keychain only; drop any copy an earlier setup left here.
  delete env.FIGMA_API_TOKEN;
  return {
    ...previousServer, type: "stdio", command: bunPath,
    args: [serverPath, ...connectionArgs(previousServer.args)],
    env,
  };
}

export function makeMcpConfig(previous: any, bunPath: string, repoRoot: string, stamp: any) {
  const servers = { ...(previous?.mcpServers || {}) };
  // Migrate the entry name while preserving credentials and unrelated servers.
  servers.LLM2Figma = migrateServerEntry(servers, bunPath, resolve(repoRoot, "src/llm2figma_mcp/server.ts"));
  delete servers.ClaudeToFigma;
  return { ...previous, mcpServers: servers, _generatedFor: stamp };
}

async function readJson(path: string): Promise<any> {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error: any) { if (error.code !== "ENOENT") throw error; return {}; }
}

if (import.meta.main) {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === "--user-entry") {
    // Print the user-scope LLM2Figma entry migrated from ~/.claude.json.
    const [claudeJson, bunPath, serverPath] = rest;
    const user = await readJson(claudeJson);
    console.log(JSON.stringify(migrateServerEntry(user.mcpServers, bunPath, serverPath)));
  } else if (mode === "--user-get") {
    // Print a user-scope server entry as JSON, or nothing when absent.
    const [claudeJson, name] = rest;
    const entry = (await readJson(claudeJson)).mcpServers?.[name];
    if (entry) console.log(JSON.stringify(entry));
  } else {
    const [repoRoot, bunPath, hostname, user, generatedAt] = [mode, ...rest];
    const path = resolve(repoRoot, ".mcp.json");
    const previous = await readJson(path);
    await writeFile(path, JSON.stringify(makeMcpConfig(previous, bunPath, repoRoot, { hostname, user, generatedAt }), null, 2) + "\n");
  }
}
