/**
 * bun setup links the draw-in-figma skill into the user's skills folder for a
 * clone install, keeps an existing link, and never replaces anything else.
 * Runs setup.sh against a temp HOME with a fake bun install.
 *   bun test tests/setup-skill.test.ts
 */
import { describe, expect, test } from "bun:test";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function runSetup(prepare?: (home: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "llm2figma-skill-"));
  const repo = join(dir, "repo");
  const home = join(dir, "home");
  const bin = join(dir, "bin");
  mkdirSync(join(repo, "src", "llm2figma_mcp"), { recursive: true });
  mkdirSync(home); mkdirSync(bin);
  cpSync(resolve("scripts"), join(repo, "scripts"), { recursive: true });
  cpSync(resolve("src/shared"), join(repo, "src", "shared"), { recursive: true });
  cpSync(resolve("plugin/skills/draw-in-figma"), join(repo, "plugin", "skills", "draw-in-figma"), { recursive: true });
  writeFileSync(join(bin, "bun"), `#!/bin/bash\nif [ "$1" = install ]; then exit 0; fi\nexec ${JSON.stringify(process.execPath)} "$@"\n`, { mode: 0o755 });
  prepare?.(home);
  const result = Bun.spawnSync(["/bin/bash", join(repo, "scripts", "setup.sh")], { env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home } });
  return { dir, repo, home, exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

describe("setup links the draw-in-figma skill", () => {
  test("creates the link, and a second run keeps it", () => {
    const first = runSetup();
    try {
      const dst = join(first.home, ".claude", "skills", "draw-in-figma");
      expect(first.exitCode).toBe(0);
      expect(lstatSync(dst).isSymbolicLink()).toBe(true);
      expect(readlinkSync(dst)).toBe(join(first.repo, "plugin", "skills", "draw-in-figma"));
      expect(existsSync(join(dst, "SKILL.md"))).toBe(true);
      const again = Bun.spawnSync(["/bin/bash", join(first.repo, "scripts", "setup.sh")], { env: { PATH: `${join(first.dir, "bin")}:/usr/bin:/bin`, HOME: first.home } });
      expect(again.exitCode).toBe(0);
      expect(again.stdout.toString()).toContain("already linked");
    } finally { rmSync(first.dir, { recursive: true }); }
  });

  test("leaves an existing skill folder alone", () => {
    const run = runSetup((home) => {
      mkdirSync(join(home, ".claude", "skills", "draw-in-figma"), { recursive: true });
      writeFileSync(join(home, ".claude", "skills", "draw-in-figma", "SKILL.md"), "mine");
    });
    try {
      const dst = join(run.home, ".claude", "skills", "draw-in-figma");
      expect(run.exitCode).toBe(0);
      expect(lstatSync(dst).isSymbolicLink()).toBe(false);
      expect(Bun.file(join(dst, "SKILL.md")).size).toBe(4);
      expect(run.stdout).toContain("left it as it is");
    } finally { rmSync(run.dir, { recursive: true }); }
  });
});
