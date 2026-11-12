// The CodeMap file, <codeRepo>/.l2f/code-map.json (L2F_CODE_MAP): parsing,
// entry validation, merging, and the only write this feature makes to a
// CodeRepo. Writes are refused through a symlinked .l2f or CodeMap, never
// overwrite a file that is not a CodeMap, run one at a time per path, and go
// through a uniquely named temp file that is renamed only if the original is
// unchanged since it was read.

import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  CodeRepoError, clip, customFileExists, installedPackageVersion, isInside, manifestDependencies, readManifest,
  SCAN_LIMITS, scanPackage, splitSpecifier, type PackageScan,
} from "./code-repo.js";

export const CODE_MAP_DIR = ".l2f";
export const CODE_MAP_FILE = "code-map.json";

export type PropValue = string | number | boolean | null;
export type PropRule =
  | { prop: string; values?: Record<string, PropValue> }
  | { values: Record<string, Record<string, PropValue> | null> }
  | { children: true }
  | { ignore: true };
export type CodeImport = { from: string; name: string; default?: true } | { tag: string };
export interface CodeMapEntry {
  figmaName: string;
  status: "package" | "custom" | "missing";
  import?: CodeImport;
  props?: Record<string, PropRule>;
  variants?: { when: Record<string, string>; import: CodeImport; props?: Record<string, PropRule> }[];
  verified: boolean;
  note?: string;
}
export interface CodeMap {
  l2fCodeMap: 1;
  packages: Record<string, string>;
  components: Record<string, CodeMapEntry>;
  tokens: Record<string, string>;
}

export const emptyCodeMap = (): CodeMap => ({ l2fCodeMap: 1, packages: {}, components: {}, tokens: {} });

const isRecord = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);

