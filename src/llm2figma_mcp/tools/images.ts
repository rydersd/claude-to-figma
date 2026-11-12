import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFile } from "fs/promises";
import { lookup } from "dns/promises";
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

/** True for loopback, private, link-local (incl. cloud metadata), CGNAT, ULA and unspecified addresses. */
export function isPrivateAddress(address: string): boolean {
  let ip = address.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) ip = mapped[1];
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (isIP(ip) === 6) {
    return ip === "::" || ip === "::1" || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip);
  }
  return false;
}

/** Reject a URL whose host is, or resolves to, a private/internal address. */
async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host.toLowerCase() === "localhost" || host.toLowerCase().endsWith(".localhost")) {
    throw new Error("URLs pointing to private/internal networks are not allowed");
  }
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error("URLs pointing to private/internal networks are not allowed");
  }
}

/**
 * Resolve an image source (url | filePath | base64) to a plain base64 string.
 * Throws with a descriptive message on failure or oversized images.
 *
 * publicOnly: refuse URLs that are, resolve to, or redirect to private/internal
 * addresses (each redirect hop is re-checked) and accept only raster image
 * content types.
 */
export async function resolveImageToBase64(
  source: { url?: string; filePath?: string; base64?: string },
  options: { publicOnly?: boolean } = {}
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
      await assertPublicHost(url);
      response = await fetch(url, { signal, redirect: "manual" });
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
