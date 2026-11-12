/**
 * Live REST smoke test — hits api.figma.com with the token stored in the macOS Keychain
 * (`bun run token`). Runs only when FIGMA_LIBRARY_FILE_KEYS is set:
 *   FIGMA_LIBRARY_FILE_KEYS=<key> bun test tests/library-live.test.ts
 */

import { describe, test, expect } from "bun:test";
import { loadLibraryIndex, getLibraryConfig } from "../src/llm2figma_mcp/tools/library";

const configured = getLibraryConfig().fileKeys.length > 0;

describe("live library fetch", () => {
  test.skipIf(!configured)("indexes at least one component set with keys", async () => {
    const index = await loadLibraryIndex({ refresh: true });
    expect(index.length).toBeGreaterThan(0);
    expect(index[0].variants[0].key).toBeTruthy();
    console.error(`Indexed ${index.length} sets from ${index[0].libraryName}`);
  });
});
