/**
 * Unit tests for image fill plumbing: the plugin's base64 decoder and the
 * server's image source resolver. Pure logic — no Figma connection required:
 *   bun test tests/images.test.ts
 */

import { describe, test, expect } from "bun:test";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { customBase64Encode, customBase64Decode } from "../src/llm2figma_plugin/src/utils";
import { resolveImageToBase64, isPrivateAddress, createPinnedTransport } from "../src/llm2figma_mcp/tools/images";

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

  // Review finding #2: WHATWG URL normalizes [::ffff:127.0.0.1] to the hex form
  // ::ffff:7f00:1, which a dotted-quad regex never sees.
  test("flags IPv4 embedded in IPv6 in every notation", () => {
    expect(new URL("https://[::ffff:127.0.0.1]/").hostname).toBe("[::ffff:7f00:1]");
    for (const ip of [
      "::ffff:7f00:1", "[::ffff:7f00:1]", "::ffff:a9fe:a9fe", "::ffff:a00:1", "::ffff:c0a8:101",
      "0:0:0:0:0:ffff:7f00:1", "0000:0000:0000:0000:0000:ffff:127.0.0.1",
      "::ffff:0:7f00:1", "::ffff:0:127.0.0.1",          // SIIT IPv4-translated
      "::7f00:1", "::127.0.0.1", "::a9fe:a9fe",          // IPv4-compatible
      "64:ff9b::7f00:1", "64:ff9b::127.0.0.1", "64:ff9b::a9fe:a9fe", "64:ff9b::a00:1", // NAT64
      "fe80::1%en0", "ff02::1", "fec0::1",
    ]) {
      expect([ip, isPrivateAddress(ip)]).toEqual([ip, true]);
    }
  });

  test("allows public IPv4 embedded in IPv6", () => {
    for (const ip of ["::ffff:808:808", "::ffff:8.8.8.8", "64:ff9b::808:808", "2001:4860:4860::8888"]) {
      expect([ip, isPrivateAddress(ip)]).toEqual([ip, false]);
    }
  });

  test("treats unparseable input as private", () => {
    for (const ip of ["", "not-an-ip", "1:2:3", "::ffff:999.0.0.1", "1::2::3"]) {
      expect([ip, isPrivateAddress(ip)]).toEqual([ip, true]);
    }
  });
});

describe("resolveImageToBase64 publicOnly", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // publicOnly requests go through an injectable transport (the default one
  // pins each connection to the address it validated); fetch must not be used.
  async function withFetch(impl: (url: URL, opts: any) => Response, run: (calls: string[], transport: any) => Promise<void>) {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async () => { throw new Error("publicOnly must not use fetch"); }) as any;
    const transport = async (url: URL, opts: any) => { calls.push(String(url)); return impl(new URL(String(url)), opts); };
    try { await run(calls, transport); } finally { globalThis.fetch = originalFetch; }
  }

  test("refuses private literal hosts without fetching", async () => {
    await withFetch(() => new Response(png), async (calls, transport) => {
      for (const host of ["localhost", "127.0.0.1", "169.254.169.254", "[::1]"]) {
        await expect(resolveImageToBase64({ url: `https://${host}/a.png` }, { publicOnly: true, transport })).rejects.toThrow(/private\/internal/);
      }
      expect(calls).toEqual([]);
    });
  });

  test("refuses a redirect to a private address and does not follow it", async () => {
    await withFetch((url, opts) => {
      expect(opts.signal).toBeInstanceOf(AbortSignal);
      return new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data" } });
    }, async (calls, transport) => {
      await expect(resolveImageToBase64({ url: "https://8.8.8.8/a.png" }, { publicOnly: true, transport })).rejects.toThrow(/private\/internal/);
      expect(calls).toEqual(["https://8.8.8.8/a.png"]);
    });
  });

  test("follows a redirect to a public address", async () => {
    await withFetch((url) => url.pathname === "/a.png"
      ? new Response(null, { status: 301, headers: { location: "/b.png" } })
      : new Response(png, { headers: { "content-type": "image/png" } }),
    async (calls, transport) => {
      const b64 = await resolveImageToBase64({ url: "https://8.8.8.8/a.png" }, { publicOnly: true, transport });
      expect(Buffer.from(b64, "base64")).toEqual(Buffer.from(png));
      expect(calls).toEqual(["https://8.8.8.8/a.png", "https://8.8.8.8/b.png"]);
    });
  });

  test("rejects content types outside the raster allowlist", async () => {
    await withFetch(() => new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } }), async (_calls, transport) => {
      await expect(resolveImageToBase64({ url: "https://8.8.8.8/a.svg" }, { publicOnly: true, transport })).rejects.toThrow(/supported image/);
    });
  });

  test("default mode still allows localhost (set_image_fill behaviour unchanged)", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (url: any) => { calls.push(String(url)); return new Response(png, { headers: { "content-type": "image/png" } }); }) as any;
    try {
      await resolveImageToBase64({ url: "https://localhost/a.png" });
      expect(calls).toEqual(["https://localhost/a.png"]);
    } finally { globalThis.fetch = originalFetch; }
  });

  test("refuses IPv4-mapped IPv6 literal hosts without fetching (finding #2)", async () => {
    await withFetch(() => new Response(png), async (calls, transport) => {
      for (const host of ["[::ffff:127.0.0.1]", "[::ffff:169.254.169.254]", "[::ffff:0:127.0.0.1]", "[64:ff9b::127.0.0.1]", "[::127.0.0.1]"]) {
        await expect(resolveImageToBase64({ url: `https://${host}:8080/internal.png` }, { publicOnly: true, transport })).rejects.toThrow(/private\/internal/);
      }
      expect(calls).toEqual([]);
    });
  });
});

