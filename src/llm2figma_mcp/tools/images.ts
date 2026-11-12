import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFile } from "fs/promises";
import { lookup } from "dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "net";
import type { SendCommandFn } from "../types.js";

// Figma rejects images over 4096px; this byte cap keeps WebSocket messages well
// under the relay's payload limit (base64 inflates by ~4/3).
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const SCALE_MODES = ["FILL", "FIT", "CROP", "TILE"] as const;

export const ImageSourceSchema = {
  url: z.string().optional().describe("HTTP(S) URL of the image — the server fetches it (the plugin itself has no network access beyond localhost)"),
  filePath: z.string().optional().describe("Absolute local path to an image file"),
  base64: z.string().optional().describe("Raw base64 image data, or a data:image/...;base64, URI"),
  scaleMode: z.enum(SCALE_MODES).optional().describe("How the image fills the node: FILL (cover, default), FIT (contain), CROP, TILE"),
  opacity: z.number().min(0).max(1).optional().describe("Fill opacity (0-1)"),
};

// Raster types figma.createImage accepts. publicOnly mode allows only these.
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/bmp", "image/tiff",
]);

const MAX_REDIRECTS = 5;

const PRIVATE_NETWORK_ERROR = "URLs pointing to private/internal networks are not allowed";

function isPrivateIPv4(bytes: ArrayLike<number>): boolean {
  const [a, b] = [bytes[0], bytes[1]];
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function parseIPv4(text: string): number[] | null {
  if (isIP(text) !== 4) return null;
  return text.split(".").map(Number);
}

/** Parse an IPv6 address (any notation, optional zone id) into its 16 bytes. */
function parseIPv6(text: string): Uint8Array | null {
  const ip = text.replace(/%.*$/, "");
  if (isIP(ip) !== 6) return null;
  let head = ip;
  let tail: number[] = [];
  // A trailing dotted quad fills the last 32 bits.
  const dotted = ip.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const v4 = parseIPv4(dotted[2]);
    if (!v4) return null;
    head = dotted[1].endsWith("::") ? dotted[1] : dotted[1].slice(0, -1);
    tail = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]];
  }
  const halves = head.split("::");
  if (halves.length > 2) return null;
  const toGroups = (part: string) => (part === "" ? [] : part.split(":").map((g) => parseInt(g, 16)));
  const left = toGroups(halves[0]);
  const right = halves.length === 2 ? toGroups(halves[1]) : [];
  const fill = 8 - left.length - right.length - tail.length;
  if (fill < 0 || (halves.length === 1 && fill !== 0)) return null;
  const groups = [...left, ...new Array(halves.length === 2 ? fill : 0).fill(0), ...right, ...tail];
  if (groups.length !== 8 || groups.some((g) => !(g >= 0 && g <= 0xffff))) return null;
  const bytes = new Uint8Array(16);
  groups.forEach((g, i) => { bytes[i * 2] = g >> 8; bytes[i * 2 + 1] = g & 0xff; });
  return bytes;
}

const zeros = (bytes: Uint8Array, from: number, to: number) => bytes.slice(from, to).every((b) => b === 0);

function isPrivateIPv6(bytes: Uint8Array): boolean {
  const last4 = bytes.slice(12, 16);
  // ::ffff:a.b.c.d (IPv4-mapped), ::ffff:0:a.b.c.d (SIIT) and ::a.b.c.d
  // (IPv4-compatible, which also covers :: and ::1) reach the IPv4 address.
  if (zeros(bytes, 0, 10) && bytes[10] === 0xff && bytes[11] === 0xff) return isPrivateIPv4(last4);
  if (zeros(bytes, 0, 8) && bytes[8] === 0xff && bytes[9] === 0xff && bytes[10] === 0 && bytes[11] === 0) return isPrivateIPv4(last4);
  if (zeros(bytes, 0, 12)) return isPrivateIPv4(last4);
  // NAT64 well-known prefix 64:ff9b::/96 translates to the embedded IPv4.
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b && zeros(bytes, 4, 12)) {
    return isPrivateIPv4(last4);
  }
  // Local-use NAT64 64:ff9b:1::/48 only translates inside a private network.
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b && bytes[4] === 0 && bytes[5] === 1) return true;
  return (bytes[0] & 0xfe) === 0xfc ||                    // fc00::/7 unique local
    (bytes[0] === 0xfe && (bytes[1] & 0x80) === 0x80) ||   // fe80::/10 link-local, fec0::/10 site-local
    bytes[0] === 0xff;                                     // ff00::/8 multicast
}

