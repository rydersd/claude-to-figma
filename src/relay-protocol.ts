// Shared between the relay (src/socket.ts) and the MCP server. Bump it when
// the relay's messages change, so an installed plugin replaces an older relay
// it started earlier instead of talking to it.
export const RELAY_PROTOCOL_VERSION = "2";
export const RELAY_VERSION_HEADER = "X-L2F-Relay-Protocol";

// The Figma plugin connects to 3055 by default (its UI can change it).
// L2F_RELAY_PORT moves the relay and the MCP server together, e.g. for tests.
export const RELAY_PORT = Number(process.env.L2F_RELAY_PORT) || 3055;
