import * as fs from "fs";
import * as path from "path";
import { logger } from "./helpers.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OperationRecord {
  command: string;
  nodeCount: number;
  chunkSize: number;
  durationMs: number;
  success: boolean;
  error?: string;
  timestamp: number;
}

export interface AdaptiveParams {
  maxNodesPerChunk: number;
  maxRetries: number;
  baseTimeoutMs: number;
  retryBackoffMs: number;
  lastUpdated: number;
}

export interface CommandStats {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  lastFailureReason?: string;
  optimalChunkSize?: number;
}

export interface MetricsStore {
  operations: OperationRecord[];
  adaptiveParams: AdaptiveParams;
  commandStats: Record<string, CommandStats>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_OPERATIONS = 100;
const MIN_CHUNK_SIZE = 5;
const MAX_CHUNK_SIZE = 50;
const RECENT_WINDOW = 20;
const HIGH_FAILURE_THRESHOLD = 0.2;
const LOW_FAILURE_THRESHOLD = 0.05;
const FAST_DURATION_THRESHOLD_MS = 10_000;
const CHUNK_DECREASE_FACTOR = 0.75;
const CHUNK_INCREASE_FACTOR = 1.1;
const TIMEOUT_INCREASE_FACTOR = 1.5;

const METRICS_FILE_PATH = path.join(
  process.env.HOME || "~",
  ".claude",
  "cache",
  "figma-metrics.json",
);

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

let cachedStore: MetricsStore | null = null;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function defaultAdaptiveParams(): AdaptiveParams {
  return {
    maxNodesPerChunk: 25,
    maxRetries: 3,
    baseTimeoutMs: 30_000,
    retryBackoffMs: 2_000,
    lastUpdated: Date.now(),
  };
}

function defaultMetricsStore(): MetricsStore {
  return {
    operations: [],
    adaptiveParams: defaultAdaptiveParams(),
    commandStats: {},
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Loads the metrics store from disk. Returns sensible defaults if the file
 * does not exist or is malformed.
 */
export function loadMetrics(): MetricsStore {
  try {
    if (fs.existsSync(METRICS_FILE_PATH)) {
      const raw = fs.readFileSync(METRICS_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as MetricsStore;

      const store: MetricsStore = {
        operations: Array.isArray(parsed.operations) ? parsed.operations : [],
        adaptiveParams: parsed.adaptiveParams
          ? { ...defaultAdaptiveParams(), ...parsed.adaptiveParams }
          : defaultAdaptiveParams(),
        commandStats:
          parsed.commandStats && typeof parsed.commandStats === "object"
            ? parsed.commandStats
            : {},
      };

      cachedStore = store;
      logger.debug(
        `Loaded metrics: ${store.operations.length} operations, ${Object.keys(store.commandStats).length} commands tracked`,
      );
      return store;
    }
  } catch (err) {
    logger.warn(
      `Failed to load metrics from ${METRICS_FILE_PATH}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const store = defaultMetricsStore();
  cachedStore = store;
  return store;
}

/**
 * Persists the metrics store to disk, creating parent directories as needed.
 */
export function saveMetrics(store: MetricsStore): void {
  try {
    const dir = path.dirname(METRICS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      METRICS_FILE_PATH,
      JSON.stringify(store, null, 2),
      "utf-8",
    );
    cachedStore = store;
    logger.debug("Metrics saved to disk");
  } catch (err) {
    logger.error(
      `Failed to save metrics to ${METRICS_FILE_PATH}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStore(): MetricsStore {
  if (cachedStore === null) {
    return loadMetrics();
  }
  return cachedStore;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function recentOpsForCommand(
  store: MetricsStore,
  command: string,
  limit: number,
): OperationRecord[] {
  const matching: OperationRecord[] = [];
  for (
    let i = store.operations.length - 1;
    i >= 0 && matching.length < limit;
    i--
  ) {
    if (store.operations[i].command === command) {
      matching.push(store.operations[i]);
    }
  }
  return matching;
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Records an operation outcome, updates per-command stats, and triggers
 * adaptive parameter adjustment.
 *
 * Supports two call signatures:
 *   recordOperation(record: OperationRecord)          -- full record object
 *   recordOperation(command, durationMs, success, nodeCount?)  -- simplified
 *
 * The simplified form is used by connection.ts for quick recording.
 */
export function recordOperation(
  commandOrRecord: string | OperationRecord,
  durationMs?: number,
  success?: boolean,
  nodeCount?: number,
): void {
  // Normalise to OperationRecord regardless of call signature
  let record: OperationRecord;
  if (typeof commandOrRecord === "string") {
    record = {
      command: commandOrRecord,
      durationMs: durationMs ?? 0,
      success: success ?? true,
      nodeCount: nodeCount ?? 0,
      chunkSize: 0,
      timestamp: Date.now(),
    };
  } else {
    record = commandOrRecord;
  }

  const store = getStore();

  // Ring buffer: keep only the last MAX_OPERATIONS entries
  store.operations.push(record);
  if (store.operations.length > MAX_OPERATIONS) {
    store.operations = store.operations.slice(
      store.operations.length - MAX_OPERATIONS,
    );
  }

  // Update per-command stats
  const stats: CommandStats = store.commandStats[record.command] ?? {
    totalCalls: 0,
    successCount: 0,
    failureCount: 0,
    avgDurationMs: 0,
  };

  const prevTotal = stats.totalCalls;
  stats.totalCalls += 1;

  if (record.success) {
    stats.successCount += 1;
  } else {
    stats.failureCount += 1;
    stats.lastFailureReason = record.error;
  }

  // Running average duration
  stats.avgDurationMs =
    (stats.avgDurationMs * prevTotal + record.durationMs) / stats.totalCalls;

  store.commandStats[record.command] = stats;

  // Trigger adaptive parameter adjustment
  adaptParams();

  // Persist
  saveMetrics(store);

  logger.debug(
    `Recorded ${record.success ? "success" : "failure"} for "${record.command}" ` +
      `(${record.durationMs}ms, ${record.nodeCount} nodes, chunk ${record.chunkSize})`,
  );
}

/**
 * Returns current adaptive parameters. The returned object includes both
 * the canonical AdaptiveParams fields and convenience aliases (timeoutMs,
 * backoffMs) expected by connection.ts retry logic.
 */
export function getAdaptiveParams(): {
  timeoutMs: number;
  maxRetries: number;
  backoffMs: number;
  maxNodesPerChunk: number;
  baseTimeoutMs: number;
  retryBackoffMs: number;
  lastUpdated: number;
} {
  const store = getStore();
  const p = store.adaptiveParams;
  return {
    // Aliases expected by connection.ts
    timeoutMs: p.baseTimeoutMs,
    maxRetries: p.maxRetries,
    backoffMs: p.retryBackoffMs,
    // Full AdaptiveParams fields
    maxNodesPerChunk: p.maxNodesPerChunk,
    baseTimeoutMs: p.baseTimeoutMs,
    retryBackoffMs: p.retryBackoffMs,
    lastUpdated: p.lastUpdated,
  };
}

/**
 * Returns the recommended chunk size for a given command and node count.
 * Prefers the per-command optimal size when available, otherwise uses global.
 * Never goes below MIN_CHUNK_SIZE or above MAX_CHUNK_SIZE.
 *
 * When called with no arguments, returns the current global maxNodesPerChunk
 * (used by node-tree.ts for simple chunk sizing).
 */
export function getOptimalChunkSize(
  command?: string,
  nodeCount?: number,
): number {
  const store = getStore();

  let chunkSize: number;

  if (command) {
    const stats = store.commandStats[command];
    if (stats?.optimalChunkSize !== undefined) {
      chunkSize = stats.optimalChunkSize;
    } else {
      chunkSize = store.adaptiveParams.maxNodesPerChunk;
    }
  } else {
    chunkSize = store.adaptiveParams.maxNodesPerChunk;
  }

  // When nodeCount is provided, never exceed it
  const upperBound = nodeCount !== undefined
    ? Math.min(MAX_CHUNK_SIZE, nodeCount)
    : MAX_CHUNK_SIZE;

  return clamp(chunkSize, MIN_CHUNK_SIZE, upperBound);
}

/**
 * Returns the recommended timeout for a given command.
 * If the command's average duration approaches the current timeout, bumps it
 * by TIMEOUT_INCREASE_FACTOR so the next call has headroom.
 */
export function getOptimalTimeout(command: string): number {
  const store = getStore();
  const stats = store.commandStats[command];
  let timeout = store.adaptiveParams.baseTimeoutMs;

  if (stats && stats.avgDurationMs > timeout * 0.8) {
    timeout = Math.ceil(stats.avgDurationMs * TIMEOUT_INCREASE_FACTOR);
    logger.debug(
      `Timeout for "${command}" raised to ${timeout}ms based on avg duration ${Math.round(stats.avgDurationMs)}ms`,
    );
  }

  return timeout;
}

/**
 * Analyzes recent operation history and adjusts adaptive parameters:
 *
 * Per-command chunk size:
 *   - >20% failure rate in last 20 ops: reduce chunk size by 25%
 *   - <5% failure rate AND avg duration < 10s: increase chunk size by 10%
 *   - Never below 5 or above 50 nodes/chunk
 *
 * Global timeout:
 *   - Timeout errors detected: increase baseTimeoutMs by 50%
 *
 * Global chunk size:
 *   - Same thresholds applied to the last 20 operations across all commands
 */
export function adaptParams(): void {
  const store = getStore();

  // Collect distinct commands that appear in operations
  const commandsSeen = new Set<string>();
  for (const op of store.operations) {
    commandsSeen.add(op.command);
  }

  let globalTimeoutBumped = false;

  for (const command of commandsSeen) {
    const recent = recentOpsForCommand(store, command, RECENT_WINDOW);
    if (recent.length < 3) {
      // Not enough data to adapt for this command
      continue;
    }

    const failures = recent.filter((op) => !op.success);
    const failureRate = failures.length / recent.length;

    // Check for timeout-specific errors
    const timeoutFailures = failures.filter(
      (op) =>
        op.error !== undefined &&
        (op.error.toLowerCase().includes("timeout") ||
          op.error.toLowerCase().includes("timed out")),
    );

    // --- Chunk size adaptation ---

    const currentChunk =
      store.commandStats[command]?.optimalChunkSize ??
      store.adaptiveParams.maxNodesPerChunk;

    if (failureRate > HIGH_FAILURE_THRESHOLD) {
      // Too many failures -- shrink chunk size by 25%
      const newChunk = clamp(
        Math.floor(currentChunk * CHUNK_DECREASE_FACTOR),
        MIN_CHUNK_SIZE,
        MAX_CHUNK_SIZE,
      );

      if (newChunk !== currentChunk && store.commandStats[command]) {
        store.commandStats[command].optimalChunkSize = newChunk;
        logger.info(
          `Adaptive: "${command}" failure rate ${(failureRate * 100).toFixed(0)}% ` +
            `> ${HIGH_FAILURE_THRESHOLD * 100}% -- chunk size ${currentChunk} -> ${newChunk}`,
        );
      }
    } else if (failureRate < LOW_FAILURE_THRESHOLD) {
      // Very reliable -- check if we can safely grow
      const successfulOps = recent.filter((op) => op.success);
      const avgDuration =
        successfulOps.reduce((sum, op) => sum + op.durationMs, 0) /
        (successfulOps.length || 1);

      if (avgDuration < FAST_DURATION_THRESHOLD_MS) {
        const newChunk = clamp(
          Math.ceil(currentChunk * CHUNK_INCREASE_FACTOR),
          MIN_CHUNK_SIZE,
          MAX_CHUNK_SIZE,
        );

        if (newChunk !== currentChunk && store.commandStats[command]) {
          store.commandStats[command].optimalChunkSize = newChunk;
          logger.info(
            `Adaptive: "${command}" healthy (${(failureRate * 100).toFixed(0)}% fail, ` +
              `${Math.round(avgDuration)}ms avg) -- chunk size ${currentChunk} -> ${newChunk}`,
          );
        }
      }
    }

    // --- Timeout adaptation ---

    if (timeoutFailures.length > 0 && !globalTimeoutBumped) {
      const oldTimeout = store.adaptiveParams.baseTimeoutMs;
      store.adaptiveParams.baseTimeoutMs = Math.ceil(
        oldTimeout * TIMEOUT_INCREASE_FACTOR,
      );
      globalTimeoutBumped = true;
      logger.info(
        `Adaptive: timeout errors detected for "${command}" -- ` +
          `baseTimeoutMs ${oldTimeout} -> ${store.adaptiveParams.baseTimeoutMs}`,
      );
    }
  }

  // --- Global maxNodesPerChunk adaptation ---

  if (store.operations.length >= RECENT_WINDOW) {
    const tail = store.operations.slice(-RECENT_WINDOW);
    const globalFailureRate =
      tail.filter((op) => !op.success).length / tail.length;

    if (globalFailureRate > HIGH_FAILURE_THRESHOLD) {
      const old = store.adaptiveParams.maxNodesPerChunk;
      store.adaptiveParams.maxNodesPerChunk = clamp(
        Math.floor(old * CHUNK_DECREASE_FACTOR),
        MIN_CHUNK_SIZE,
        MAX_CHUNK_SIZE,
      );
      if (store.adaptiveParams.maxNodesPerChunk !== old) {
        logger.info(
          `Adaptive: global failure rate ${(globalFailureRate * 100).toFixed(0)}% -- ` +
            `global chunk size ${old} -> ${store.adaptiveParams.maxNodesPerChunk}`,
        );
      }
    } else if (globalFailureRate < LOW_FAILURE_THRESHOLD) {
      const successfulTail = tail.filter((op) => op.success);
      const avgDuration =
        successfulTail.reduce((sum, op) => sum + op.durationMs, 0) /
        (successfulTail.length || 1);

      if (avgDuration < FAST_DURATION_THRESHOLD_MS) {
        const old = store.adaptiveParams.maxNodesPerChunk;
        store.adaptiveParams.maxNodesPerChunk = clamp(
          Math.ceil(old * CHUNK_INCREASE_FACTOR),
          MIN_CHUNK_SIZE,
          MAX_CHUNK_SIZE,
        );
        if (store.adaptiveParams.maxNodesPerChunk !== old) {
          logger.info(
            `Adaptive: global healthy (${(globalFailureRate * 100).toFixed(0)}% fail, ` +
              `${Math.round(avgDuration)}ms avg) -- global chunk size ${old} -> ${store.adaptiveParams.maxNodesPerChunk}`,
          );
        }
      }
    }
  }

  store.adaptiveParams.lastUpdated = Date.now();
}
