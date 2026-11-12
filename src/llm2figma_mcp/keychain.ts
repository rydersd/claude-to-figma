// Reads the Figma API token from the macOS Keychain at call time. Nothing is cached,
// so a rotated token takes effect on the next call. The token is never logged or put
// in an error message; failures carry fixed setup text only.

export const KEYCHAIN_SERVICE = "llm2figma";
export const KEYCHAIN_ACCOUNT = "figma-api-token";
export const KEYCHAIN_TIMEOUT_MS = 10_000;

export interface SecurityProcess {
  stdout: ReadableStream<Uint8Array>;
  exited: Promise<number>;
  kill(): void;
}
export type SpawnFn = (cmd: string[]) => SecurityProcess;
export interface KeychainOptions {
  spawn?: SpawnFn;
  platform?: string;
  timeoutMs?: number;
}

export class FigmaTokenError extends Error {}

export const TOKEN_SETUP_HELP =
  "Store a Figma personal access token (Figma → Settings → Security → Personal access tokens; scopes " +
  "'File content: read', 'Library content: read', 'file_comments:read', 'file_comments:write') in the " +
  "macOS Keychain with `bun run token` in the llm2figma repo, or: " +
  `security add-generic-password -U -s ${KEYCHAIN_SERVICE} -a ${KEYCHAIN_ACCOUNT} -w (it prompts for the token).`;

// Argument array, no shell; stderr is discarded so nothing it says can reach a message.
const defaultSpawn: SpawnFn = (cmd) => Bun.spawn(cmd, { stdin: "ignore", stdout: "pipe", stderr: "ignore" });

async function runSecurity(args: string[], opts: KeychainOptions): Promise<{ code: number | "timeout"; stdout: string }> {
  const proc = (opts.spawn ?? defaultSpawn)(["security", ...args]);
  const output = new Response(proc.stdout).text();
  output.catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), opts.timeoutMs ?? KEYCHAIN_TIMEOUT_MS);
  });
  try {
    const code = await Promise.race([proc.exited, timedOut]);
    if (code === "timeout") {
      proc.kill();
      return { code, stdout: "" };
    }
    return { code, stdout: await output };
  } finally {
    clearTimeout(timer);
  }
}

function lookupArgs(): string[] {
  return ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_ACCOUNT];
}

/** The stored token, or a FigmaTokenError with setup text. Never cached. */
export async function getFigmaToken(opts: KeychainOptions = {}): Promise<string> {
  const platform = opts.platform ?? process.platform;
  if (platform !== "darwin") {
    throw new FigmaTokenError(
      `The Figma API token is read from the macOS Keychain, which isn't available on ${platform}. ` +
        "Tools that call the Figma REST API are unavailable here."
    );
  }
  let result: { code: number | "timeout"; stdout: string };
  try {
    result = await runSecurity([...lookupArgs(), "-w"], opts);
  } catch {
    throw new FigmaTokenError(`Could not run the macOS security tool to read the Figma API token. ${TOKEN_SETUP_HELP}`);
  }
  if (result.code === "timeout") {
    throw new FigmaTokenError(
      "Timed out reading the Figma API token from the Keychain. If macOS asked for Keychain access, " +
        "unlock it and click Allow (or Always Allow), then retry."
    );
  }
  const token = result.stdout.trim();
  if (result.code === 44 || (result.code === 0 && !token)) {
    throw new FigmaTokenError(`No Figma API token in the Keychain. ${TOKEN_SETUP_HELP}`);
  }
  if (result.code !== 0) {
    throw new FigmaTokenError(
      `Could not read the Figma API token from the Keychain (security exited with code ${result.code}; ` +
        `the Keychain may be locked or access was denied). ${TOKEN_SETUP_HELP}`
    );
  }
  // Anything but printable ASCII would be rejected as a header value, and the runtime's
  // error for that quotes the value.
  if (!/^[\x21-\x7e]+$/.test(token)) {
    throw new FigmaTokenError(
      "The Figma API token in the Keychain contains spaces, line breaks or other characters a token never has. " +
        "Store it again with `bun run token`."
    );
  }
  return token;
}

/** Whether the Keychain item exists. Reads attributes only (no -w), never the token. */
export async function hasFigmaTokenItem(opts: KeychainOptions = {}): Promise<boolean> {
  if ((opts.platform ?? process.platform) !== "darwin") return false;
  try {
    return (await runSecurity(lookupArgs(), opts)).code === 0;
  } catch {
    return false;
  }
}
