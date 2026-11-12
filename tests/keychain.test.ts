import { describe, test, expect } from "bun:test";
import {
  getFigmaToken,
  hasFigmaTokenItem,
  FigmaTokenError,
  type SpawnFn,
} from "../src/llm2figma_mcp/keychain";

const SENTINEL = "figd_SENTINEL_never_print_me";

function fakeSpawn(opts: { stdout?: string; exitCode?: number; hang?: boolean }) {
  const calls: string[][] = [];
  let killed = false;
  const spawn: SpawnFn = (cmd) => {
    calls.push(cmd);
    let resolveExit!: (code: number) => void;
    const exited = new Promise<number>((r) => (resolveExit = r));
    if (!opts.hang) resolveExit(opts.exitCode ?? 0);
    return {
      stdout: new Response(opts.stdout ?? "").body!,
      exited,
      kill: () => { killed = true; resolveExit(143); },
    };
  };
  return { spawn, calls, wasKilled: () => killed };
}

async function errorOf(p: Promise<unknown>): Promise<FigmaTokenError> {
  try { await p; } catch (error) { return error as FigmaTokenError; }
  throw new Error("expected a rejection");
}

describe("getFigmaToken", () => {
  test("returns the stored token with the trailing newline trimmed", async () => {
    const fake = fakeSpawn({ stdout: `${SENTINEL}\n` });
    expect(await getFigmaToken({ spawn: fake.spawn, platform: "darwin" })).toBe(SENTINEL);
    expect(fake.calls[0]).toEqual(["security", "find-generic-password", "-s", "llm2figma", "-a", "figma-api-token", "-w"]);
  });

  test("surrounding whitespace is trimmed and a whitespace-only item counts as missing", async () => {
    expect(await getFigmaToken({ spawn: fakeSpawn({ stdout: `  ${SENTINEL} \r\n\n` }).spawn, platform: "darwin" })).toBe(SENTINEL);
    const error = await errorOf(getFigmaToken({ spawn: fakeSpawn({ stdout: "  \n" }).spawn, platform: "darwin" }));
    expect(error.message).toMatch(/No Figma API token/);
  });

  test("a token with an inner line break or space is refused with fixed text", async () => {
    for (const stdout of [`${SENTINEL}\n${SENTINEL}\n`, `${SENTINEL} x\n`, `${SENTINEL}\u00e9\n`]) {
      const error = await errorOf(getFigmaToken({ spawn: fakeSpawn({ stdout }).spawn, platform: "darwin" }));
      expect(error).toBeInstanceOf(FigmaTokenError);
      expect(error.message).toMatch(/bun run token/);
      expect(error.message).not.toContain("SENTINEL");
    }
  });

  test("reads the Keychain on every call (no caching)", async () => {
    const fake = fakeSpawn({ stdout: SENTINEL });
    await getFigmaToken({ spawn: fake.spawn, platform: "darwin" });
    await getFigmaToken({ spawn: fake.spawn, platform: "darwin" });
    expect(fake.calls.length).toBe(2);
  });

  test("missing item (exit 44) gives the setup message", async () => {
    const error = await errorOf(getFigmaToken({ spawn: fakeSpawn({ exitCode: 44, stdout: SENTINEL }).spawn, platform: "darwin" }));
    expect(error).toBeInstanceOf(FigmaTokenError);
    expect(error.message).toMatch(/No Figma API token.*bun run token/s);
    expect(error.message).not.toContain(SENTINEL);
  });

  test("timeout kills the child and gives the unlock message", async () => {
    const fake = fakeSpawn({ hang: true, stdout: SENTINEL });
    const error = await errorOf(getFigmaToken({ spawn: fake.spawn, platform: "darwin", timeoutMs: 20 }));
    expect(error).toBeInstanceOf(FigmaTokenError);
    expect(error.message).toMatch(/Timed out/);
    expect(fake.wasKilled()).toBe(true);
    expect(error.message).not.toContain(SENTINEL);
  });

  test("other non-zero exits give a fixed message with the exit code only", async () => {
    const error = await errorOf(getFigmaToken({ spawn: fakeSpawn({ exitCode: 51, stdout: SENTINEL }).spawn, platform: "darwin" }));
    expect(error).toBeInstanceOf(FigmaTokenError);
    expect(error.message).toMatch(/code 51/);
    expect(error.message).not.toContain(SENTINEL);
  });

  test("a spawn failure gives the setup message", async () => {
    const spawn: SpawnFn = () => { throw new Error(`spawn failed ${SENTINEL}`); };
    const error = await errorOf(getFigmaToken({ spawn, platform: "darwin" }));
    expect(error).toBeInstanceOf(FigmaTokenError);
    expect(error.message).not.toContain(SENTINEL);
  });

  test("non-macOS gives a message without spawning", async () => {
    const fake = fakeSpawn({ stdout: SENTINEL });
    const error = await errorOf(getFigmaToken({ spawn: fake.spawn, platform: "linux" }));
    expect(error).toBeInstanceOf(FigmaTokenError);
    expect(error.message).toMatch(/macOS Keychain/);
    expect(fake.calls.length).toBe(0);
  });
});

describe("hasFigmaTokenItem", () => {
  test("looks up attributes only (no -w) and reports existence", async () => {
    const found = fakeSpawn({ stdout: "keychain: ..." });
    expect(await hasFigmaTokenItem({ spawn: found.spawn, platform: "darwin" })).toBe(true);
    expect(found.calls[0]).not.toContain("-w");
    expect(await hasFigmaTokenItem({ spawn: fakeSpawn({ exitCode: 44 }).spawn, platform: "darwin" })).toBe(false);
    expect(await hasFigmaTokenItem({ spawn: fakeSpawn({ hang: true }).spawn, platform: "darwin", timeoutMs: 20 })).toBe(false);
    expect(await hasFigmaTokenItem({ platform: "linux" })).toBe(false);
  });
});