/**
 * True for loopback, private, link-local (incl. cloud metadata), CGNAT, ULA,
 * multicast and unspecified addresses, including IPv4 addresses embedded in
 * IPv6 (mapped, translated, compatible, NAT64). Anything that is not a valid
 * IP address counts as private, so a parsing gap fails closed.
 */
export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, "");
  const v4 = parseIPv4(ip);
  if (v4) return isPrivateIPv4(v4);
  const v6 = parseIPv6(ip);
  if (v6) return isPrivateIPv6(v6);
  return true;
}

/** Reject a URL whose host is a private literal address or a localhost name. */
function assertPublicLiteralHost(url: URL): void {
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) throw new Error(PRIVATE_NETWORK_ERROR);
  if (isIP(host.replace(/%.*$/, "")) && isPrivateAddress(host)) throw new Error(PRIVATE_NETWORK_ERROR);
}

export type ResolvedAddress = { address: string; family: number };

/**
 * One request, no redirect following. Returns a fetch-style Response so the
 * caller's redirect, content-type and size checks are transport-agnostic.
 */
export type ImageTransport = (url: URL, options: { signal: AbortSignal }) => Promise<Response>;

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

/**
 * A transport that resolves the host inside the socket's own DNS lookup,
 * refuses private answers there, and connects to exactly the address it
 * checked. The URL's host still drives the Host header and TLS SNI, and there
 * is no second resolution an attacker's DNS could answer differently.
 */
export function createPinnedTransport(options: {
  resolve?: (hostname: string) => Promise<ResolvedAddress[]>;
  isAllowedAddress?: (address: string) => boolean;
} = {}): ImageTransport {
  const resolveHost = options.resolve ?? ((hostname: string) => lookup(hostname, { all: true, verbatim: true }));
  const isAllowed = options.isAllowedAddress ?? ((address: string) => !isPrivateAddress(address));

  const pinnedLookup = (hostname: string, lookupOptions: any, callback: (...args: any[]) => void) => {
    if (typeof lookupOptions === "function") { callback = lookupOptions; lookupOptions = {}; }
    resolveHost(hostname).then((addresses) => {
      if (addresses.length === 0 || addresses.some((a) => !isAllowed(a.address))) {
        callback(Object.assign(new Error(PRIVATE_NETWORK_ERROR), { code: "EPRIVATEADDRESS" }));
        return;
      }
      const family = Number(lookupOptions?.family) || 0;
      const usable = family ? addresses.filter((a) => a.family === family) : addresses;
      if (usable.length === 0) {
        callback(Object.assign(new Error(`No IPv${family} address for ${hostname}`), { code: "ENOTFOUND" }));
        return;
      }
      if (lookupOptions?.all) callback(null, usable);
      else callback(null, usable[0].address, usable[0].family);
    }, (error) => callback(error));
  };

  return (url, { signal }) => new Promise<Response>((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(url, { method: "GET", signal, lookup: pinnedLookup as any }, (res) => {
      const status = res.statusCode ?? 0;
      if (status < 200 || status > 599) {
        res.destroy();
        reject(new Error(`Failed to fetch image: unexpected status ${status} (${url.href})`));
        return;
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(res.headers)) {
        if (Array.isArray(value)) value.forEach((v) => headers.append(name, v));
        else if (value !== undefined) headers.set(name, String(value));
      }
      let body: ReadableStream<Uint8Array> | null = null;
      if (NULL_BODY_STATUSES.has(status)) {
        res.resume();
      } else {
        const chunks = res[Symbol.asyncIterator]();
        body = new ReadableStream<Uint8Array>({
          async pull(controller) {
            const { done, value } = await chunks.next();
            if (done) controller.close();
            else controller.enqueue(new Uint8Array(value));
          },
          cancel() { res.destroy(); },
        });
      }
      resolve(new Response(body, { status, statusText: res.statusMessage, headers }));
    });
    request.on("error", (error: any) => {
      reject(error?.code === "EPRIVATEADDRESS" ? new Error(PRIVATE_NETWORK_ERROR) : error);
    });
    request.end();
  });
}

