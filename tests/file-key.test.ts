/**
 * File key (L2F_FILE_KEY): URL-to-key parsing, the per-channel key map, merge
 * precedence in get_document_info, and the flag-off output and schema.
 * Pure logic, no Figma or relay needed:
 *   bun test tests/file-key.test.ts
 */
import { describe, expect, test } from "bun:test";
import { mergeFileKey, parseFileKey } from "../src/llm2figma_mcp/file-key";
import { clearChannelFileKeys, getChannelFileKey, handlePeerLeft, setChannelFileKey } from "../src/llm2figma_mcp/connection";
import { registerTools as registerDocumentTools } from "../src/llm2figma_mcp/tools/document";
import { registerTools as registerNavigationTools } from "../src/llm2figma_mcp/tools/navigation";
import { getDocumentInfo } from "../src/llm2figma_plugin/src/document";

const KEY = "AbC123xyz789QrStUv";
const BRANCH = "Br4nchKey00112233";
const ON = { L2F_FILE_KEY: "1" };

function capture(register: (server: any) => void) {
  const tools: Record<string, { schema: Record<string, unknown>; run: (args: any) => Promise<any> }> = {};
  register({ tool: (name: string, _description: string, schema: any, run: any) => { tools[name] = { schema, run }; } });
  return tools;
}

describe("parseFileKey", () => {
  test("a bare key is returned as is", () => {
    expect(parseFileKey(KEY)).toBe(KEY);
    expect(parseFileKey(`  ${KEY}\n`)).toBe(KEY);
  });
  test("design, file, board and slides URLs give the file key", () => {
    for (const kind of ["design", "file", "board", "slides"]) {
      expect(parseFileKey(`https://www.figma.com/${kind}/${KEY}/My-File`)).toBe(KEY);
    }
    expect(parseFileKey(`https://figma.com/design/${KEY}`)).toBe(KEY);
    expect(parseFileKey(`figma.com/design/${KEY}/My-File`)).toBe(KEY);
  });
  test("query strings and fragments are ignored", () => {
    expect(parseFileKey(`https://www.figma.com/design/${KEY}/My-File?node-id=1-2&t=abcDEF123-1`)).toBe(KEY);
    expect(parseFileKey(`https://www.figma.com/design/${KEY}?node-id=1-2#frag`)).toBe(KEY);
  });
  test("only file URLs over http(s) are accepted", () => {
    const id = "1234567890123456789";
    for (const bad of [
      `https://www.figma.com/files/${id}/recents-and-sharing`, `https://www.figma.com/team/${id}`,
      `https://www.figma.com/exit/${KEY}`, `https://www.figma.com/@someone/${KEY}`,
      `ftp://figma.com/design/${KEY}`, `javascript://figma.com/design/${KEY}`, "a".repeat(500),
    ]) expect(() => parseFileKey(bad)).toThrow("Invalid Figma file key");
  });
  test("embed URLs and a file named \"branch\" give the file key", () => {
    expect(parseFileKey(`https://embed.figma.com/design/${KEY}/My-File`)).toBe(KEY);
    expect(parseFileKey(`https://www.figma.com/design/${KEY}/branch?node-id=1-2`)).toBe(KEY);
  });
  test("a branch URL gives the branch key", () => {
    expect(parseFileKey(`https://www.figma.com/design/${KEY}/branch/${BRANCH}/My-File?node-id=1-2`)).toBe(BRANCH);
    expect(parseFileKey(`https://www.figma.com/file/${KEY}/branch/${BRANCH}`)).toBe(BRANCH);
  });
  test("invalid keys are rejected", () => {
    for (const bad of ["", "   ", "short", "has-dash-in-the-key", "has space in key", "key_with_underscore"]) {
      expect(() => parseFileKey(bad)).toThrow("Invalid Figma file key");
    }
  });
  test("URLs that are not Figma file URLs are rejected", () => {
    expect(() => parseFileKey(`https://example.com/design/${KEY}/My-File`)).toThrow("Invalid Figma file key");
    expect(() => parseFileKey(`https://notfigma.com/design/${KEY}`)).toThrow("Invalid Figma file key");
    expect(() => parseFileKey("https://www.figma.com/design/short/My-File")).toThrow("Invalid Figma file key");
    expect(() => parseFileKey("https://www.figma.com/files/recents-and-sharing")).toThrow("Invalid Figma file key");
    expect(() => parseFileKey(`https://www.figma.com/design/${KEY}/branch/bad-key/My-File`)).toThrow("Invalid Figma file key");
  });
});

