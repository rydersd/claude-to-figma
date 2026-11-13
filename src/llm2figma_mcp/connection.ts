import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";
import { logger } from "./helpers.js";
import type { FigmaCommand, CommandProgressUpdate } from "./types.js";
import { recordOperation, getAdaptiveParams, getOptimalTimeout } from "./metrics.js";
import { pushEvent, onDisconnect } from "./events.js";
import { ensureRelay, isPluginInstall } from "./plugin-runtime.js";
import { RELAY_PORT } from "../relay-protocol.js";



// WebSocket connection and request tracking
let ws: WebSocket | null = null;
const pendingRequests = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
  lastActivity: number;
}>();

// Track which channel each client is in
let currentChannel: string | null = null;

// File keys the user gave through join_channel, per channel (L2F_FILE_KEY).
const channelFileKeys = new Map<string, string>();

export function setChannelFileKey(channel: string, fileKey: string): void {
  channelFileKeys.set(channel, fileKey);
}

// The channel this server is joined to, or null.
export function getCurrentChannel(): string | null {
  return currentChannel;
}

// Defaults to the channel this server is joined to.
export function getChannelFileKey(channel: string | null = currentChannel): string | undefined {
  return channel ? channelFileKeys.get(channel) : undefined;
}

// A relay (re)connection means every channel may now hold a different file.
export function clearChannelFileKeys(): void {
  channelFileKeys.clear();
}

// The relay's peer_left event. A plugin leaving ends its channel's file key (the
// name can be reused by another file) and, if it was ours, the joined channel.
export function handlePeerLeft(event: { role?: string; channel?: string }): void {
  if (event.role !== "plugin" || !event.channel) return;
  channelFileKeys.delete(event.channel);
  if (event.channel === currentChannel) {
    logger.info(`Figma plugin left channel ${currentChannel}; will auto-join on next command`);
    currentChannel = null;
  }
}

// Add command line argument parsing
const args = process.argv.slice(2);
const serverArg = args.find(arg => arg.startsWith('--server='));
const serverUrl = serverArg ? serverArg.split('=')[1] : 'localhost';
// Use the IPv4 loopback the relay binds to, so "localhost" resolving to ::1
// first can't miss it.
const isLocalRelay = serverUrl === 'localhost';
const WS_URL = isLocalRelay ? 'ws://127.0.0.1' : `wss://${serverUrl}`;

// How long a WebSocket upgrade may take before the attempt is abandoned. A
// relay that accepts TCP but never answers the upgrade would otherwise leave
// the socket CONNECTING forever, and every later connect would wait on it.
export const HANDSHAKE_TIMEOUT_MS = 10000;

