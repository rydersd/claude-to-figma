import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function runLauncher(listener: boolean, response: string) {
  const directory = mkdtempSync(join(tmpdir(), "llm2figma-launcher-"));
  const bin = join(directory, "bin");
  mkdirSync(bin);
  const script = (name: string, body: string) => writeFileSync(join(bin, name), "#!/bin/bash\n" + body, { mode: 0o755 });
  script("bun", "exit 0\n");
  script("lsof", listener ? "exit 0\n" : "exit 1\n");
  script("curl", "printf '%s' \"$LAUNCHER_TEST_RESPONSE\"\n");
  // Capture intended invocation; no actual GUI interaction in these tests.
  script("osascript", "printf 'LAUNCH:%s\\n' \"$@\"\n");
  try {
    const result = Bun.spawnSync(["/bin/bash", resolve("scripts/l2f.sh")], {
      env: { ...process.env, PATH: bin + ":" + process.env.PATH, LAUNCHER_TEST_RESPONSE: response },
    });
    return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
  } finally { rmSync(directory, { recursive: true }); }
}

describe("l2f launcher", () => {
  test("reuses a running relay without starting another window", () => {
    const result = runLauncher(true, "WebSocket server running");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("already running");
    expect(result.stdout).not.toContain("LAUNCH:");
  });
  test("reports an unrelated listener without stopping it", () => {
    const result = runLauncher(true, "Another service");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("another service");
    expect(result.stdout).not.toContain("LAUNCH:");
  });
  test("launches the relay with the resolved Bun path when the port is free", () => {
    const result = runLauncher(false, "");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("LAUNCH:cd ");
    expect(result.stdout).toContain("/bin/bun socket");
  });
});