describe("mergeFileKey", () => {
  const info = { name: "Page 1", editorType: "figma" };
  test("the plugin's key wins over the user's", () => {
    expect(mergeFileKey({ ...info, fileKey: KEY }, BRANCH, true)).toEqual({ ...info, fileKey: KEY, fileKeySource: "plugin" });
  });
  test("the user's key is used when the plugin has none", () => {
    expect(mergeFileKey({ ...info, fileKey: null }, BRANCH, true)).toEqual({ ...info, fileKey: BRANCH, fileKeySource: "user" });
    expect(mergeFileKey(info, BRANCH, true)).toEqual({ ...info, fileKey: BRANCH, fileKeySource: "user" });
  });
  test("with neither, both fields are null", () => {
    expect(mergeFileKey({ ...info, fileKey: null }, undefined, true)).toEqual({ ...info, fileKey: null, fileKeySource: null });
  });
  test("flag off strips both fields and leaves the rest unchanged", () => {
    expect(mergeFileKey({ ...info, fileKey: KEY, fileKeySource: "plugin" }, BRANCH, false)).toEqual(info);
    expect(mergeFileKey(info, BRANCH, false)).toEqual(info);
  });
  test("a non-object result passes through", () => {
    expect(mergeFileKey(null, BRANCH, true)).toBe(null);
    expect(mergeFileKey([1, 2], BRANCH, false)).toEqual([1, 2]);
  });
});

describe("per-channel key map", () => {
  test("a key set for one channel is not visible from another", () => {
    setChannelFileKey("iso-a", KEY);
    setChannelFileKey("iso-b", BRANCH);
    expect(getChannelFileKey("iso-a")).toBe(KEY);
    expect(getChannelFileKey("iso-b")).toBe(BRANCH);
    expect(getChannelFileKey("iso-c")).toBeUndefined();
  });
  test("a plugin leaving drops its channel's key; another peer leaving does not", () => {
    setChannelFileKey("left-a", KEY);
    handlePeerLeft({ role: "mcp", channel: "left-a" });
    expect(getChannelFileKey("left-a")).toBe(KEY);
    handlePeerLeft({ role: "plugin", channel: "left-b" });
    expect(getChannelFileKey("left-a")).toBe(KEY);
    handlePeerLeft({ role: "plugin", channel: "left-a" });
    expect(getChannelFileKey("left-a")).toBeUndefined();
  });
  test("a relay reconnect drops every key", () => {
    setChannelFileKey("re-a", KEY);
    setChannelFileKey("re-b", BRANCH);
    clearChannelFileKeys();
    expect(getChannelFileKey("re-a")).toBeUndefined();
    expect(getChannelFileKey("re-b")).toBeUndefined();
  });
  test("no channel joined means no key", () => {
    expect(getChannelFileKey(null)).toBeUndefined();
  });
});

