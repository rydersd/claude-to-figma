#!/usr/bin/env bun
// @bun

// src/socket.ts
var channels = new Map;
var roles = new WeakMap;
var isPlugin = (ws) => roles.get(ws) !== "mcp";
function handleConnection(ws) {
  console.log("New client connected");
  ws.send(JSON.stringify({
    type: "system",
    message: "Please join a channel to start chatting"
  }));
  ws.close = () => {
    console.log("Client disconnected");
    channels.forEach((clients, channelName) => {
      if (clients.has(ws)) {
        clients.delete(ws);
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
var server = Bun.serve({
  port: 3055,
  hostname: process.env.C2F_RELAY_HOST || "127.0.0.1",
  fetch(req, server2) {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    const success = server2.upgrade(req, {
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
    if (success) {
      return;
    }
    return new Response("WebSocket server running", {
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  },
  websocket: {
    open: handleConnection,
    message(ws, message) {
      try {
        const data = JSON.parse(message);
        console.log(`
=== Received message from client ===`);
        console.log(`Type: ${data.type}, Channel: ${data.channel || "N/A"}`);
        if (data.message?.command) {
          console.log(`Command: ${data.message.command}, ID: ${data.id}`);
        } else if (data.message?.result) {
          console.log(`Response: ID: ${data.id}, Has Result: ${!!data.message.result}`);
        }
        console.log(`Full message:`, JSON.stringify(data, null, 2));
        if (data.type === "join") {
          const channelName = data.channel;
          if (!channelName || typeof channelName !== "string") {
            ws.send(JSON.stringify({
              type: "error",
              message: "Channel name is required"
            }));
            return;
          }
          if (!channels.has(channelName)) {
            channels.set(channelName, new Set);
          }
          const channelClients = channels.get(channelName);
          channelClients.add(ws);
          roles.set(ws, data.role === "mcp" ? "mcp" : "plugin");
          console.log(`
\u2713 Client joined channel "${channelName}" (${channelClients.size} total clients)`);
          ws.send(JSON.stringify({
            type: "system",
            message: `Joined channel: ${channelName}`,
            channel: channelName
          }));
          ws.send(JSON.stringify({
            type: "system",
            message: {
              id: data.id,
              result: "Connected to channel: " + channelName
            },
            channel: channelName
          }));
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
        if (data.type === "list_channels") {
          const active = [...channels.entries()].filter(([, clients]) => [...clients].some(isPlugin)).map(([name, clients]) => ({ name, clients: clients.size }));
          ws.send(JSON.stringify({
            type: "system",
            message: { id: data.id, result: active }
          }));
          return;
        }
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
              console.log(`
=== Broadcasting to peer #${broadcastCount} ===`);
              console.log(JSON.stringify(broadcastMessage, null, 2));
              client.send(JSON.stringify(broadcastMessage));
            }
          });
          if (broadcastCount === 0) {
            console.log(`\u26A0\uFE0F  No other clients in channel "${channelName}" to receive message!`);
          } else {
            console.log(`\u2713 Broadcast to ${broadcastCount} peer(s) in channel "${channelName}"`);
          }
        }
        if (data.type === "progress_update") {
          const channelName = data.channel;
          if (!channelName)
            return;
          const channelClients = channels.get(channelName);
          if (!channelClients || !channelClients.has(ws))
            return;
          channelClients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
        }
        if (data.type === "event") {
          const channelName = data.channel;
          if (!channelName)
            return;
          const channelClients = channels.get(channelName);
          if (!channelClients || !channelClients.has(ws))
            return;
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
    close(ws) {
      const role = isPlugin(ws) ? "plugin" : "mcp";
      channels.forEach((clients, channelName) => {
        if (!clients.delete(ws))
          return;
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "system", event: "peer_left", role, channel: channelName }));
          }
        });
        if (clients.size === 0)
          channels.delete(channelName);
      });
    }
  }
});
console.log(`WebSocket server running on port ${server.port}`);