// Review finding #3: the address that was validated must be the address that is
// connected to. The default publicOnly transport resolves inside the socket's
// own lookup, so there is no second, unchecked DNS resolution to rebind.
describe("createPinnedTransport", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  async function withServer(handler: http.RequestListener, run: (port: number, seen: { connections: number; hosts: string[] }) => Promise<void>) {
    const seen = { connections: 0, hosts: [] as string[] };
    const server = http.createServer((req, res) => { seen.hosts.push(String(req.headers.host)); handler(req, res); });
    server.on("connection", () => { seen.connections++; });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    try { await run((server.address() as AddressInfo).port, seen); }
    finally { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
  }

  // A plain-HTTP URL on the spare test port, built without a scheme literal.
  function httpUrl(host: string, port: number, path: string): string {
    const url = new URL(`https://${host}${path}`);
    url.protocol = "http:";
    url.port = String(port);
    return url.href;
  }

  test("connects to the address its resolver validated, keeping the Host header", async () => {
    await withServer((_req, res) => { res.writeHead(200, { "content-type": "image/png" }); res.end(png); }, async (port, seen) => {
      const lookups: string[] = [];
      const transport = createPinnedTransport({
        // "rebind.invalid" cannot resolve through system DNS, so a successful
        // fetch proves the connection used this resolver's answer.
        resolve: async (host) => { lookups.push(host); return [{ address: "127.0.0.1", family: 4 }]; },
        isAllowedAddress: () => true,
      });
      const b64 = await resolveImageToBase64({ url: httpUrl("rebind.invalid", port, "/a.png") }, { publicOnly: true, transport });
      expect(Buffer.from(b64, "base64")).toEqual(Buffer.from(png));
      expect(lookups).toEqual(["rebind.invalid"]);
      expect(seen.hosts).toEqual([`rebind.invalid:${port}`]);
    });
  });

  test("refuses at connect time when the name resolves to a private address", async () => {
    await withServer((_req, res) => { res.writeHead(200, { "content-type": "image/png" }); res.end(png); }, async (port, seen) => {
      const transport = createPinnedTransport({ resolve: async () => [{ address: "127.0.0.1", family: 4 }] });
      await expect(resolveImageToBase64({ url: httpUrl("rebind.invalid", port, "/a.png") }, { publicOnly: true, transport })).rejects.toThrow(/private\/internal/);
      expect(seen.connections).toBe(0);
    });
  });

  test("refuses when any resolved address is private", async () => {
    await withServer((_req, res) => { res.end(); }, async (port, seen) => {
      const transport = createPinnedTransport({ resolve: async () => [{ address: "8.8.8.8", family: 4 }, { address: "::ffff:7f00:1", family: 6 }] });
      await expect(resolveImageToBase64({ url: httpUrl("rebind.invalid", port, "/a.png") }, { publicOnly: true, transport })).rejects.toThrow(/private\/internal/);
      expect(seen.connections).toBe(0);
    });
  });

  test("re-resolves and re-validates every redirect hop", async () => {
    await withServer((req, res) => {
      if (req.url === "/a.png") { res.writeHead(302, { location: httpUrl("evil.invalid", Number(req.socket.localPort), "/b.png") }); res.end(); return; }
      res.writeHead(200, { "content-type": "image/png" }); res.end(png);
    }, async (port, seen) => {
      const lookups: string[] = [];
      const transport = createPinnedTransport({
        resolve: async (host) => { lookups.push(host); return [{ address: "127.0.0.1", family: 4 }]; },
        isAllowedAddress: (address) => lookups.length < 2 && address === "127.0.0.1",
      });
      await expect(resolveImageToBase64({ url: httpUrl("ok.invalid", port, "/a.png") }, { publicOnly: true, transport })).rejects.toThrow(/private\/internal/);
      expect(lookups).toEqual(["ok.invalid", "evil.invalid"]);
      expect(seen.hosts).toEqual([`ok.invalid:${port}`]);
    });
  });

  test("keeps the streaming size cap", async () => {
    await withServer((_req, res) => {
      res.writeHead(200, { "content-type": "image/png" });
      const chunk = Buffer.alloc(1024 * 1024);
      const timer = setInterval(() => { if (!res.write(chunk)) {} }, 1);
      res.on("close", () => clearInterval(timer));
    }, async (port) => {
      const transport = createPinnedTransport({ resolve: async () => [{ address: "127.0.0.1", family: 4 }], isAllowedAddress: () => true });
      await expect(resolveImageToBase64({ url: httpUrl("big.invalid", port, "/a.png") }, { publicOnly: true, transport })).rejects.toThrow(/6MB limit/);
    });
  });
});
