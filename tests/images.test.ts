/**
 * Unit tests for image fill plumbing: the plugin's base64 decoder and the
 * server's image source resolver. Pure logic — no Figma connection required:
 *   bun test tests/images.test.ts
 */

import { describe, test, expect } from "bun:test";
import { customBase64Encode, customBase64Decode } from "../src/claude_figma_plugin/src/utils";
import { resolveImageToBase64 } from "../src/claude_to_figma_mcp/tools/images";

describe("customBase64Decode", () => {
  test("roundtrips with customBase64Encode for all remainder lengths", () => {
    for (const len of [0, 1, 2, 3, 4, 5, 255, 256, 1000]) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = (i * 37 + 11) % 256;
      const encoded = customBase64Encode(bytes);
      expect(encoded).toBe(Buffer.from(bytes).toString("base64"));
      expect(Array.from(customBase64Decode(encoded))).toEqual(Array.from(bytes));
    }
  });

  test("decodes standard base64 (PNG magic bytes)", () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const decoded = customBase64Decode(pngHeader.toString("base64"));
    expect(Array.from(decoded)).toEqual(Array.from(pngHeader));
  });

  test("tolerates whitespace and newlines", () => {
    const b64 = Buffer.from("hello world").toString("base64");
    const wrapped = b64.slice(0, 6) + "\n" + b64.slice(6);
    expect(Buffer.from(customBase64Decode(wrapped)).toString()).toBe("hello world");
  });

  test("throws on invalid input", () => {
    expect(() => customBase64Decode("not!!valid@@base64")).toThrow();
  });
});

describe("resolveImageToBase64", () => {
  test("passes raw base64 through", async () => {
    const b64 = Buffer.from("fake-image").toString("base64");
    expect(await resolveImageToBase64({ base64: b64 })).toBe(b64);
  });

  test("strips data-URI prefixes", async () => {
    const b64 = Buffer.from("fake-image").toString("base64");
    expect(await resolveImageToBase64({ base64: `data:image/png;base64,${b64}` })).toBe(b64);
  });

  test("reads local files", async () => {
    const b64 = await resolveImageToBase64({ filePath: import.meta.path });
    expect(Buffer.from(b64, "base64").toString()).toContain("resolveImageToBase64");
  });

  test("rejects when no source is given", async () => {
    await expect(resolveImageToBase64({})).rejects.toThrow(/Provide one of/);
  });

  test("rejects missing files with a filesystem error", async () => {
    await expect(resolveImageToBase64({ filePath: "/nonexistent/image.png" })).rejects.toThrow();
  });
});