// Abandon a socket that hasn't opened, so the next connect makes a new one.
// Bun's built-in "ws" ignores handshakeTimeout and may not emit close for a
// terminated CONNECTING socket, so `ws` is released here rather than in the
// close handler.
function abandonConnectingSocket(socket: WebSocket) {
  if (ws === socket) ws = null;
  try {
    socket.terminate();
  } catch (error) {
    logger.debug(`Terminating a stalled socket failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// One pending reconnect at most, however many paths ask for it.
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleReconnect(port: number = RELAY_PORT, handshakeTimeoutMs: number = HANDSHAKE_TIMEOUT_MS) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToFigma(port, handshakeTimeoutMs);
  }, 2000);
}

export function connectToFigma(port: number = RELAY_PORT, handshakeTimeoutMs: number = HANDSHAKE_TIMEOUT_MS) {
  // If already connected or connecting, do nothing: a second socket would
  // replace `ws` and the first one's close handler would then null it out.
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const wsUrl = isLocalRelay ? `${WS_URL}:${port}` : WS_URL;
  logger.info(`Connecting to Figma socket server at ${wsUrl}...`);
  const socket = new WebSocket(wsUrl, { handshakeTimeout: handshakeTimeoutMs });
  ws = socket;

  const handshakeTimer = setTimeout(() => {
    if (socket.readyState !== WebSocket.CONNECTING) return;
    logger.warn(`The relay at ${wsUrl} did not complete the WebSocket handshake in ${handshakeTimeoutMs / 1000}s; retrying in 2 seconds`);
    const current = ws === socket;
    abandonConnectingSocket(socket);
    if (current) scheduleReconnect(port, handshakeTimeoutMs);
  }, handshakeTimeoutMs);

  socket.on('open', () => {
    clearTimeout(handshakeTimer);
    logger.info('Connected to Figma socket server');
    // Reset channel on new connection
    currentChannel = null;
    clearChannelFileKeys();
  });

  socket.on("message", (data: any) => {
    try {
      // Define a more specific type with an index signature to allow any property access
      interface ProgressMessage {
        message: any;
        type?: string;
        id?: string;
        [key: string]: any;
      }

      const json = JSON.parse(data) as ProgressMessage;

      // The Figma plugin in our channel closed: forget the channel so the next
      // command auto-joins whichever file is connected now.
      if (json.type === "system" && json.event === "peer_left") {
        handlePeerLeft(json);
        return;
      }

      // Handle progress updates
      if (json.type === 'progress_update') {
        const progressData = json.message.data as CommandProgressUpdate;
        const requestId = json.id || '';

        if (requestId && pendingRequests.has(requestId)) {
          const request = pendingRequests.get(requestId)!;

          // Update last activity timestamp
          request.lastActivity = Date.now();

          // Reset the timeout to prevent timeouts during long-running operations
          clearTimeout(request.timeout);

          // Create a new timeout
          request.timeout = setTimeout(() => {
            if (pendingRequests.has(requestId)) {
              logger.error(`Request ${requestId} timed out after extended period of inactivity`);
              pendingRequests.delete(requestId);
              request.reject(new FigmaCommandError('Request to Figma timed out', "no_reply"));
            }
          }, 60000); // 60 second timeout for inactivity

          // Log progress
          logger.info(`Progress update for ${progressData.commandType}: ${progressData.progress}% - ${progressData.message}`);

          // For completed updates, just log the completion, wait for final result from Figma
          if (progressData.status === 'completed' && progressData.progress === 100) {
            logger.info(`Operation ${progressData.commandType} completed, waiting for final result`);
          }
        }
        return;
      }

      // Handle out-of-band uncaught errors from the plugin sandbox. These carry
      // no request id by design, so they must not settle a pending request —
      // they only surface the stack that Figma's error toast truncates away.
      if (json.message && json.message.type === 'uncaught_error') {
        logger.error(
          `Uncaught error in Figma plugin (${json.message.source}): ${json.message.error}`
        );
        return;
      }

      // Handle events from Figma plugin -- require eventType to avoid pushing malformed events
      if (json.type === "event" && json.eventType) {
        pushEvent({
          eventType: json.eventType,
          data: json.data,
          timestamp: json.timestamp || Date.now(),
          receivedAt: Date.now(),
          isPluginOperation: json.isPluginOperation || false,
        });
        return;
      }

      // Handle regular responses
      const myResponse = json.message;

      // C2 fix: handle both result and error responses — don't require result to be truthy
      if (
        myResponse.id &&
        pendingRequests.has(myResponse.id) &&
        (myResponse.result !== undefined || myResponse.error)
      ) {
        const request = pendingRequests.get(myResponse.id)!;
        clearTimeout(request.timeout);

        if (myResponse.error) {
          logger.error(`Error from Figma: ${myResponse.error}`);
          request.reject(new FigmaCommandError(myResponse.error, "plugin_error"));
        } else {
          request.resolve(myResponse.result);
        }

        pendingRequests.delete(myResponse.id);
      } else {
        // Handle broadcast messages or events
        logger.info(`Received broadcast message: ${JSON.stringify(myResponse)}`);
      }
    } catch (error) {
      logger.error(`Error parsing message: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  socket.on('error', (error) => {
    logger.error(`Socket error: ${error}`);
  });

  socket.on('close', () => {
    clearTimeout(handshakeTimer);
    // An abandoned socket closing late must not tear down its replacement.
    if (ws !== socket) return;
    logger.info('Disconnected from Figma socket server');
    ws = null;

    // Reset event subscription state
    onDisconnect();

    // Reject all pending requests
    for (const [id, request] of pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.reject(new FigmaCommandError("Connection closed", "no_reply"));
      pendingRequests.delete(id);
    }

    // Attempt to reconnect
    logger.info('Attempting to reconnect in 2 seconds...');
    scheduleReconnect(port, handshakeTimeoutMs);
  });
}

// Function to join a channel
export async function joinChannel(channelName: string): Promise<void> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error("Not connected to Figma");
  }

  try {
    await sendCommandToFigma("join", { channel: channelName });
    currentChannel = channelName;
    logger.info(`Joined channel: ${channelName}`);
  } catch (error) {
    logger.error(`Failed to join channel: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Connect to the relay, starting it first when running as an installed plugin.
async function ensureConnected(timeoutMs: number = 5000): Promise<void> {
  // A remote relay (--server=host) is never started or probed locally.
  if (isLocalRelay && !(await ensureRelay(RELAY_PORT))) {
    throw new Error(isPluginInstall
      ? `Couldn't start the relay on port ${RELAY_PORT}. Run setup_status for details.`
      : `The relay isn't running on port ${RELAY_PORT}. Start it with \`bun socket\` in the llm2figma repo.`);
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    connectToFigma();
    await new Promise((r) => setTimeout(r, 100));
  }
  // Don't leave a stuck CONNECTING socket behind: the next attempt would
  // wait on it instead of dialling again. Abandoning it releases `ws`, so its
  // close handler and handshake timer no longer retry; schedule that here.
  if (ws && ws.readyState === WebSocket.CONNECTING) {
    abandonConnectingSocket(ws);
    scheduleReconnect();
  }
  throw new Error(`Couldn't connect to the relay on port ${RELAY_PORT}.`);
}