describe("join_channel", () => {
  const joined: string[] = [];
  const channels = {
    joinChannel: async (name: string) => { joined.push(name); },
    autoJoinChannel: async () => "auto-chan",
  };
  const tools = (env: Record<string, string | undefined>) =>
    capture((server) => registerNavigationTools(server, async () => ({}), env, channels));

  test("flag off: the schema has no fileKey parameter", () => {
    expect(Object.keys(tools({}).join_channel.schema)).toEqual(["channel"]);
  });
  test("flag on: the schema has an optional fileKey", () => {
    const schema = tools(ON).join_channel.schema as any;
    expect(Object.keys(schema)).toEqual(["channel", "fileKey"]);
    expect(schema.fileKey.isOptional()).toBe(true);
  });
  test("flag on: a URL is stored as its key for the joined channel only", async () => {
    const result = await tools(ON).join_channel.run({ channel: "join-a", fileKey: `https://www.figma.com/design/${KEY}/Name?node-id=1-2` });
    expect(result.content[0].text).toContain("Successfully joined channel: join-a");
    expect(getChannelFileKey("join-a")).toBe(KEY);
    expect(getChannelFileKey("join-other")).toBeUndefined();
  });
  test("flag on: an auto-joined channel gets the key", async () => {
    await tools(ON).join_channel.run({ channel: "", fileKey: BRANCH });
    expect(getChannelFileKey("auto-chan")).toBe(BRANCH);
  });
  test("flag on: joining again without a key keeps the stored one", async () => {
    await tools(ON).join_channel.run({ channel: "join-a" });
    expect(getChannelFileKey("join-a")).toBe(KEY);
  });
  test("flag on: an invalid key is reported and the channel is not joined", async () => {
    joined.length = 0;
    const result = await tools(ON).join_channel.run({ channel: "join-bad", fileKey: "not a key" });
    expect(result.content[0].text).toContain("Invalid Figma file key");
    expect(joined).toEqual([]);
    expect(getChannelFileKey("join-bad")).toBeUndefined();
  });
  test("flag on: an empty fileKey is treated as absent and the channel is joined", async () => {
    const result = await tools(ON).join_channel.run({ channel: "join-empty", fileKey: "" });
    expect(result.content[0].text).toContain("Successfully joined channel: join-empty");
    expect(getChannelFileKey("join-empty")).toBeUndefined();
  });
  test("flag off: a client-sent fileKey is ignored", async () => {
    const result = await tools({}).join_channel.run({ channel: "join-off", fileKey: KEY });
    expect(result.content[0].text).toContain("Successfully joined channel: join-off");
    expect(getChannelFileKey("join-off")).toBeUndefined();
  });
});

describe("get_document_info", () => {
  const pluginInfo = { name: "Page 1", id: "0:1", editorType: "figma" };
  const run = async (env: Record<string, string | undefined>, pluginResult: unknown, userKey?: string) => {
    const tools = capture((server) => registerDocumentTools(server, async () => pluginResult, env, () => userKey));
    return JSON.parse((await tools.get_document_info.run({})).content[0].text);
  };

  test("flag off: fileKey and fileKeySource are stripped, so output is unchanged", async () => {
    expect(await run({}, { ...pluginInfo, fileKey: KEY }, BRANCH)).toEqual(pluginInfo);
    expect(await run({}, { ...pluginInfo, fileKey: null })).toEqual(pluginInfo);
  });
  test("flag on: the plugin's key wins", async () => {
    expect(await run(ON, { ...pluginInfo, fileKey: KEY }, BRANCH)).toEqual({ ...pluginInfo, fileKey: KEY, fileKeySource: "plugin" });
  });
  test("flag on: the user's key fills in for a dev-linked plugin", async () => {
    expect(await run(ON, { ...pluginInfo, fileKey: null }, BRANCH)).toEqual({ ...pluginInfo, fileKey: BRANCH, fileKeySource: "user" });
  });
  test("flag on: no key from either side", async () => {
    expect(await run(ON, { ...pluginInfo, fileKey: null })).toEqual({ ...pluginInfo, fileKey: null, fileKeySource: null });
  });
  test("L2F_ALL turns it on", async () => {
    expect((await run({ L2F_ALL: "1" }, { ...pluginInfo, fileKey: KEY })).fileKeySource).toBe("plugin");
  });
});

describe("plugin getDocumentInfo", () => {
  const withFigma = async (fileKey: string | undefined) => {
    const original = (globalThis as any).figma;
    (globalThis as any).figma = { fileKey, editorType: "figma", currentPage: { id: "1:1", name: "P", type: "PAGE", children: [], loadAsync: async () => {} } };
    try { return await getDocumentInfo(); }
    finally { (globalThis as any).figma = original; }
  };
  test("reports figma.fileKey when Figma provides it", async () => {
    expect((await withFigma(KEY)).fileKey).toBe(KEY);
  });
  test("reports null when Figma does not provide it", async () => {
    expect((await withFigma(undefined)).fileKey).toBeNull();
  });
});