/** Parse text as a CodeMap, or null when it is not one. */
export function parseCodeMap(text: string): CodeMap | null {
  let json: any;
  try { json = JSON.parse(text); } catch { return null; }
  if (!isRecord(json) || json.l2fCodeMap !== 1) return null;
  if (!isRecord(json.packages) || !isRecord(json.components) || !isRecord(json.tokens)) return null;
  return json as CodeMap;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const FIGMA_KEY = /^[A-Za-z0-9:_-]{1,128}$/;

/** A component or component set key; `__proto__` would set a record's prototype instead of a key. */
export const isFigmaKey = (key: string) => FIGMA_KEY.test(key) && key !== "__proto__";
const DOTTED_NAME = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;
const TAG = /^[A-Za-z][A-Za-z0-9.:_-]{0,99}$/;
const PROP_NAME = /^[A-Za-z_$][\w$-]{0,99}$/;
const ENTRY_KEYS = new Set(["figmaName", "status", "import", "props", "variants", "verified", "note"]);

const isLiteral = (v: unknown) => v === null || ["string", "number", "boolean"].includes(typeof v);

/** Reason a PropRules object is invalid, or null. Collects the code props it maps into `mapped`. */
function propRulesError(props: unknown, mapped: Set<string>): string | null {
  if (!isRecord(props)) return "props must be an object of PropRules";
  for (const [figmaProp, rule] of Object.entries(props)) {
    const bad = `props.${figmaProp} is not a valid PropRule`;
    if (!isRecord(rule)) return bad;
    const keys = Object.keys(rule).sort().join(",");
    if (keys === "children") { if (rule.children !== true) return bad; continue; }
    if (keys === "ignore") { if (rule.ignore !== true) return bad; continue; }
    if (keys === "prop" || keys === "prop,values") {
      if (typeof rule.prop !== "string" || !PROP_NAME.test(rule.prop)) return bad;
      if (rule.values !== undefined && (!isRecord(rule.values) || !Object.values(rule.values).every(isLiteral))) return bad;
      mapped.add(rule.prop);
      continue;
    }
    if (keys === "values") {
      if (!isRecord(rule.values)) return bad;
      for (const set of Object.values(rule.values)) {
        if (set === null) continue;
        if (!isRecord(set) || !Object.entries(set).every(([k, v]) => PROP_NAME.test(k) && isLiteral(v))) return bad;
        for (const k of Object.keys(set)) mapped.add(k);
      }
      continue;
    }
    return bad;
  }
  return null;
}

function importShapeError(imp: unknown): string | null {
  if (!isRecord(imp)) return "import must be {from, name, default?} or {tag}";
  const keys = Object.keys(imp).sort().join(",");
  if (keys === "tag") return typeof imp.tag === "string" && TAG.test(imp.tag) ? null : "import.tag is not a valid tag name";
  if (keys !== "from,name" && keys !== "default,from,name") return "import must be {from, name, default?} or {tag}";
  if (typeof imp.from !== "string" || imp.from.length === 0 || imp.from.length > SCAN_LIMITS.text) return `import.from must be a string of 1 to ${SCAN_LIMITS.text} characters`;
  if (typeof imp.name !== "string" || imp.name.length > SCAN_LIMITS.text || !DOTTED_NAME.test(imp.name)) return "import.name must be an identifier, optionally dotted";
  if ("default" in imp && imp.default !== true) return "import.default may only be true";
  return null;
}

export interface ValidationContext {
  root: string;
  manifestPath: string;
  dependencies: string[];
  /** Cached scans, by import `from`. */
  scans: Map<string, PackageScan | CodeRepoError>;
}

export function makeValidationContext(root: string, manifestPath: string): ValidationContext {
  return { root, manifestPath, dependencies: manifestDependencies(readManifest(root, manifestPath)), scans: new Map() };
}

async function scanFor(ctx: ValidationContext, from: string): Promise<PackageScan | CodeRepoError> {
  if (!ctx.scans.has(from)) {
    try { ctx.scans.set(from, await scanPackage(ctx.root, ctx.manifestPath, from)); }
    catch (error) {
      if (!(error instanceof CodeRepoError)) throw error;
      ctx.scans.set(from, error);
    }
  }
  return ctx.scans.get(from)!;
}

export interface ValidatedEntry { entry: CodeMapEntry; packages: string[] }

/**
 * Validate one entry. Returns the entry as it will be written (with `verified`
 * set by the tool) and the packages it uses, or a reason it is rejected.
 */
export async function validateEntry(ctx: ValidationContext, figmaKey: string, input: unknown): Promise<ValidatedEntry | { reason: string }> {
  if (!isFigmaKey(figmaKey)) return { reason: "figmaKey is not a valid component or component set key" };
  if (!isRecord(input)) return { reason: "entry must be an object or null" };
  const unknownKey = Object.keys(input).find((k) => !ENTRY_KEYS.has(k));
  if (unknownKey) return { reason: `unknown field ${unknownKey}` };
  if (typeof input.figmaName !== "string" || input.figmaName.trim() === "") return { reason: "figmaName is required" };
  if (input.figmaName.length > SCAN_LIMITS.text) return { reason: `figmaName is longer than ${SCAN_LIMITS.text} characters` };
  if (!["package", "custom", "missing"].includes(input.status)) return { reason: "status must be package, custom or missing" };
  if (input.note !== undefined && typeof input.note !== "string") return { reason: "note must be a string" };

  // Every (import, props) pair the entry declares: the entry's own and each variant's.
  const pairs: { import?: any; props?: any; where: string }[] = [{ import: input.import, props: input.props, where: "entry" }];
  if (input.variants !== undefined) {
    if (!Array.isArray(input.variants)) return { reason: "variants must be an array" };
    for (const [i, variant] of input.variants.entries()) {
      if (!isRecord(variant) || Object.keys(variant).some((k) => !["when", "import", "props"].includes(k))) return { reason: `variants[${i}] must be {when, import, props?}` };
      if (!isRecord(variant.when) || Object.keys(variant.when).length === 0 || !Object.values(variant.when).every((v) => typeof v === "string")) {
        return { reason: `variants[${i}].when must map Figma properties to values` };
      }
      if (variant.import === undefined) return { reason: `variants[${i}] needs an import` };
      pairs.push({ import: variant.import, props: variant.props, where: `variants[${i}]` });
    }
  }

  if (input.status === "missing") {
    if (input.import !== undefined || (input.variants?.length ?? 0) > 0) return { reason: "a missing entry has no import" };
  } else if (input.import === undefined && !((input.variants?.length ?? 0) > 0)) {
    return { reason: `a ${input.status} entry needs an import on the entry or on every variant` };
  }

  let verified = input.status !== "missing";
  const packages = new Set<string>();
  // Entry-level props on an entry with no import of its own apply to every
  // variant's import, so they are checked against each of them.
  let entryMapped = new Set<string>();
  for (const pair of pairs) {
    const mapped = new Set<string>();
    if (pair.props !== undefined) {
      const error = propRulesError(pair.props, mapped);
      if (error) return { reason: pair.where === "entry" ? error : `${pair.where}.${error}` };
    }
    if (pair.where === "entry") entryMapped = mapped;
    else if (input.import === undefined) for (const prop of entryMapped) mapped.add(prop);
    if (pair.import === undefined) continue;
    const shape = importShapeError(pair.import);
    if (shape) return { reason: pair.where === "entry" ? shape : `${pair.where}.${shape}` };
    const imp = pair.import;
    if ("tag" in imp) { verified = false; continue; }

    if (input.status === "custom") {
      // Custom components are not scanned: only whether the file exists is checked, so props are never confirmed.
      try { if (!customFileExists(ctx.root, imp.from)) return { reason: `custom file not found: ${imp.from}` }; }
      catch (error) { if (error instanceof CodeRepoError) return { reason: error.message }; throw error; }
      if (mapped.size > 0) verified = false;
      continue;
    }

    let name: string;
    try { name = splitSpecifier(imp.from).name; }
    catch (error) { if (error instanceof CodeRepoError) return { reason: error.message }; throw error; }
    if (!ctx.dependencies.includes(name)) return { reason: `${clip(name)} is not a dependency in the Manifest` };
    packages.add(name);
    const scan = await scanFor(ctx, imp.from);
    if (scan instanceof CodeRepoError) return { reason: scan.message };
    if (scan.noDeclarations) { verified = false; continue; }
    const exportName = imp.default ? "default" : imp.name.split(".")[0];
    if (!scan.exportNames.has(exportName)) {
      return { reason: imp.default ? `${imp.from} has no default export` : `${exportName} is not exported by ${imp.from}` };
    }
    if (mapped.size === 0) continue;
    const props = scan.propsByExport.get(exportName);
    const confirmed = !imp.name.includes(".") && props?.propsState === "complete" && [...mapped].every((p) => props.props.includes(p));
    if (!confirmed) verified = false;
  }

  const entry: CodeMapEntry = { figmaName: input.figmaName, status: input.status };
  if (input.import !== undefined) entry.import = input.import;
  if (input.props !== undefined) entry.props = input.props;
  if (input.variants !== undefined) entry.variants = input.variants;
  entry.verified = verified;
  if (input.note !== undefined) entry.note = input.note;
  return { entry, packages: [...packages] };
}

/** Installed version of a package, or null when it is not installed or has none. */
export function installedVersion(ctx: ValidationContext, name: string): string | null {
  return installedPackageVersion(ctx.root, dirname(ctx.manifestPath), name);
}

const TOKEN_KEY = /^[^\u0000-\u001f]{1,200}$/;

export function tokenError(name: string, value: unknown): string | null {
  if (!TOKEN_KEY.test(name) || !name.includes("/")) return `token ${name} must be named Collection/Name`;
  if (value !== null && (typeof value !== "string" || value.length === 0 || value.length > 200)) return `token ${name} must map to a non-empty string or null`;
  return null;
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

export interface CodeMapChanges {
  entries: Record<string, CodeMapEntry | null>;
  tokens: Record<string, string | null>;
  packages: Record<string, string>;
}

const sortKeys = <T>(record: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.keys(record).sort().map((k) => [k, record[k]]));

/** Apply changes to a CodeMap: entries and tokens set or removed, package versions recorded. */
export function mergeCodeMap(base: CodeMap, changes: CodeMapChanges): { map: CodeMap; written: string[]; removed: string[] } {
  const components = { ...base.components };
  const tokens = { ...base.tokens };
  const written: string[] = [], removed: string[] = [];
  for (const [key, entry] of Object.entries(changes.entries)) {
    if (entry === null) { if (Object.hasOwn(components, key)) { delete components[key]; removed.push(key); } }
    else { components[key] = entry; written.push(key); }
  }
  for (const [name, value] of Object.entries(changes.tokens)) {
    if (value === null) delete tokens[name];
    else tokens[name] = value;
  }
  return {
    map: { ...base, l2fCodeMap: 1, packages: sortKeys({ ...base.packages, ...changes.packages }), components: sortKeys(components), tokens: sortKeys(tokens) },
    written, removed,
  };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

const queues = new Map<string, Promise<unknown>>();

/** Run `task` after every earlier task queued for the same path. */
export function enqueue<T>(path: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(path) ?? Promise.resolve();
  const run = previous.then(task, task);
  const settled = run.then(() => undefined, () => undefined);
  queues.set(path, settled);
  settled.then(() => { if (queues.get(path) === settled) queues.delete(path); });
  return run;
}

const hashOf = (text: string | null) => (text === null ? "absent" : createHash("sha256").update(text).digest("hex"));

/**
 * The CodeMap's text, or null when absent. Opened non-blocking and without
 * following a symlink, and read only when the open file is a regular file, so
 * a FIFO or a link swapped in cannot block or redirect the read.
 */
async function readIfPresent(file: string): Promise<string | null> {
  let handle;
  try { handle = await open(file, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0) | (constants.O_NOFOLLOW ?? 0)); }
  catch (error: any) {
    if (error?.code === "ENOENT") return null;
    if (error?.code === "ELOOP" || error?.code === "EMLINK") throw new CodeRepoError("the code map could not be opened without following a link; refusing to write it");
    throw error;
  }
  try {
    if (!(await handle.stat()).isFile()) throw new CodeRepoError("the code map path is not a file; refusing to write it");
    return await handle.readFile("utf8");
  } finally {
    await handle.close();
  }
}

async function lstatOrNull(path: string) {
  try { return await lstat(path); }
  catch (error: any) { if (error?.code === "ENOENT") return null; throw error; }
}

/** Refuse a symlinked or misplaced .l2f or CodeMap. Creates .l2f when absent. */
async function checkWritePath(root: string, hooks: WriteHooks = {}): Promise<string> {
  const dir = join(root, CODE_MAP_DIR);
  let dirStat = await lstatOrNull(dir);
  if (dirStat?.isSymbolicLink()) throw new CodeRepoError(".l2f is a symlink; refusing to write the code map");
  if (dirStat && !dirStat.isDirectory()) throw new CodeRepoError(".l2f is not a directory; refusing to write the code map");
  if (!dirStat) {
    await mkdir(dir).catch((error) => { if (error?.code !== "EEXIST") throw error; });
    dirStat = await lstat(dir);
    if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) throw new CodeRepoError(".l2f is not a directory; refusing to write the code map");
  }
  if (hooks.afterDirCheck) await hooks.afterDirCheck(dir);
  if (!isInside(await realpath(dir), root)) throw new CodeRepoError(".l2f resolves outside the CodeRepo; refusing to write the code map");
  const file = join(dir, CODE_MAP_FILE);
  const fileStat = await lstatOrNull(file);
  if (fileStat?.isSymbolicLink()) throw new CodeRepoError("the code map is a symlink; refusing to write it");
  if (fileStat && !fileStat.isFile()) throw new CodeRepoError("the code map path is not a file; refusing to write it");
  return file;
}

/** Test hooks: run at the named step, to simulate a concurrent change there. */
export interface WriteHooks {
  afterDirCheck?: (dir: string) => Promise<void>;
  beforeRename?: (file: string) => Promise<void>;
}

/** Refuse when .l2f or the CodeMap has become a symlink or something other than what was checked. */
async function recheckBeforeRename(root: string, file: string): Promise<void> {
  const dir = dirname(file);
  const dirStat = await lstatOrNull(dir);
  if (!dirStat || dirStat.isSymbolicLink() || !dirStat.isDirectory()) throw new CodeRepoError(".l2f changed while writing; refusing to write the code map");
  if (!isInside(await realpath(dir), root)) throw new CodeRepoError(".l2f resolves outside the CodeRepo; refusing to write the code map");
  const check = await lstatOrNull(file);
  if (check?.isSymbolicLink()) throw new CodeRepoError("the code map is a symlink; refusing to write it");
  if (check && !check.isFile()) throw new CodeRepoError("the code map path is not a file; refusing to write it");
}

/**
 * Read the CodeMap at <root>/.l2f/code-map.json, apply `update`, and write it
 * back. Queued per path; retried once if the file changes between read and
 * rename, then fails.
 */
export function updateCodeMap<R>(root: string, update: (current: CodeMap) => { map: CodeMap; result: R }, hooks: WriteHooks = {}): Promise<{ path: string; result: R }> {
  const target = join(root, CODE_MAP_DIR, CODE_MAP_FILE);
  return enqueue(target, async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const file = await checkWritePath(root, hooks);
      const original = await readIfPresent(file);
      let current = emptyCodeMap();
      if (original !== null) {
        const parsed = parseCodeMap(original);
        if (!parsed) throw new CodeRepoError(`${CODE_MAP_DIR}/${CODE_MAP_FILE} exists and is not a code map; not overwriting it`);
        current = parsed;
      }
      const { map, result } = update(current);
      const temp = join(dirname(file), `.${CODE_MAP_FILE}.${process.pid}.${randomUUID()}.tmp`);
      try {
        // O_EXCL: never reuse an existing path; O_NOFOLLOW: never write through a symlink planted at the temp name.
        const handle = await open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o644);
        try { await handle.writeFile(JSON.stringify(map, null, 2) + "\n"); }
        finally { await handle.close(); }
        if (hooks.beforeRename) await hooks.beforeRename(file);
        // Residual risk: Node has no renameat() on a held directory descriptor,
        // so between this re-check and rename() a process that can already
        // write the CodeRepo could still swap .l2f. The re-check narrows that
        // window to two syscalls; the temp file, opened O_EXCL|O_NOFOLLOW in
        // the checked directory, is never written through a link.
        await recheckBeforeRename(root, file);
        if (hashOf(await readIfPresent(file)) === hashOf(original)) {
          await rename(temp, file);
          return { path: file, result };
        }
      } finally {
        await unlink(temp).catch(() => undefined);
      }
    }
    throw new CodeRepoError("the code map changed while writing");
  });
}
