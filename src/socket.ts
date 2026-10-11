#!/usr/bin/env bun

import { Server, ServerWebSocket } from "bun";
import { writeFileSync } from "node:fs";
import { RELAY_PORT, RELAY_PROTOCOL_VERSION, RELAY_VERSION_HEADER } from "./relay-protocol.js";

// Full message logging is noisy and records design content; opt in with
// C2F_RELAY_DEBUG=1.
const DEBUG = process.env.C2F_RELAY_DEBUG === "1";
const debug = (...args: unknown[]) => { if (DEBUG) console.log(...args); };

// Browsers send an Origin header; the MCP server sends none. Refuse ordinary
// web origins, otherwise any page open in a browser could drive Figma. The
// Figma plugin UI is a sandboxed iframe with a "null" origin; Figma's own
// origins are allowed too in case a Figma build reports one.
const FIGMA_ORIGINS = new Set(["null", "https://www.figma.com", "https://figma.com"]);
function allowedOrigin(origin: string | null): boolean {
  return origin === null || FIGMA_ORIGINS.has(origin);
}

// Store clients by channel
const channels = new Map<string, Set<ServerWebSocket<any>>>();

// Who each socket is. MCP servers say role "mcp" when they join; anything
// else (the Figma plugin) counts as a plugin.
const roles = new WeakMap<ServerWebSocket<any>, "mcp" | "plugin">();
const isPlugin = (ws: ServerWebSocket<any>) => roles.get(ws) !== "mcp";

function handleConnection(ws: ServerWebSocket<any>) {
  // Don't add to clients immediately - wait for channel join
  console.log("New client connected");

  // Send welcome message to the new client
  ws.send(JSON.stringify({
    type: "system",
    message: "Please join a channel to start chatting",
  }));

  ws.close = () => {
    console.log("Client disconnected");

    // Remove client from their channel
    channels.forEach((clients, channelName) => {
      if (clients.has(ws)) {
        clients.delete(ws);

        // Notify other clients in same channel
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: "system",
              message: "A user has left the channel",
              channel: channelName
            }));
          }
        });
      }
    });
  };
}