/**
 * Resolve an image source (url | filePath | base64) to a plain base64 string.
 * Throws with a descriptive message on failure or oversized images.
 *
 * publicOnly: refuse URLs that are, resolve to, or redirect to private/internal
 * addresses (each redirect hop is re-checked, and each connection is pinned to
 * the address that passed the check) and accept only raster image content
 * types. `transport` replaces the pinned transport, for tests.
 */
export async function resolveImageToBase64(
  source: { url?: string; filePath?: string; base64?: string },
  options: { publicOnly?: boolean; transport?: ImageTransport } = {}
): Promise<string> {
  if (source.base64) {
    // Strip data-URI prefix if present
    const match = source.base64.match(/^data:[^;]+;base64,(.*)$/s);
    const data = (match ? match[1] : source.base64).replace(/\s/g, "");
    const decodedSize = data.length / 4 * 3 - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0);
    if (decodedSize > MAX_IMAGE_BYTES) throw new Error("Image exceeds the 6MB limit. Resize it first.");
    return data;
  }

  let bytes: Buffer;
  if (source.url) {
    const signal = AbortSignal.timeout(15000);
    let url = new URL(source.url);
    let response: Response;
    for (let hop = 0; ; hop++) {
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Image URL must use HTTP(S)");
      if (!options.publicOnly) {
        response = await fetch(url, { signal });
        break;
      }
      assertPublicLiteralHost(url);
      response = await (options.transport ?? defaultPinnedTransport)(url, { signal });
      const location = response.headers.get("location");
      if (response.status < 300 || response.status >= 400 || !location) break;
      if (hop >= MAX_REDIRECTS) throw new Error(`Too many redirects (${source.url})`);
      await response.body?.cancel();
      url = new URL(location, url);
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText} (${source.url})`);
    }
    const contentType = response.headers.get("content-type") || "";
    const mediaType = contentType.split(";")[0].trim().toLowerCase();
    if (options.publicOnly ? !ALLOWED_IMAGE_TYPES.has(mediaType) : contentType && !contentType.startsWith("image/")) {
      throw new Error(`URL did not return a supported image (content-type: ${contentType || "none"})`);
    }
    // Bound streaming downloads as well as their final payload size.
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Image response had no body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_IMAGE_BYTES) {
          await reader.cancel();
          throw new Error("Image exceeds the 6MB limit. Resize it first.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    bytes = Buffer.concat(chunks);
  } else if (source.filePath) {
    bytes = await readFile(source.filePath);
  } else {
    throw new Error("Provide one of: url, filePath, or base64");
  }

  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`Image is ${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB — exceeds the ${MAX_IMAGE_BYTES / 1024 / 1024}MB limit. Resize it first.`);
  }
  return bytes.toString("base64");
}

const defaultPinnedTransport = createPinnedTransport();

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool(
    "set_image_fill",
    "Fill a node with an image from a URL, local file path, or base64 data. The server fetches the bytes and the plugin creates a real Figma image fill. Figma rejects images larger than 4096px per side. scaleMode maps from CSS: FILL = background-size:cover (default), FIT = contain, TILE = repeat.",
    {
      nodeId: z.string().describe("The ID of the node to fill"),
      ...ImageSourceSchema,
    },
    async ({ nodeId, url, filePath, base64, scaleMode, opacity }: any) => {
      try {
        const data = await resolveImageToBase64({ url, filePath, base64 });
        const result = await sendCommandToFigma("set_image_fill", {
          nodeId,
          image: { base64: data, scaleMode, opacity },
        });
        const typed = result as { name: string; imageHash: string; scaleMode: string };
        return { content: [{ type: "text", text: `Set image fill on node "${typed.name}" (hash ${typed.imageHash}, ${typed.scaleMode})` }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error setting image fill: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
