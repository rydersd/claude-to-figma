/**
 * Unit tests for image fill plumbing: the plugin's base64 decoder and the
 * server's image source resolver. Pure logic — no Figma connection required:
 *   bun test tests/images.test.ts
 */

import { describe, test, expect } from "bun:test";
import { customBase64Encode, customBase64Decode } from "../src/llm2figma_plugin/src/utils";
import { resolveImageToBase64, isPrivateAddress } from "../src/llm2figma_mcp/tools/images";

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

  test("rejects oversized base64 payloads", async () => {
    await expect(resolveImageToBase64({ base64: Buffer.alloc(6 * 1024 * 1024 + 1).toString("base64") })).rejects.toThrow(/6MB limit/);
  });

  test("rejects non-HTTP image URLs", async () => {
    await expect(resolveImageToBase64({ url: "file:///tmp/image.png" })).rejects.toThrow(/HTTP/);
  });

  test("bounds streaming downloads before buffering the entire response", async () => {
    const originalFetch = globalThis.fetch;
    let cancelled = false;
    globalThis.fetch = (async (_url: any, opts: any) => {
      expect(opts.signal).toBeInstanceOf(AbortSignal);
      return new Response(new ReadableStream({
        pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); },
        cancel() { cancelled = true; },
      }), { headers: { "content-type": "image/png" } });
    }) as any;
    try {
      await expect(resolveImageToBase64({ url: "https://example.com/image.png" })).rejects.toThrow(/6MB limit/);
      expect(cancelled).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

});

describe("isPrivateAddress", () => {
  test("flags loopback, private, link-local, CGNAT, ULA and mapped addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
      "100.64.0.1", "0.0.0.0", "::1", "::", "fd00::1", "fe80::1", "[::1]", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  });

  test("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "172.32.0.1", "100.128.0.1", "2606:4700::1111"]) {
      expect(isPrivateAddress(ip)).toBe(false);
    }
  });
});

describe("resolveImageToBase64 publicOnly", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  async function withFetch(impl: (url: URL, opts: any) => Response, run: (calls: string[]) => Promise<void>) {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (url: any, opts: any) => { calls.push(String(url)); return impl(new URL(String(url)), opts); }) as any;
    try { await run(calls); } finally { globalThis.fetch = originalFetch; }
  }

  test("refuses private literal hosts without fetching", async () => {
    await withFetch(() => new Response(png), async (calls) => {
      for (const host of ["localhost", "127.0.0.1", "169.254.169.254", "[::1]"]) {
        await expect(resolveImageToBase64({ url: `https://${host}/a.png` }, { publicOnly: true })).rejects.toThrow(/private\/internal/);
      }
      expect(calls).toEqual([]);
    });
  });

  test("refuses a redirect to a private address and does not follow it", async () => {
    await withFetch((url, opts) => {
      expect(opts.redirect).toBe("manual");
      return new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data" } });
    }, async (calls) => {
      await expect(resolveImageToBase64({ url: "https://8.8.8.8/a.png" }, { publicOnly: true })).rejects.toThrow(/private\/internal/);
      expect(calls).toEqual(["https://8.8.8.8/a.png"]);
    });
  });

  test("follows a redirect to a public address", async () => {
    await withFetch((url) => url.pathname === "/a.png"
      ? new Response(null, { status: 301, headers: { location: "/b.png" } })
      : new Response(png, { headers: { "content-type": "image/png" } }),
    async (calls) => {
      const b64 = await resolveImageToBase64({ url: "https://8.8.8.8/a.png" }, { publicOnly: true });
      expect(Buffer.from(b64, "base64")).toEqual(Buffer.from(png));
      expect(calls).toEqual(["https://8.8.8.8/a.png", "https://8.8.8.8/b.png"]);
    });
  });

  test("rejects content types outside the raster allowlist", async () => {
    await withFetch(() => new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } }), async () => {
      await expect(resolveImageToBase64({ url: "https://8.8.8.8/a.svg" }, { publicOnly: true })).rejects.toThrow(/supported image/);
    });
  });

  test("default mode still allows localhost (set_image_fill behaviour unchanged)", async () => {
    await withFetch(() => new Response(png, { headers: { "content-type": "image/png" } }), async (calls) => {
      await resolveImageToBase64({ url: "https://localhost/a.png" });
      expect(calls).toEqual(["https://localhost/a.png"]);
    });
  });
});
