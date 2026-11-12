/**
 * MCP config regeneration and user-scope migration (review findings #6 and #7).
 * No network, no relay, no real Claude config: setup.sh runs against a temp
 * HOME with fake `claude` and `bun install`.
 *   bun test tests/mcp-config.test.ts
 */
import { describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { makeMcpConfig, migrateServerEntry } from "../scripts/write-mcp-config";

describe("makeMcpConfig keeps connection arguments (finding #7)", () => {
  test("keeps --server=… after the server path and replaces only bun and the entry path", () => {
    const previous = { mcpServers: { LLM2Figma: { type: "stdio", command: "/old/bun", args: ["/old/server.ts", "--server=relay.example.com"] } } };
    const config = makeMcpConfig(previous, "/new/bun", "/repo", {});
    expect(config.mcpServers.LLM2Figma.command).toBe("/new/bun");
    expect(config.mcpServers.LLM2Figma.args).toEqual(["/repo/src/llm2figma_mcp/server.ts", "--server=relay.example.com"]);
  });

  test("migrates legacy ClaudeToFigma args and env", () => {
    const previous = { mcpServers: { ClaudeToFigma: { command: "bun", args: ["/old/src/talk_to_figma_mcp/server.ts", "--server=relay.example.com"], env: { FIGMA_API_TOKEN: "t" } } } };
    const config = makeMcpConfig(previous, "/bun", "/repo", {});
    expect(config.mcpServers.LLM2Figma.args).toEqual(["/repo/src/llm2figma_mcp/server.ts", "--server=relay.example.com"]);
    expect(config.mcpServers.LLM2Figma.env).toEqual({ FIGMA_API_TOKEN: "t" });
    expect(config.mcpServers.ClaudeToFigma).toBeUndefined();
  });

  test("drops a leading runner subcommand but keeps later flags", () => {
    const entry = migrateServerEntry({ LLM2Figma: { command: "bun", args: ["run", "/old/server.ts", "--server=a.example"] } }, "/bun", "/srv.ts");
    expect(entry.args).toEqual(["/srv.ts", "--server=a.example"]);
  });

  test("a fresh config has no extra args", () => {
    expect(makeMcpConfig({}, "/bun", "/repo", {}).mcpServers.LLM2Figma.args).toEqual(["/repo/src/llm2figma_mcp/server.ts"]);
  });
});

// setup.sh --user, against a temp HOME. The fake `claude` keeps user-scope
// servers in $HOME/.claude.json like the real CLI and logs each call.
function runSetupUser(claudeJson: any, opts: { failAddJson?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "llm2figma-setup-"));
  const repo = join(dir, "repo");
  const home = join(dir, "home");
  const bin = join(dir, "bin");
  mkdirSync(join(repo, "src", "llm2figma_mcp"), { recursive: true });
  mkdirSync(home);
  mkdirSync(bin);
  cpSync(resolve("scripts"), join(repo, "scripts"), { recursive: true });
  writeFileSync(join(home, ".claude.json"), JSON.stringify(claudeJson));
  const realBun = process.execPath;
  writeFileSync(join(bin, "bun"), `#!/bin/bash\nif [ "$1" = install ]; then exit 0; fi\nexec ${JSON.stringify(realBun)} "$@"\n`, { mode: 0o755 });
  writeFileSync(join(bin, "claude"), `#!/bin/bash
echo "$*" >> "$HOME/claude-calls.log"
${JSON.stringify(realBun)} -e '
const fs = require("fs");
const file = process.env.HOME + "/.claude.json";
const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
cfg.mcpServers ||= {};
const a = process.argv.slice(process.argv.indexOf("mcp"));
const args = a.filter((x, i) => !(x === "--scope" || a[i - 1] === "--scope"));
const [mcp, cmd, name, json] = args;
// Fail only the first registration, like a transient CLI error.
const marker = process.env.HOME + "/add-failed";
if ((cmd === "add" || cmd === "add-json") && process.env.FAIL_ADD_JSON && !fs.existsSync(marker)) {
  fs.writeFileSync(marker, ""); process.exit(1);
}
if (cmd === "add-json") {
  if (cfg.mcpServers[name]) { console.error("exists"); process.exit(1); }
  cfg.mcpServers[name] = JSON.parse(json);
} else if (cmd === "add") {
  const sep = args.indexOf("--");
  if (cfg.mcpServers[name]) { console.error("exists"); process.exit(1); }
  cfg.mcpServers[name] = { type: "stdio", command: args[sep + 1], args: args.slice(sep + 2), env: {} };
} else if (cmd === "remove") {
  if (!cfg.mcpServers[name]) process.exit(1);
  delete cfg.mcpServers[name];
} else if (cmd === "get") {
  process.exit(cfg.mcpServers[name] ? 0 : 1);
} else { console.error("unsupported", args.join(" ")); process.exit(2); }
fs.writeFileSync(file, JSON.stringify(cfg));
' -- "$@"
`, { mode: 0o755 });
  try {
    const result = Bun.spawnSync(["/bin/bash", join(repo, "scripts", "setup.sh"), "--user"], {
      env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home, ...(opts.failAddJson ? { FAIL_ADD_JSON: "1" } : {}) },
    });
    const calls = existsSync(join(home, "claude-calls.log")) ? readFileSync(join(home, "claude-calls.log"), "utf8").trim().split("\n") : [];
    return {
      exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString(),
      config: JSON.parse(readFileSync(join(home, ".claude.json"), "utf8")), calls, repo,
    };
  } finally { rmSync(dir, { recursive: true }); }
}

describe("setup.sh --user migration (finding #6)", () => {
  test("preserves the legacy entry's env and --server arg, removing it only after LLM2Figma exists", () => {
    const legacy = { type: "stdio", command: "/old/bun", args: ["/old/server.ts", "--server=relay.example.com"], env: { FIGMA_API_TOKEN: "secret", FIGMA_LIBRARY_FILE_KEYS: "abc" } };
    const result = runSetupUser({ mcpServers: { ClaudeToFigma: legacy, Other: { command: "x" } } });
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
    const entry = result.config.mcpServers.LLM2Figma;
    expect(entry.env).toEqual(legacy.env);
    expect(entry.args).toEqual([join(result.repo, "src/llm2figma_mcp/server.ts"), "--server=relay.example.com"]);
    expect(result.config.mcpServers.ClaudeToFigma).toBeUndefined();
    expect(result.config.mcpServers.Other).toEqual({ command: "x" });
    const addAt = result.calls.findIndex((c) => c.startsWith("mcp add-json"));
    const removeLegacyAt = result.calls.findIndex((c) => c.includes("remove") && c.includes("ClaudeToFigma"));
    expect(addAt).toBeGreaterThanOrEqual(0);
    expect(removeLegacyAt).toBeGreaterThan(addAt);
  });

  test("keeps the legacy entry and restores the previous LLM2Figma entry when registration fails", () => {
    const legacy = { command: "/old/bun", args: ["/old/server.ts"], env: { FIGMA_API_TOKEN: "secret" } };
    const current = { command: "/old/bun", args: ["/older/server.ts", "--server=b.example"], env: { FIGMA_API_TOKEN: "newer" } };
    const result = runSetupUser({ mcpServers: { ClaudeToFigma: legacy, LLM2Figma: current } }, { failAddJson: true });
    expect(result.exitCode).not.toBe(0);
    expect(result.config.mcpServers.ClaudeToFigma).toEqual(legacy);
    expect(result.config.mcpServers.LLM2Figma).toEqual(current);
  });
});