const server = Bun.serve({
  port: RELAY_PORT,
  // Loopback only, so nothing else on the network can drive Figma. For
  // Windows + WSL, start the relay with C2F_RELAY_HOST=0.0.0.0.
  hostname: process.env.C2F_RELAY_HOST || "127.0.0.1",
  fetch(req: Request, server: Server) {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (!allowedOrigin(req.headers.get("origin"))) {
      return new Response("Forbidden origin", { status: 403 });
    }

    // Handle WebSocket upgrade
    const success = server.upgrade(req, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });

    if (success) {
      return; // Upgraded to WebSocket
    }

    // Return response for non-WebSocket requests
    return new Response("WebSocket server running", {
      headers: {
        [RELAY_VERSION_HEADER]: RELAY_PROTOCOL_VERSION,
      },
    });
  },
  websocket: {
    open: handleConnection,
    message(ws: ServerWebSocket<any>, message: string | Buffer) {
      try {
        const data = JSON.parse(message as string);
        debug(`\n=== Received message from client ===`);
        debug(`Type: ${data.type}, Channel: ${data.channel || 'N/A'}`);
        if (data.message?.command) {
          debug(`Command: ${data.message.command}, ID: ${data.id}`);
        } else if (data.message?.result) {
          debug(`Response: ID: ${data.id}, Has Result: ${!!data.message.result}`);
        }
        debug(`Full message:`, JSON.stringify(data, null, 2));

        if (data.type === "join") {
          const channelName = data.channel;
          if (!channelName || typeof channelName !== "string") {
            ws.send(JSON.stringify({
              type: "error",
              message: "Channel name is required"
            }));
            return;
          }

          // Create channel if it doesn't exist
          if (!channels.has(channelName)) {
            channels.set(channelName, new Set());
          }

          // Add client to channel
          const channelClients = channels.get(channelName)!;
          channelClients.add(ws);
          roles.set(ws, data.role === "mcp" ? "mcp" : "plugin");

          console.log(`\n✓ Client joined channel "${channelName}" (${channelClients.size} total clients)`);

          // Notify client they joined successfully
          ws.send(JSON.stringify({
            type: "system",
            message: `Joined channel: ${channelName}`,
            channel: channelName
          }));

          ws.send(JSON.stringify({
            type: "system",
            message: {
              id: data.id,
              result: "Connected to channel: " + channelName,
            },
            channel: channelName
          }));

          // Notify other clients in channel
          channelClients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: "system",
                message: "A new user has joined the channel",
                channel: channelName
              }));
            }
          });
          return;
        }

        // List channels that have someone in them, so the MCP server can
        // auto-join when exactly one Figma file is connected.
        if (data.type === "list_channels") {
          const active = [...channels.entries()]
            .filter(([, clients]) => [...clients].some(isPlugin))
            .map(([name, clients]) => ({ name, clients: clients.size }));
          ws.send(JSON.stringify({
            type: "system",
            message: { id: data.id, result: active },
          }));
          return;
        }

        // Handle regular messages
        if (data.type === "message") {
          const channelName = data.channel;
          if (!channelName || typeof channelName !== "string") {
            ws.send(JSON.stringify({
              type: "error",
              message: "Channel name is required"
            }));
            return;
          }

          const channelClients = channels.get(channelName);
          if (!channelClients || !channelClients.has(ws)) {
            ws.send(JSON.stringify({
              type: "error",
              message: "You must join the channel first"
            }));
            return;
          }

          // Broadcast to all OTHER clients in the channel (not the sender)
          // This prevents echo and ensures proper request-response flow
          let broadcastCount = 0;
          channelClients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              broadcastCount++;
              const broadcastMessage = {
                type: "broadcast",
                message: data.message,
                sender: "peer",
                channel: channelName
              };
              debug(`\n=== Broadcasting to peer #${broadcastCount} ===`);
              debug(JSON.stringify(broadcastMessage, null, 2));
              client.send(JSON.stringify(broadcastMessage));
            }
          });
          
          if (broadcastCount === 0) {
            console.log(`⚠️  No other clients in channel "${channelName}" to receive message!`);
          } else {
            debug(`✓ Broadcast to ${broadcastCount} peer(s) in channel "${channelName}"`);
          }
        }

        // Forward progress_update messages to the MCP server so it can reset
        if (data.type === "progress_update") {
          const channelName = data.channel;
          if (!channelName) return;

          const channelClients = channels.get(channelName);
          if (!channelClients || !channelClients.has(ws)) return;

          channelClients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
        }

        // Forward event messages (Figma design events) to other channel members
        if (data.type === "event") {
          const channelName = data.channel;
          if (!channelName) return;

          const channelClients = channels.get(channelName);
          if (!channelClients || !channelClients.has(ws)) return;

          channelClients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
          return;
        }
      } catch (err) {
        console.error("Error handling message:", err);
      }
    },
    close(ws: ServerWebSocket<any>) {
      // Remove client from their channel and tell the others who left, so an
      // MCP server can drop a channel whose Figma plugin has gone.
      const role = isPlugin(ws) ? "plugin" : "mcp";
      channels.forEach((clients, channelName) => {
        if (!clients.delete(ws)) return;
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "system", event: "peer_left", role, channel: channelName }));
          }
        });
        if (clients.size === 0) channels.delete(channelName);
      });
    }
  }
});

// When started by the installed plugin, record our own pid only once we hold
// the port, so a relay that lost the race never overwrites the winner's.
if (process.env.C2F_RELAY_PID_FILE) {
  writeFileSync(process.env.C2F_RELAY_PID_FILE, String(process.pid));
}

console.log(`WebSocket server running on ${server.hostname}:${server.port} (protocol ${RELAY_PROTOCOL_VERSION})`);
