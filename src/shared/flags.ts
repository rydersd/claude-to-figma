// Server-side feature flags. A flag is read from the environment of the MCP
// server process only; no tool parameter or client-sent value can set one.

export const FEATURES = [
  "FILE_KEY", "COMMENTS", "COMMENTS_WRITE", "FLOWS", "VARIABLES_WRITE",
  "COMPONENT_PROPERTIES", "GRID_LAYOUT", "VERIFY", "SPEC_SYNC", "DEV_MODE", "SLIDES", "TEXT_PATH",
] as const;

export type Feature = (typeof FEATURES)[number];

// Features that L2F_ALL does not enable; each needs its own L2F_<FEATURE>=1.
const OWN_FLAG_ONLY: readonly Feature[] = ["COMMENTS_WRITE"];

export function isEnabled(feature: Feature, env: Record<string, string | undefined> = process.env): boolean {
  if (env[`L2F_${feature}`] === "1") return true;
  return env.L2F_ALL === "1" && !OWN_FLAG_ONLY.includes(feature);
}

// Registers a feature's tool module only when its flag is on. Returns whether it ran.
export function registerWhenEnabled<S, C>(
  feature: Feature,
  register: (server: S, send: C) => void,
  server: S,
  send: C,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!isEnabled(feature, env)) return false;
  register(server, send);
  return true;
}