// Ask the relay which channels have a Figma plugin in them.
export function listChannels(timeoutMs: number = 5000): Promise<{ name: string; clients: number }[]> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      ensureConnected()
        .then(() => listChannels(timeoutMs))
        .then(resolve, reject);
      return;
    }

    const id = uuidv4();
    const timeout = setTimeout(() => {
      if (pendingRequests.delete(id)) {
        reject(new Error(isPluginInstall
          ? `An older relay is running on port ${RELAY_PORT} (probably \`bun socket\` from a clone). Stop it so the plugin can start its own.`
          : "The relay did not answer list_channels. Restart `bun socket` to pick up the current relay."));
      }
    }, timeoutMs);

    pendingRequests.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
      timeout,
      lastActivity: Date.now(),
    });
    ws.send(JSON.stringify({ id, type: "list_channels" }));
  });
}

// How far a failed command got, for callers that must know whether the plugin
// may have run it: "not_sent" (no relay, no channel: never sent),
// "plugin_error" (the plugin answered with an error: it ran and threw), or
// "no_reply" (sent, then a timeout or a lost connection: it may have run).
export type CommandDelivery = "not_sent" | "plugin_error" | "no_reply";
const DELIVERY = Symbol("l2f.commandDelivery");

export class FigmaCommandError extends Error {
  constructor(message: string, delivery: CommandDelivery) {
    super(message);
    (this as any)[DELIVERY] = delivery;
  }
}

// The delivery stage a sendCommandToFigma rejection carries, if any.
export function commandDelivery(error: unknown): CommandDelivery | undefined {
  return error && typeof error === "object" ? (error as any)[DELIVERY] : undefined;
}

// A failure before this command was sent (connecting, choosing a channel) is
// "not_sent", even when it came from another command (the join) timing out.
function notSent(error: unknown): Error {
  if (!(error instanceof Error)) return new FigmaCommandError(String(error), "not_sent");
  if (commandDelivery(error) && commandDelivery(error) !== "not_sent") return new FigmaCommandError(error.message, "not_sent");
  Object.defineProperty(error, DELIVERY, { value: "not_sent", configurable: true });
  return error;
}

// Errors that retrying cannot fix: the user has to open, close or pick a file.
export class ChannelSelectionError extends Error {}

// Join the channel automatically when exactly one Figma file is connected.
// Concurrent callers share one attempt so a burst of tool calls joins once.
let autoJoinInFlight: Promise<string> | null = null;

