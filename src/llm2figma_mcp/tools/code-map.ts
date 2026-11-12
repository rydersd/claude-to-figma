import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  SCAN_LIMITS, manifestDependencies, openCodeRepo, readManifest, resolveManifest, scanPackage,
} from "../code-repo.js";
import {
  installedVersion, makeValidationContext, mergeCodeMap, tokenError, updateCodeMap, validateEntry,
  type CodeMapEntry,
} from "../code-map.js";

// Code map tools (L2F_CODE_MAP). Registered only when the flag is on; see server.ts.

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

function asToolError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text" as const, text: `Code map error: ${message}` }], isError: true };
}

const cap = <T>(list: T[]) => list.slice(0, SCAN_LIMITS.rows);

const LIMITS =
  "Reads TypeScript declaration files as text and never runs anything from the repository. Packages without declarations " +
  "(Vue single-file components, Angular modules, web-component manifests) scan as noDeclarations; map them by hand, unverified.";

export async function scanCodeComponents(args: { codeRepo: string; manifest?: string; package?: string }) {
  const root = openCodeRepo(args.codeRepo);
  const manifestPath = resolveManifest(root, args.manifest);
  if (!args.package) {
    const dependencies = manifestDependencies(readManifest(root, manifestPath));
    return { dependencies: cap(dependencies), truncated: dependencies.length > SCAN_LIMITS.rows };
  }
  const scan = scanPackage(root, manifestPath, args.package);
  return {
    package: scan.package,
    packageVersion: scan.packageVersion,
    ...(scan.installed ? {} : { installed: false }),
    noDeclarations: scan.noDeclarations,
    components: scan.components,
    ...(scan.unfollowed.length ? { unfollowed: scan.unfollowed } : {}),
    truncated: scan.truncated,
  };
}

export async function setCodeMapEntries(
  args: { codeRepo: string; manifest?: string; entries: Record<string, unknown>; tokens?: Record<string, string | null> },
  hooks?: Parameters<typeof updateCodeMap>[2],
) {
  const root = openCodeRepo(args.codeRepo);
  const manifestPath = resolveManifest(root, args.manifest);
  const ctx = makeValidationContext(root, manifestPath);

  const rejected: { figmaKey: string; reason: string }[] = [];
  const entries: Record<string, CodeMapEntry | null> = {};
  const used = new Set<string>();
  for (const [figmaKey, input] of Object.entries(args.entries ?? {})) {
    if (input === null) { entries[figmaKey] = null; continue; }
    const result = validateEntry(ctx, figmaKey, input);
    if ("reason" in result) { rejected.push({ figmaKey, reason: result.reason }); continue; }
    entries[figmaKey] = result.entry;
    for (const name of result.packages) used.add(name);
  }
  const tokens: Record<string, string | null> = {};
  for (const [name, value] of Object.entries(args.tokens ?? {})) {
    const error = tokenError(name, value);
    if (error) rejected.push({ figmaKey: `token:${name}`, reason: error });
    else tokens[name] = value;
  }
  const packages: Record<string, string> = {};
  for (const name of used) {
    const version = installedVersion(ctx, name);
    if (version) packages[name] = version;
  }

  const { path, result } = await updateCodeMap(root, (current) => {
    const merged = mergeCodeMap(current, { entries, tokens, packages });
    return { map: merged.map, result: merged };
  }, hooks);
  const unverified = Object.entries(entries)
    .filter(([, e]) => e && e.status !== "missing" && !e.verified)
    .map(([key]) => key);
  const lists = [result.written, result.removed, rejected, unverified];
  return {
    path,
    written: cap(result.written),
    removed: cap(result.removed),
    rejected: cap(rejected),
    unverified: cap(unverified),
    ...(lists.some((l) => l.length > SCAN_LIMITS.rows) ? { truncated: true } : {}),
  };
}

const codeRepoParam = z.string().describe("Absolute path to the code repository (the CodeRepo). Required on every call; never remembered.");
const manifestParam = z.string().optional().describe("package.json listing the design-system dependencies, relative to codeRepo (default: package.json). Use it for a workspace package, e.g. apps/web/package.json.");

export function registerTools(server: McpServer) {
  server.tool(
    "scan_code_components",
    "List the components a design-system package in a code repository exports. Without `package`, returns the Manifest's dependency names only, so the caller can pick. " +
      "With `package` (a dependency name, or name/subpath), returns {package, packageVersion, noDeclarations, components: [{name, from, props, propsState}], truncated}. " +
      "Only PascalCase value exports are components. propsState is complete, partial (extends, intersections, generics, Omit/Pick) or unknown. " +
      LIMITS,
    {
      codeRepo: codeRepoParam,
      manifest: manifestParam,
      package: z.string().optional().describe("A dependency from the Manifest, optionally with a subpath (pkg/Button)"),
    },
    async (args: any) => {
      try { return text(await scanCodeComponents(args)); }
      catch (error) { return asToolError(error); }
    },
  );

  server.tool(
    "set_code_map_entries",
    "Merge entries into the code map, <codeRepo>/.l2f/code-map.json (the only file these tools write), creating it when absent. " +
      "Each entry maps a Figma component or component-set key to {figmaName, status: package|custom|missing, import?, props?, variants?, note?}. " +
      "import is {from, name, default?} (from: a dependency or dependency/subpath for package, a path relative to codeRepo for custom; name may be dotted, e.g. Card.Header) or {tag}. " +
      "props maps Figma property names to PropRules: {prop}, {prop, values}, {values: {<figma value>: {<codeProp>: literal} | null}}, {children: true} or {ignore: true}. " +
      "variants: [{when: {<figma property>: value}, import, props?}], checked in order before the entry's import. null removes a key. " +
      "verified is set by this tool from a scan, never by the caller. Returns {path, written, removed, rejected: [{figmaKey, reason}], unverified}; rejected entries are not written. " +
      LIMITS,
    {
      codeRepo: codeRepoParam,
      manifest: manifestParam,
      entries: z.record(z.union([z.record(z.any()), z.null()])).describe("figmaKey → CodeMapEntry, or null to remove"),
      tokens: z.record(z.union([z.string(), z.null()])).optional().describe("Collection/Name → code token name, or null to remove"),
    },
    async (args: any) => {
      try { return text(await setCodeMapEntries(args)); }
      catch (error) { return asToolError(error); }
    },
  );
}
