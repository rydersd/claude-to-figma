/**
 * Live REST smoke test — hits api.figma.com with real credentials.
 * Runs only when FIGMA_API_TOKEN and FIGMA_LIBRARY_FILE_KEYS are set:
 *   bun test tests/library-live.test.ts
 */

import { describe, test, expect } from "bun:test";
import { loadLibraryIndex, getLibraryConfig } from "../src/claude_to_figma_mcp/tools/library";

const configured = (() => {
  const { token, fileKeys } = getLibraryConfig();
  return Boolean(token && fileKeys.length > 0);
})();

describe("live library fetch", () => {
  test.skipIf(!configured)("indexes at least one component set with keys", async () => {
    const index = await loadLibraryIndex({ refresh: true });
    expect(index.length).toBeGreaterThan(0);
    expect(index[0].variants[0].key).toBeTruthy();
    console.error(`Indexed ${index.length} sets from ${index[0].libraryName}`);
  });
});