export function autoJoinChannel(): Promise<string> {
  if (currentChannel) return Promise.resolve(currentChannel);
  if (!autoJoinInFlight) {
    autoJoinInFlight = (async () => {
      const active = await listChannels();
      if (active.length === 0) {
        throw new ChannelSelectionError("No Figma file is connected. In the Figma desktop app, run the llm2figma plugin and click Connect.");
      }
      if (active.length > 1) {
        const names = active.map((c) => c.name).join(", ");
        throw new ChannelSelectionError(`Several Figma files are connected (${names}). Call join_channel with the channel shown in the plugin you want.`);
      }
      // An explicit join_channel may have finished while we were asking.
      if (currentChannel) return currentChannel;
      await joinChannel(active[0].name);
      return active[0].name;
    })().finally(() => {
      autoJoinInFlight = null;
    });
  }
  return autoJoinInFlight;
}

// Function to send commands to Figma
export function sendCommandToFigma(
  command: FigmaCommand,
  params: unknown = {},
  timeoutMs: number = 30000
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // If not connected, connect (and start the relay when installed as a
    // plugin), then send.
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      if (!isPluginInstall) {
        connectToFigma();
        reject(new FigmaCommandError("Not connected to the relay. Start it with `bun socket` in the llm2figma repo.", "not_sent"));
        return;
      }
      ensureConnected()
        .catch((error) => { throw notSent(error); })
        .then(() => sendCommandToFigma(command, params, timeoutMs))
        .then(resolve, reject);
      return;
    }

    // No channel yet: join the only connected Figma file, then send.
    const requiresChannel = command !== "join";
    if (requiresChannel && !currentChannel) {
      autoJoinChannel()
        .catch((error) => { throw notSent(error); })
        .then(() => sendCommandToFigma(command, params, timeoutMs))
        .then(resolve, reject);
      return;
    }

    const id = uuidv4();
    const request = {
      id,
      type: command === "join" ? "join" : "message",
      ...(command === "join"
        ? { channel: (params as any).channel, role: "mcp" }
        : { channel: currentChannel }),
      message: {
        id,
        command,
        params: {
          ...(params as any),
          commandId: id,
        },
      },
    };

    // Set timeout for request
    const timeout = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        logger.error(`Request ${id} to Figma timed out after ${timeoutMs / 1000} seconds`);
        reject(new FigmaCommandError('Request to Figma timed out', "no_reply"));
      }
    }, timeoutMs);

    // Store the promise callbacks to resolve/reject later
    pendingRequests.set(id, {
      resolve,
      reject,
      timeout,
      lastActivity: Date.now()
    });

    // Send the request
    logger.info(`Sending command to Figma: ${command}`);
    logger.debug(`Request details: ${JSON.stringify(request)}`);
    ws.send(JSON.stringify(request));
  });
}

/**
 * High-level wrapper around sendCommandToFigma with retry logic and exponential backoff.
 * Uses adaptive parameters from metrics history as defaults, overridable via options.
 */
export async function sendCommandWithRetry(
  command: FigmaCommand,
  params: unknown = {},
  options?: {
    timeoutMs?: number;
    maxRetries?: number;
    backoffMs?: number;
  }
): Promise<unknown> {
  const adaptive = getAdaptiveParams();
  const timeoutMs = options?.timeoutMs ?? adaptive.timeoutMs;
  const maxRetries = options?.maxRetries ?? adaptive.maxRetries;
  const backoffMs = options?.backoffMs ?? adaptive.backoffMs;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();

    try {
      const result = await sendCommandToFigma(command, params, timeoutMs);
      const durationMs = Date.now() - startTime;

      // Record successful operation in metrics
      recordOperation(command, durationMs, true);

      return result;
    } catch (error) {
      // Not a Figma failure: report it now, don't retry or skew metrics.
      if (error instanceof ChannelSelectionError) throw error;

      const durationMs = Date.now() - startTime;
      lastError = error instanceof Error ? error : new Error(String(error));

      // Record failed operation in metrics
      recordOperation(command, durationMs, false);

      if (attempt < maxRetries) {
        // Exponential backoff: backoffMs * 2^attempt
        const waitMs = backoffMs * Math.pow(2, attempt);
        logger.warn(
          `Command "${command}" failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}. ` +
          `Retrying in ${waitMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      } else {
        logger.error(
          `Command "${command}" failed after ${maxRetries + 1} attempts. Last error: ${lastError.message}`
        );
      }
    }
  }

  // All retries exhausted
  throw new Error(
    `Command "${command}" failed after ${maxRetries + 1} attempts. Last error: ${lastError?.message ?? "unknown"}`
  );
}
