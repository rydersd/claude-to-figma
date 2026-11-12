// Figma file key handling for L2F_FILE_KEY: turning what a user pastes into a
// key, and merging it with the key the plugin reports.

const FILE_KEY = /^[A-Za-z0-9]{10,}$/;

// Accepts a bare file key or a figma.com URL (design, file, board, slides...).
// A /branch/<branchKey>/ URL gives the branch key. Throws when no valid key is found.
export function parseFileKey(input: string): string {
  const text = input.trim();
  let key: string | undefined = text;
  if (/[/.]/.test(text)) {
    key = undefined;
    try {
      const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
      if (/^(www\.)?figma\.com$/i.test(url.hostname)) {
        const [, fileKey, branch, branchKey] = url.pathname.split("/").filter(Boolean);
        key = branch === "branch" ? branchKey : fileKey;
      }
    } catch {
      // Not a URL: reported as invalid below.
    }
  }
  if (!key || !FILE_KEY.test(key)) {
    throw new Error("Invalid Figma file key: pass the key itself or a figma.com file URL (figma.com/design/<key>/...).");
  }
  return key;
}

// Adds fileKey and fileKeySource to a get_document_info result: the plugin's
// key wins, else the user's. When the feature is off both fields are removed,
// so the output is what it was before the feature existed.
export function mergeFileKey(result: unknown, userKey: string | undefined, enabled: boolean): unknown {
  if (!result || typeof result !== "object") return result;
  const { fileKey: pluginKey, fileKeySource: _ignored, ...rest } = result as Record<string, unknown>;
  if (!enabled) return rest;
  if (typeof pluginKey === "string" && pluginKey) return { ...rest, fileKey: pluginKey, fileKeySource: "plugin" };
  if (userKey) return { ...rest, fileKey: userKey, fileKeySource: "user" };
  return { ...rest, fileKey: null, fileKeySource: null };
}
