import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFile } from "fs/promises";
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

/**
 * Resolve an image source (url | filePath | base64) to a plain base64 string.
 * Throws with a descriptive message on failure or oversized images.
 */
export async function resolveImageToBase64(source: { url?: string; filePath?: string; base64?: string }): Promise<string> {
  if (source.base64) {
    // Strip data-URI prefix if present
    const match = source.base64.match(/^data:[^;]+;base64,(.*)$/s);
    return match ? match[1] : source.base64;
  }

  let bytes: Buffer;
  if (source.url) {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText} (${source.url})`);
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType && !contentType.startsWith("image/")) {
      throw new Error(`URL did not return an image (content-type: ${contentType})`);
    }
    bytes = Buffer.from(await response.arrayBuffer());
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
