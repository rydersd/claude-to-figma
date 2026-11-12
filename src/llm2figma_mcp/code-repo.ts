// Reading a user's code repository (the CodeRepo) for the code map (L2F_CODE_MAP).
//
// Everything here is read-only and text-only: the Manifest, package.json files
// and declaration files (.d.ts, .d.mts, .d.cts) of the packages it lists, read
// as text and scanned with bounded patterns. Nothing from the CodeRepo is ever
// imported, required, compiled or run, and no package manager is called. Every
// path is resolved through realpath and must stay inside the CodeRepo (and
// declaration files inside their package) before it is read, and only regular
// files are read (a FIFO or device would block the server).
//
// The CodeRepo is untrusted input. Every pattern is bounded (no nested or
// unbounded quantifiers), every bracket scan is capped, each file has a step
// budget and each scan a type-evaluation budget and a total-bytes budget, so a
// hostile package costs bounded time and yields truncated: true. The scan
// yields to the event loop between files so other tools keep running.

import { closeSync, constants, existsSync, fstatSync, lstatSync, openSync, readSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export class CodeRepoError extends Error {}

export const SCAN_LIMITS = {
  files: 400,
  fileBytes: 2 * 1024 * 1024,
  /** Declaration bytes read across one scan. */
  totalBytes: 16 * 1024 * 1024,
  exports: 2000,
  rows: 100,
  /** Characters one bracket, semicolon or keyword search may cover. */
  bracketScan: 64 * 1024,
  /** Characters of bracket and semicolon scanning per declaration file. */
  parseSteps: 8 * 1024 * 1024,
  /** Characters of type text evaluated per scan (memoised evaluations are free). */
  evalSteps: 4 * 1024 * 1024,
  /** Longest package-derived string returned or written. */
  text: 200,
  /** Props per component. */
  props: 100,
  /** Unfollowed specifiers listed. */
  unfollowed: 20,
};

/** `text` cut to SCAN_LIMITS.text characters. */
export const clip = (text: string, max = SCAN_LIMITS.text) => (text.length > max ? text.slice(0, max) : text);

const yieldToEventLoop = () => new Promise<void>((done) => setImmediate(done));

/**
 * Read a regular file as UTF-8, at most `maxBytes`; null when it is larger.
 * Refuses anything that is not a regular file (FIFO, socket, device,
 * directory). The stat is repeated on the open descriptor, which is opened
 * non-blocking and without following a final symlink, so a swap after the
 * first check cannot block the read or redirect it.
 */
export function readRegularFile(real: string, maxBytes: number, label: string): string | null {
  if (!statSync(real).isFile()) throw new CodeRepoError(`${label} is not a regular file`);
  let fd: number;
  try { fd = openSync(real, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0) | (constants.O_NOFOLLOW ?? 0)); }
  catch { throw new CodeRepoError(`${label} could not be opened as a regular file`); }
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new CodeRepoError(`${label} is not a regular file`);
    if (stat.size > maxBytes) return null;
    const buffer = Buffer.alloc(stat.size);
    let read = 0;
    while (read < stat.size) {
      const n = readSync(fd, buffer, read, stat.size - read, read);
      if (n === 0) break;
      read += n;
    }
    return buffer.subarray(0, read).toString("utf8");
  } finally {
    closeSync(fd);
  }
}

const DECL_EXT = /\.d\.(ts|mts|cts)$/;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export function isInside(child: string, parent: string): boolean {
  return child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep);
}

function realpathOrNull(path: string): string | null {
  try { return realpathSync(path); } catch { return null; }
}

/** The CodeRepo's real root. `codeRepo` must be an absolute path to a directory. */
export function openCodeRepo(codeRepo: string): string {
  if (typeof codeRepo !== "string" || !isAbsolute(codeRepo)) throw new CodeRepoError("codeRepo must be an absolute path");
  const root = realpathOrNull(codeRepo);
  if (!root || !statSync(root).isDirectory()) throw new CodeRepoError(`codeRepo is not a directory: ${codeRepo}`);
  return root;
}

/** The Manifest's real path: `<root>/package.json`, or `manifest` relative to the CodeRepo. */
export function resolveManifest(root: string, manifest?: string): string {
  const rel = manifest ?? "package.json";
  if (typeof rel !== "string" || isAbsolute(rel) || rel.includes("\\") || basename(rel) !== "package.json") {
    throw new CodeRepoError("manifest must be a path to a package.json relative to the CodeRepo");
  }
  const joined = resolve(root, rel);
  if (!isInside(joined, root)) throw new CodeRepoError("manifest is outside the CodeRepo");
  if (!existsSync(joined)) throw new CodeRepoError(`Manifest not found: ${clip(rel)}`);
  const real = realpathOrNull(joined);
  if (!real || !isInside(real, root)) throw new CodeRepoError("manifest resolves outside the CodeRepo");
  return real;
}

function readJsonInside(file: string, container: string): any {
  const real = realpathOrNull(file);
  if (!real || !isInside(real, container)) throw new CodeRepoError(`${basename(file)} resolves outside the CodeRepo`);
  const text = readRegularFile(real, SCAN_LIMITS.fileBytes, basename(file));
  if (text === null) throw new CodeRepoError(`${basename(file)} is too large`);
  try { return JSON.parse(text); }
  catch { throw new CodeRepoError(`${clip(relative(container, real) || basename(real))} is not valid JSON`); }
}

export function readManifest(root: string, manifestPath: string): any {
  const json = readJsonInside(manifestPath, root);
  if (!json || typeof json !== "object" || Array.isArray(json)) throw new CodeRepoError("Manifest is not a JSON object");
  return json;
}

/** Names in the Manifest's dependencies, devDependencies and peerDependencies, sorted and deduplicated. */
export function manifestDependencies(manifest: any): string[] {
  const names = new Set<string>();
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    const deps = manifest?.[field];
    if (deps && typeof deps === "object") for (const name of Object.keys(deps)) names.add(name);
  }
  return [...names].sort();
}

// ---------------------------------------------------------------------------
// Package names and subpaths
// ---------------------------------------------------------------------------

const NAME_PART = /^[A-Za-z0-9][A-Za-z0-9._~-]*$/;
const SUBPATH_PART = /^[A-Za-z0-9_@~-][A-Za-z0-9._@~-]*$/;

export function isValidPackageName(name: string): boolean {
  if (typeof name !== "string" || name.length === 0 || name.length > 214) return false;
  if (name.includes("..") || name.includes("\\")) return false;
  const parts = name.split("/");
  if (name.startsWith("@")) return parts.length === 2 && NAME_PART.test(parts[0].slice(1)) && NAME_PART.test(parts[1]);
  return parts.length === 1 && NAME_PART.test(name);
}

export function isValidSubpath(subpath: string): boolean {
  if (typeof subpath !== "string" || subpath.length === 0 || subpath.length > 300) return false;
  if (subpath.includes("..") || subpath.includes("\\")) return false;
  return subpath.split("/").every((part) => SUBPATH_PART.test(part));
}

/** Split `@scope/pkg/Button` into `{name: "@scope/pkg", subpath: "Button"}`, validating both. */
export function splitSpecifier(from: string): { name: string; subpath?: string } {
  if (typeof from !== "string") throw new CodeRepoError("package specifier must be a string");
  const parts = from.split("/");
  const count = from.startsWith("@") ? 2 : 1;
  const name = parts.slice(0, count).join("/");
  const subpath = parts.length > count ? parts.slice(count).join("/") : undefined;
  if (!isValidPackageName(name)) throw new CodeRepoError(`Invalid package name: ${clip(name)}`);
  if (subpath !== undefined && !isValidSubpath(subpath)) throw new CodeRepoError(`Invalid package subpath: ${clip(subpath)}`);
  return { name, subpath };
}

/**
 * Find an installed package by walking up `node_modules` directories from the
 * Manifest's directory to the CodeRepo root. Returns the package's real
 * directory, or null when it is not installed. A package that resolves outside
 * the CodeRepo is refused; a symlink into a store inside it (pnpm) is fine.
 */
export function findPackageDir(root: string, manifestDir: string, name: string): string | null {
  if (!isValidPackageName(name)) throw new CodeRepoError(`Invalid package name: ${clip(name)}`);
  let dir = manifestDir;
  while (isInside(dir, root)) {
    const candidate = join(dir, "node_modules", ...name.split("/"));
    let exists = false;
    try { lstatSync(candidate); exists = true; } catch { /* not here */ }
    if (exists) {
      const real = realpathOrNull(candidate);
      if (!real) throw new CodeRepoError(`Package ${name} is a broken link`);
      if (!isInside(real, root)) throw new CodeRepoError(`Package ${name} resolves outside the CodeRepo`);
      if (!statSync(real).isDirectory()) throw new CodeRepoError(`Package ${name} is not a directory`);
      return real;
    }
    if (dir === root) break;
    dir = dirname(dir);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Entry resolution
// ---------------------------------------------------------------------------

const JS_TO_DECL: [RegExp, string][] = [
  [/\.mjs$/, ".d.mts"], [/\.cjs$/, ".d.cts"], [/\.jsx?$/, ".d.ts"], [/\.mts$/, ".d.mts"], [/\.cts$/, ".d.cts"], [/\.tsx?$/, ".d.ts"],
];

/** Declaration-file candidates for a target path (with or without an extension). */
function declCandidates(target: string): string[] {
  if (DECL_EXT.test(target)) return [target];
  for (const [ext, decl] of JS_TO_DECL) if (ext.test(target)) return [target.replace(ext, decl)];
  return [`${target}.d.ts`, `${target}.d.mts`, `${target}.d.cts`, join(target, "index.d.ts"), join(target, "index.d.mts"), join(target, "index.d.cts")];
}

interface PackageCtx { dir: string; json: any }

/** First existing declaration file for `target` (relative to the package), contained in the package. */
function existingDecl(pkg: PackageCtx, target: unknown): string | null {
  if (typeof target !== "string" || target.length === 0) return null;
  for (const candidate of declCandidates(resolve(pkg.dir, target))) {
    if (!isInside(candidate, pkg.dir)) throw new CodeRepoError("A declarations path resolves outside the package");
    let isFile = false;
    try { isFile = statSync(candidate).isFile(); } catch { /* missing */ }
    if (!isFile) continue;
    const real = realpathOrNull(candidate);
    if (!real || !isInside(real, pkg.dir)) throw new CodeRepoError("A declarations path resolves outside the package");
    return real;
  }
  return null;
}

/** Declaration file for an exports conditions value: types, import.types, require.types, then default mapped. */
function fromConditions(pkg: PackageCtx, value: any): string | null {
  if (typeof value === "string") return existingDecl(pkg, value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return existingDecl(pkg, value.types)
    ?? existingDecl(pkg, value.import?.types)
    ?? existingDecl(pkg, value.require?.types)
    ?? (typeof value.default === "string" ? existingDecl(pkg, value.default) : fromConditions(pkg, value.default));
}

/** The exports entry for `key` ("." or "./Button"), including single-`*` patterns. */
function exportsEntry(exportsField: any, key: string): any {
  if (exportsField === undefined || exportsField === null) return undefined;
  const isMap = typeof exportsField === "object" && !Array.isArray(exportsField) && Object.keys(exportsField).some((k) => k.startsWith("."));
  if (!isMap) return key === "." ? exportsField : undefined;
  if (key in exportsField) return exportsField[key];
  for (const [pattern, value] of Object.entries(exportsField)) {
    const star = pattern.indexOf("*");
    if (star < 0 || pattern.indexOf("*", star + 1) >= 0) continue;
    const head = pattern.slice(0, star), tail = pattern.slice(star + 1);
    if (key.startsWith(head) && key.endsWith(tail) && key.length >= head.length + tail.length) {
      const match = key.slice(head.length, key.length - tail.length);
      return substitute(value, match);
    }
  }
  return null;
}

function substitute(value: any, match: string): any {
  if (typeof value === "string") return value.split("*").join(match);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, match)]));
  }
  return value;
}

/** typesVersions["*"] mapping for a request path ("index.d.ts" for the main entry, or a subpath). */
function fromTypesVersions(pkg: PackageCtx, request: string): string | null {
  const map = pkg.json?.typesVersions?.["*"];
  if (!map || typeof map !== "object") return null;
  for (const [pattern, targets] of Object.entries(map)) {
    const list = Array.isArray(targets) ? targets : [];
    let match: string | null = null;
    if (pattern === request || (pattern === "." && request === "index.d.ts")) match = "";
    else {
      const star = pattern.indexOf("*");
      if (star >= 0) {
        const head = pattern.slice(0, star), tail = pattern.slice(star + 1);
        if (request.startsWith(head) && request.endsWith(tail)) match = request.slice(head.length, request.length - tail.length);
      }
    }
    if (match === null) continue;
    for (const target of list) {
      const found = existingDecl(pkg, typeof target === "string" ? target.split("*").join(match) : null);
      if (found) return found;
    }
  }
  return null;
}

/** Resolve the main declaration entry of a package directory, or null. Steps follow the plan's order. */
function resolveMainEntry(pkg: PackageCtx): string | null {
  const json = pkg.json ?? {};
  const fromExports = json.exports !== undefined ? fromConditions(pkg, exportsEntry(json.exports, ".")) : null;
  return fromExports
    ?? existingDecl(pkg, json.types)
    ?? existingDecl(pkg, json.typings)
    ?? fromTypesVersions(pkg, "index.d.ts")
    ?? (typeof json.main === "string" ? existingDecl(pkg, json.main) : null)
    ?? existingDecl(pkg, "index.d.ts");
}

function resolveSubpathEntry(pkg: PackageCtx, name: string, subpath: string): string | null {
  const json = pkg.json ?? {};
  if (json.exports !== undefined) {
    const entry = exportsEntry(json.exports, `./${subpath}`);
    // The caller's name, never the package's own text, goes in the message.
    if (entry === undefined || entry === null) throw new CodeRepoError(`${clip(name)} does not export ./${clip(subpath)}`);
    return fromConditions(pkg, entry);
  }
  return fromTypesVersions(pkg, subpath) ?? existingDecl(pkg, subpath);
}

function readPackageJson(dir: string): any {
  return existsSync(join(dir, "package.json")) ? readJsonInside(join(dir, "package.json"), dir) : {};
}

/** Installed version of a package from its own package.json, or null when not installed or unversioned. */
export function installedPackageVersion(root: string, manifestDir: string, name: string): string | null {
  const dir = findPackageDir(root, manifestDir, name);
  if (!dir) return null;
  const version = readPackageJson(dir).version;
  return typeof version === "string" ? clip(version) : null;
}

/** `@types/<package>` name for a package: `@scope/x` → `@types/scope__x`. */
export function typesPackageName(name: string): string {
  return `@types/${name.startsWith("@") ? name.slice(1).replace("/", "__") : name}`;
}

// ---------------------------------------------------------------------------
// Declaration text scanning
// ---------------------------------------------------------------------------

/** Remove comments, keeping string literals and offsets of everything else roughly intact. */
export function stripComments(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (c === "/" && n === "/") { while (i < text.length && text[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { const end = text.indexOf("*/", i + 2); i = end < 0 ? text.length : end + 2; out += " "; continue; }
    if (c === "'" || c === '"' || c === "`") {
      const start = i++;
      while (i < text.length && text[i] !== c) { if (text[i] === "\\") i++; i++; }
      out += text.slice(start, ++i);
      continue;
    }
    out += c; i++;
  }
  return out;
}

/** Brace depth at each index (strings skipped). */
function braceDepths(text: string): Int32Array {
  const depth = new Int32Array(text.length + 1);
  let d = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "'" || c === '"' || c === "`") {
      depth[i] = d; const q = c; i++;
      while (i < text.length && text[i] !== q) { if (text[i] === "\\") { depth[i] = d; i++; } depth[i] = d; i++; }
      depth[i] = d; continue;
    }
    depth[i] = d;
    if (c === "{") d++;
    else if (c === "}") d = Math.max(0, d - 1);
  }
  depth[text.length] = d;
  return depth;
}

/** Characters of scanning left, shared by every scan of one declaration file. */
interface Budget { left: number }

const OPEN: Record<string, string> = { "{": "}", "(": ")", "[": "]", "<": ">" };

/**
 * Index just past the bracket that closes the one at `start`. At most
 * SCAN_LIMITS.bracketScan characters are scanned; an unclosed bracket ends there.
 */
function matchBracket(text: string, start: number, budget?: Budget): number {
  const end = Math.min(text.length, start + SCAN_LIMITS.bracketScan);
  const stack: string[] = [];
  let result = end;
  let i = start;
  for (; i < end; i++) {
    const c = text[i];
    if (c === "'" || c === '"' || c === "`") { const q = c; i++; while (i < end && text[i] !== q) { if (text[i] === "\\") i++; i++; } continue; }
    if (c === "=" && text[i + 1] === ">") { i++; continue; }
    if (OPEN[c]) stack.push(OPEN[c]);
    else if (c === stack[stack.length - 1]) { stack.pop(); if (stack.length === 0) { result = i + 1; break; } }
  }
  if (budget) budget.left -= Math.min(i, end) - start + 1;
  return result;
}

const NEW_DECLARATION = /^\s{0,40}(export|declare|import|interface|type)\b/;

/** Read from `start` until `;` (or end) at bracket depth 0, scanning at most SCAN_LIMITS.bracketScan characters. */
function readUntilSemicolon(text: string, start: number, budget: Budget): string {
  const end = Math.min(text.length, start + SCAN_LIMITS.bracketScan);
  let i = start;
  while (i < end) {
    const c = text[i];
    if (c === ";") break;
    if (c === "=" && text[i + 1] === ">") { i += 2; continue; }
    if (OPEN[c]) { i = matchBracket(text, i, budget); continue; }
    if (c === "'" || c === '"' || c === "`") { const q = c; i++; while (i < end && text[i] !== q) { if (text[i] === "\\") i++; i++; } i++; continue; }
    // A new top-level declaration ends an unterminated one.
    if (c === "\n" && NEW_DECLARATION.test(text.slice(i + 1, i + 40))) break;
    i++;
  }
  budget.left -= Math.min(i, end) - start + 1;
  return text.slice(start, Math.min(i, text.length)).trim();
}

/** Index of `ch` within SCAN_LIMITS.bracketScan characters of `from`, or -1. */
function indexWithin(text: string, ch: string, from: number, budget: Budget): number {
  const end = Math.min(text.length, from + SCAN_LIMITS.bracketScan);
  let i = from;
  while (i < end && text[i] !== ch) i++;
  budget.left -= i - from + 1;
  return i < end ? i : -1;
}

/**
 * A finder for the next index of any of `chars` at or after a position. Calls
 * must come with positions that do not decrease; each character of `text` is
 * then examined at most once across all calls.
 */
function nextOf(text: string, chars: string): (pos: number) => number {
  let from = -1, found = -1;
  return (pos: number) => {
    if (from >= 0 && pos >= from && (found < 0 || found >= pos)) return found;
    let i = pos;
    while (i < text.length && !chars.includes(text[i])) i++;
    from = pos;
    found = i < text.length ? i : -1;
    return found;
  };
}

/** Split at a top-level separator character. */
export function splitTop(text: string, separator: string): string[] {
  const parts: string[] = [];
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "=" && text[i + 1] === ">") { i++; continue; }
    if (OPEN[c]) { i = matchBracket(text, i) - 1; continue; }
    if (c === "'" || c === '"' || c === "`") { const q = c; i++; while (i < text.length && text[i] !== q) { if (text[i] === "\\") i++; i++; } continue; }
    if (c === separator) { parts.push(text.slice(last, i)); last = i + 1; }
  }
  parts.push(text.slice(last));
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

interface TypeDecl { kind: "interface" | "type"; typeParams: boolean; extendsText?: string; body: string }
interface ValueDecl { kind: "const" | "function" | "class" | "enum"; text: string; overloaded?: true }

interface ParsedFile {
  stars: string[];
  reexports: { name: string; imported: string; spec: string }[];
  locals: { name: string; local: string }[];
  exported: Set<string>;
  values: Map<string, ValueDecl>;
  types: Map<string, TypeDecl>;
  imports: Map<string, { spec: string; imported: string }>;
  defaultLocal?: string;
  /** The file's step budget ran out before every declaration was read. */
  truncated: boolean;
}

// Every quantifier below is bounded, and none is nested, so each match attempt
// costs at most a few hundred steps whatever the input.
const WS = "\\s{1,256}";
const IDENT = "[A-Za-z_$][\\w$]{0,255}";
const SPEC_MAX = 1000;
const STAR_EXPORT = /\bexport\s{1,256}\*\s{1,256}from\s{1,256}(['"])([^'"\n]{1,1000})\1/g;
const BRACE_EXPORT = /\bexport\s{1,256}(type\s{1,256})?\{/g;
const BRACE_FROM = /\s{0,256}from\s{1,256}(['"])([^'"\n]{1,1000})\1/y;
const IMPORT_KEYWORD = /\bimport\s/g;
const DECLARATION = new RegExp(`\\b(export${WS})?(?:declare${WS})?(?:abstract${WS})?(const|let|var|function|class|interface|type|enum)${WS}(${IDENT})`, "g");
const DEFAULT_DECLARATION = new RegExp(`\\bexport${WS}default${WS}(?:declare${WS})?(?:abstract${WS})?(?:function|class)\\s{0,256}(${IDENT})?`);
const DEFAULT_IDENT = new RegExp(`\\bexport${WS}default${WS}(${IDENT})`);
const BRACE_LIST_MAX = 4096;

export function parseDeclarations(source: string): ParsedFile {
  const text = stripComments(source);
  const depth = braceDepths(text);
  const top = (index: number) => depth[index] === 0;
  const budget: Budget = { left: SCAN_LIMITS.parseSteps };
  const parsed: ParsedFile = { stars: [], reexports: [], locals: [], exported: new Set(), values: new Map(), types: new Map(), imports: new Map(), truncated: false };

  for (const m of text.matchAll(STAR_EXPORT)) if (top(m.index!)) parsed.stars.push(m[2]);

  // export { a, b as c } [from '…']: the closing brace is found with a forward-only cursor.
  const nextClose = nextOf(text, "}");
  for (const m of text.matchAll(BRACE_EXPORT)) {
    const open = m.index! + m[0].length;
    const close = nextClose(open);
    if (close < 0 || close - open > BRACE_LIST_MAX) continue;
    if (!top(m.index!) || m[1]) continue;
    BRACE_FROM.lastIndex = close + 1;
    const from = BRACE_FROM.exec(text);
    for (const raw of text.slice(open, close).split(",")) {
      const item = raw.trim();
      if (!item || /^type\s/.test(item)) continue;
      const [imported, name = imported] = item.split(/\s{1,256}as\s{1,256}/).map((s) => s.trim());
      if (from) parsed.reexports.push({ name, imported, spec: from[2] });
      else parsed.locals.push({ name, local: imported });
    }
  }

  // import <clause> from '<spec>': the clause runs to the next quote or semicolon
  // and must end with `from`; found with forward-only cursors, not a lazy pattern.
  const nextStop = nextOf(text, `'";`);
  const nextQuoteOrLine = nextOf(text, `'"\n`);
  let lastStop = -1, lastFrom = -1;
  IMPORT_KEYWORD.lastIndex = 0;
  for (let m = IMPORT_KEYWORD.exec(text); m; m = IMPORT_KEYWORD.exec(text)) {
    const clauseStart = m.index + m[0].length;
    const q = nextStop(clauseStart);
    if (q < 0) break;
    if (q - clauseStart > SPEC_MAX || text[q] === ";") continue;
    if (q !== lastStop) {
      lastStop = q;
      let j = q - 1;
      while (j > clauseStart && q - j < 256 && /\s/.test(text[j])) j--;
      const isFrom = text.slice(j - 3, j + 1) === "from" && !/[\w$]/.test(text[j - 4] ?? "");
      lastFrom = isFrom ? j - 3 : -1;
    }
    if (lastFrom < clauseStart) continue;
    const end = nextQuoteOrLine(q + 1);
    if (end < 0 || text[end] !== text[q] || end === q + 1 || end - q - 1 > SPEC_MAX) continue;
    IMPORT_KEYWORD.lastIndex = end + 1;
    if (!top(m.index)) continue;
    const clause = text.slice(clauseStart, lastFrom).trim().replace(/^type\s{1,256}/, ""), spec = text.slice(q + 1, end);
    const brace = clause.match(/\{([^{}]{0,1000})\}/);
    const head = clause.replace(/\{[^{}]{0,1000}\}/, "").replace(/,/g, " ").trim();
    if (head && !head.startsWith("*")) parsed.imports.set(head.split(/\s+/)[0], { spec, imported: "default" });
    if (brace) for (const raw of brace[1].split(",")) {
      const item = raw.trim().replace(/^type\s+/, "");
      if (!item) continue;
      const [imported, local = imported] = item.split(/\s{1,256}as\s{1,256}/).map((s) => s.trim());
      parsed.imports.set(local, { spec, imported });
    }
  }

  for (const m of text.matchAll(DECLARATION)) {
    if (budget.left <= 0) { parsed.truncated = true; break; }
    if (!top(m.index!)) continue;
    const kind = m[2], name = m[3];
    let after = m.index! + m[0].length;
    if (kind === "interface") {
      let typeParams = false;
      if (text[after] === "<") { typeParams = true; after = matchBracket(text, after, budget); }
      const open = indexWithin(text, "{", after, budget);
      if (open < 0) continue;
      const between = text.slice(after, open).trim();
      const extendsText = between.startsWith("extends") ? between.slice(7).trim() : undefined;
      const close = matchBracket(text, open, budget);
      const previous = parsed.types.get(name);
      const body = text.slice(open, close);
      // Declaration merging: a repeated interface adds members and makes the props partial.
      // A merged body is capped like any other; past the cap the extra members are dropped.
      if (!previous) parsed.types.set(name, { kind: "interface", typeParams, extendsText, body });
      else if (previous.body.length + body.length > SCAN_LIMITS.bracketScan) parsed.types.set(name, { ...previous, typeParams: true });
      else parsed.types.set(name, { kind: "interface", typeParams: true, extendsText: previous.extendsText ?? extendsText, body: previous.body.slice(0, -1) + ";" + body.slice(1) });
    } else if (kind === "type") {
      let typeParams = false;
      let i = after;
      while (text[i] === " " && i - after < 256) i++;
      if (text[i] === "<") { typeParams = true; i = matchBracket(text, i, budget); }
      const eq = indexWithin(text, "=", i, budget);
      if (eq < 0 || text.slice(i, eq).trim() !== "") continue;
      if (!parsed.types.has(name)) parsed.types.set(name, { kind: "type", typeParams, body: readUntilSemicolon(text, eq + 1, budget) });
    } else {
      const valueKind: ValueDecl["kind"] = kind === "function" ? "function" : kind === "class" ? "class" : kind === "enum" ? "enum" : "const";
      const previous = parsed.values.get(name);
      if (!previous) parsed.values.set(name, { kind: valueKind, text: readUntilSemicolon(text, after, budget) });
      // A repeated function declaration is an overload: its props are partial.
      else if (previous.kind === "function" && valueKind === "function") previous.overloaded = true;
    }
    if (m[1]) parsed.exported.add(name);
  }

  const defaultDecl = text.match(DEFAULT_DECLARATION);
  const defaultIdent = text.match(DEFAULT_IDENT);
  if (defaultDecl && top(defaultDecl.index!)) parsed.defaultLocal = defaultDecl[1] ?? "default";
  else if (defaultIdent && top(defaultIdent.index!) && !["function", "class", "abstract", "declare", "interface"].includes(defaultIdent[1])) parsed.defaultLocal = defaultIdent[1];
  return parsed;
}

// ---------------------------------------------------------------------------
// Package scan
// ---------------------------------------------------------------------------

export type PropsState = "complete" | "partial" | "unknown";

export interface CodeComponent {
  name: string;
  from: string;
  default?: true;
  props: string[];
  propsState: PropsState;
}

export interface PackageScan {
  package: string;
  packageVersion: string | null;
  installed: boolean;
  noDeclarations: boolean;
  components: CodeComponent[];
  /** Every value export name found, including "default" (for validation; not returned by the tool). */
  exportNames: Set<string>;
  /** Props per export name, for validation. */
  propsByExport: Map<string, { props: string[]; propsState: PropsState }>;
  /** Bare specifiers re-exported from other packages, which are not followed: the first 20, each clipped. */
  unfollowed: string[];
  /** How many distinct bare specifiers were not followed. */
  unfollowedCount: number;
  truncated: boolean;
}

type Origin = { file: string; local: string } | { unresolved: true };
type TypeEval = { names: string[]; state: PropsState };
type Props = { props: string[]; propsState: PropsState };

const UNKNOWN: TypeEval = { names: [], state: "unknown" };
const UNKNOWN_PROPS: Props = { props: [], propsState: "unknown" };

class Scanner {
  files = new Map<string, ParsedFile | null>();
  exportMaps = new Map<string, Map<string, Origin>>();
  /** Type evaluations by depth, file and type text. */
  evalMemo = new Map<string, TypeEval>();
  unfollowed = new Set<string>();
  truncated = false;
  bytes = 0;
  evalBudget = SCAN_LIMITS.evalSteps;

  constructor(private container: string) {}

  /**
   * Parse a declaration file, enforcing containment, the file, size and total
   * bounds. Yields to the event loop before each new file. Null when skipped.
   */
  async parse(file: string): Promise<ParsedFile | null> {
    if (this.files.has(file)) return this.files.get(file)!;
    const real = realpathOrNull(file);
    if (!real || !isInside(real, this.container)) throw new CodeRepoError("A declarations path resolves outside the package");
    if (!DECL_EXT.test(real)) { this.files.set(file, null); return null; }
    if (this.files.size >= SCAN_LIMITS.files) { this.truncated = true; return null; }
    const stat = statSync(real);
    if (!stat.isFile()) throw new CodeRepoError("A declaration file is not a regular file");
    if (stat.size > SCAN_LIMITS.fileBytes || this.bytes + stat.size > SCAN_LIMITS.totalBytes) {
      this.truncated = true; this.files.set(file, null); return null;
    }
    await yieldToEventLoop();
    if (this.files.has(file)) return this.files.get(file)!;
    const text = readRegularFile(real, SCAN_LIMITS.fileBytes, "A declaration file");
    if (text === null) { this.truncated = true; this.files.set(file, null); return null; }
    this.bytes += stat.size;
    const parsed = parseDeclarations(text);
    if (parsed.truncated) this.truncated = true;
    this.files.set(file, parsed);
    return parsed;
  }

  /** Resolve a relative specifier from `file` to a declaration file inside the package, or null. */
  resolveSpecifier(file: string, spec: string): string | null {
    if (!spec.startsWith("./") && !spec.startsWith("../") && spec !== "." && spec !== "..") {
      this.unfollowed.add(spec);
      return null;
    }
    const target = resolve(dirname(file), spec);
    for (const candidate of declCandidates(target)) {
      if (!isInside(candidate, this.container)) throw new CodeRepoError("A declarations path resolves outside the package");
      let isFile = false;
      try { isFile = statSync(candidate).isFile(); } catch { /* missing */ }
      if (isFile) {
        const real = realpathOrNull(candidate);
        if (!real || !isInside(real, this.container)) throw new CodeRepoError("A declarations path resolves outside the package");
        return real;
      }
    }
    return null;
  }

  /** All names a file exports, mapped to where each is declared. */
  async exportsOf(file: string, stack: Set<string> = new Set()): Promise<Map<string, Origin>> {
    const cached = this.exportMaps.get(file);
    if (cached) return cached;
    const map = new Map<string, Origin>();
    if (stack.has(file)) return map;
    stack.add(file);
    const parsed = await this.parse(file);
    if (parsed) {
      const add = (name: string, origin: Origin) => {
        if (map.has(name)) return;
        if (map.size >= SCAN_LIMITS.exports) { this.truncated = true; return; }
        map.set(name, origin);
      };
      for (const name of parsed.exported) add(name, { file, local: name });
      if (parsed.defaultLocal) add("default", await this.localOrigin(file, parsed, parsed.defaultLocal, stack));
      for (const { name, local } of parsed.locals) add(name, await this.localOrigin(file, parsed, local, stack));
      for (const { name, imported, spec } of parsed.reexports) {
        const target = this.resolveSpecifier(file, spec);
        add(name, target ? (await this.exportsOf(target, stack)).get(imported) ?? { unresolved: true } : { unresolved: true });
      }
      for (const spec of parsed.stars) {
        const target = this.resolveSpecifier(file, spec);
        if (!target) continue;
        for (const [name, origin] of await this.exportsOf(target, stack)) if (name !== "default") add(name, origin);
      }
    }
    stack.delete(file);
    this.exportMaps.set(file, map);
    return map;
  }

  async localOrigin(file: string, parsed: ParsedFile, local: string, stack: Set<string>): Promise<Origin> {
    if (parsed.values.has(local) || parsed.types.has(local) || local === "default") return { file, local };
    const imported = parsed.imports.get(local);
    if (imported) {
      const target = this.resolveSpecifier(file, imported.spec);
      if (target) return (await this.exportsOf(target, stack)).get(imported.imported) ?? { unresolved: true };
    }
    return { unresolved: true };
  }

  /** Find a named type visible from `file`: declared there or imported into it. */
  async findType(file: string, name: string, depth = 0): Promise<{ decl: TypeDecl; file: string } | null> {
    if (depth > 8) return null;
    const parsed = await this.parse(file);
    if (!parsed) return null;
    const local = parsed.types.get(name);
    if (local) return { decl: local, file };
    const imported = parsed.imports.get(name);
    let origin: Origin | undefined;
    if (imported) {
      const target = this.resolveSpecifier(file, imported.spec);
      if (target) origin = (await this.exportsOf(target)).get(imported.imported);
    } else {
      origin = (await this.exportsOf(file)).get(name);
    }
    if (origin && "file" in origin && (origin.file !== file || origin.local !== name)) return this.findType(origin.file, origin.local, depth + 1);
    return null;
  }

  /**
   * Prop names read from a type expression, and how sure the reading is.
   * Memoised per (depth, file, type text); every evaluation that is not
   * memoised spends the scan's budget, and once it is spent the answer is
   * unknown and the scan is truncated.
   */
  async evalType(text: string, file: string, depth = 0): Promise<TypeEval> {
    const key = `${depth}\u0000${file}\u0000${text}`;
    const memo = this.evalMemo.get(key);
    if (memo) return memo;
    this.evalBudget -= Math.max(text.length, 64);
    let result = UNKNOWN;
    if (this.evalBudget < 0) this.truncated = true;
    else result = await this.evalTypeOnce(text, file, depth);
    this.evalMemo.set(key, result);
    return result;
  }

  private async evalTypeOnce(text: string, file: string, depth: number): Promise<TypeEval> {
    let t = text.trim();
    if (depth > 8 || !t || t.length > SCAN_LIMITS.bracketScan) return UNKNOWN;
    for (let n = 0; n < 8 && t.startsWith("(") && matchBracket(t, 0) === t.length; n++) t = t.slice(1, -1).trim();
    if (!t) return UNKNOWN;
    if (splitTop(t, "|").length > 1) return UNKNOWN;
    const parts = splitTop(t, "&");
    if (parts.length > 1) {
      const names = new Set<string>();
      for (const part of parts) for (const n of (await this.evalType(part, file, depth + 1)).names) names.add(n);
      return { names: [...names], state: "partial" };
    }
    if (t.startsWith("{")) {
      const { names, open } = memberInfo(t);
      return { names, state: open ? "partial" : "complete" };
    }
    const m = t.match(/^(?:import\((['"])([^'"]{1,1000})\1\)\.)?([A-Za-z_$][\w$.]{0,255})\s{0,256}(<[\s\S]*>)?$/);
    if (!m) return UNKNOWN;
    const [, , importSpec, name, argText] = m;
    const args = argText ? splitTop(argText.slice(1, -1), ",") : [];
    if (name === "Omit" || name === "Pick") {
      const keys = (args[1] ?? "").match(/(['"])([^'"]{1,200})\1/g)?.map((s) => s.slice(1, -1)) ?? [];
      if (name === "Pick") return { names: keys, state: "partial" };
      const inner = await this.evalType(args[0] ?? "", file, depth + 1);
      return { names: inner.names.filter((n) => !keys.includes(n)), state: "partial" };
    }
    let found: { decl: TypeDecl; file: string } | null = null;
    if (importSpec) {
      const target = this.resolveSpecifier(file, importSpec);
      if (target) found = await this.findType(target, name);
    } else if (!name.includes(".")) {
      found = await this.findType(file, name);
    }
    if (!found) return UNKNOWN;
    const { decl } = found;
    let result: TypeEval;
    if (decl.kind === "type") result = await this.evalType(decl.body, found.file, depth + 1);
    else {
      const { names: own, open } = memberInfo(decl.body);
      const names = new Set(own);
      let state: PropsState = open ? "partial" : "complete";
      if (decl.extendsText) {
        state = "partial";
        for (const base of splitTop(decl.extendsText, ",")) for (const n of (await this.evalType(base, found.file, depth + 1)).names) names.add(n);
      }
      result = { names: [...names], state };
    }
    if ((args.length > 0 || decl.typeParams) && result.state === "complete") result = { ...result, state: "partial" };
    return result;
  }

  /**
   * Props of a component declared as `local` in `file` (exported as
   * `exportName`): from its own signature first, then from a same-named
   * `<Name>Props` type only when the signature gives nothing.
   */
  async propsOf(file: string, local: string, exportName: string): Promise<Props> {
    const signature = await this.signatureProps(file, local);
    if (signature.propsState !== "unknown") return signature;
    for (const candidate of new Set([`${local}Props`, `${exportName}Props`])) {
      if (await this.findType(file, candidate)) {
        const r = await this.evalType(candidate, file);
        if (r.state !== "unknown") return { props: r.names, propsState: r.state };
      }
    }
    return signature;
  }

  /** Props from the component's own declaration: FC<…>-style wrappers or the first parameter. */
  private async signatureProps(file: string, local: string): Promise<Props> {
    const value = (await this.parse(file))?.values.get(local);
    if (!value) return UNKNOWN_PROPS;
    const props = await this.signatureType(value, file);
    return value.overloaded && props.propsState === "complete" ? { ...props, propsState: "partial" } : props;
  }

  private async signatureType(value: ValueDecl, file: string): Promise<Props> {
    let text = value.text;
    if (value.kind === "const") {
      if (!text.startsWith(":")) return UNKNOWN_PROPS;
      text = text.slice(1).trim();
      const wrapper = text.match(/^(?:React\.)?(?:FC|FunctionComponent|ForwardRefExoticComponent)\s{0,256}</);
      if (wrapper) {
        const open = wrapper[0].length - 1;
        const close = matchBracket(text, open);
        const r = await this.evalType(text.slice(open + 1, close - 1), file);
        return { props: r.names, propsState: r.state };
      }
    } else if (value.kind !== "function") {
      return UNKNOWN_PROPS;
    }
    // First parameter of a function or function type.
    if (text.startsWith("<")) text = text.slice(matchBracket(text, 0)).trim();
    if (!text.startsWith("(")) return UNKNOWN_PROPS;
    const params = splitTop(text.slice(1, matchBracket(text, 0) - 1), ",");
    if (params.length === 0) return { props: [], propsState: "complete" };
    const colon = splitTop(params[0], ":");
    if (colon.length < 2) return UNKNOWN_PROPS;
    const r = await this.evalType(colon.slice(1).join(":"), file);
    return { props: r.names, propsState: r.state };
  }
}

/**
 * Member names of a type literal or interface body `{ ... }`, and whether it
 * has an index signature or mapped type (`[key: string]`, `[K in Keys]`),
 * whose keys are not listed by name.
 */
export function memberInfo(body: string): { names: string[]; open: boolean } {
  const inner = body.trim().replace(/^\{/, "").replace(/\}$/, "");
  const names = new Set<string>();
  let open = false;
  for (const line of splitTop(inner.replace(/\n/g, ";"), ";").flatMap((s) => splitTop(s, ","))) {
    if (/^(?:[+-]?readonly\s{1,64})?\[/.test(line)) { open = true; continue; }
    const m = line.match(/^(?:readonly\s{1,64})?(?:(['"])([^'"]{1,200})\1|([A-Za-z_$][\w$]{0,255}))\s{0,64}\??\s{0,64}[:(<]/);
    const name = m?.[2] ?? m?.[3];
    if (name) names.add(name);
  }
  return { names: [...names], open };
}

const PASCAL = /^[A-Z][A-Za-z0-9_$]*$/;
const isComponentName = (name: string) => PASCAL.test(name) && /[a-z]/.test(name);

/** A props list within the output bounds; a list that had to be cut is no longer complete. */
function boundProps(props: Props): Props & { cut: boolean } {
  const kept = props.props.filter((n) => n.length <= SCAN_LIMITS.text).slice(0, SCAN_LIMITS.props);
  const cut = kept.length < props.props.length;
  return { props: kept, propsState: cut && props.propsState === "complete" ? "partial" : props.propsState, cut };
}

/**
 * Scan a DesignSystemPackage (or one of its subpaths) for components.
 * `from` is the package name or `name/subpath`; the package must be listed in the Manifest.
 */
export async function scanPackage(root: string, manifestPath: string, from: string): Promise<PackageScan> {
  const { name, subpath } = splitSpecifier(from);
  const deps = manifestDependencies(readManifest(root, manifestPath));
  if (!deps.includes(name)) throw new CodeRepoError(`${clip(name)} is not a dependency in the Manifest`);
  const manifestDir = dirname(manifestPath);
  const empty = (installed: boolean, version: string | null): PackageScan => ({
    package: from, packageVersion: version, installed, noDeclarations: true, components: [],
    exportNames: new Set(), propsByExport: new Map(), unfollowed: [], unfollowedCount: 0, truncated: false,
  });

  const dir = findPackageDir(root, manifestDir, name);
  if (!dir) return empty(false, null);
  const json = readPackageJson(dir);
  const version = typeof json.version === "string" ? clip(json.version) : null;
  const versionCut = typeof json.version === "string" && json.version.length > SCAN_LIMITS.text;
  let pkg: PackageCtx = { dir, json };
  let entry = subpath ? resolveSubpathEntry(pkg, name, subpath) : resolveMainEntry(pkg);
  if (!entry) {
    const typesDir = findPackageDir(root, manifestDir, typesPackageName(name));
    if (typesDir) {
      pkg = { dir: typesDir, json: readPackageJson(typesDir) };
      entry = subpath
        ? fromTypesVersions(pkg, subpath) ?? existingDecl(pkg, subpath)
        : existingDecl(pkg, pkg.json.types) ?? existingDecl(pkg, pkg.json.typings) ?? existingDecl(pkg, "index.d.ts");
    }
  }
  if (!entry) return { ...empty(true, version), truncated: versionCut };

  const scanner = new Scanner(pkg.dir);
  const exportsMap = await scanner.exportsOf(entry);
  const exportNames = new Set<string>();
  const propsByExport = new Map<string, Props>();
  const components: CodeComponent[] = [];
  let cut = versionCut;
  for (const [exportName, origin] of exportsMap) {
    let local = exportName;
    let kind: ValueDecl["kind"] | "unresolved" | "type" = "unresolved";
    if ("file" in origin) {
      local = origin.local;
      const parsed = await scanner.parse(origin.file);
      const value = parsed?.values.get(origin.local);
      kind = value ? value.kind : parsed?.types.has(origin.local) ? "type" : origin.local === "default" ? "function" : "unresolved";
    }
    if (kind === "type") continue;
    exportNames.add(exportName);
    if (kind === "enum") continue;
    const rowName = exportName === "default" ? local : exportName;
    if (!isComponentName(rowName)) continue;
    if (rowName.length > SCAN_LIMITS.text) { cut = true; continue; }
    const found = "file" in origin ? await scanner.propsOf(origin.file, origin.local, rowName) : UNKNOWN_PROPS;
    const { cut: propsCut, ...props } = boundProps(found);
    if (propsCut) cut = true;
    propsByExport.set(exportName, props);
    components.push({ name: rowName, from, ...(exportName === "default" ? { default: true as const } : {}), ...props });
  }
  components.sort((a, b) => a.name.localeCompare(b.name));
  const truncated = cut || scanner.truncated || components.length > SCAN_LIMITS.rows;
  return {
    package: from, packageVersion: version, installed: true, noDeclarations: false,
    components: components.slice(0, SCAN_LIMITS.rows), exportNames, propsByExport,
    unfollowed: [...scanner.unfollowed].slice(0, SCAN_LIMITS.unfollowed).map((spec) => clip(spec)), unfollowedCount: scanner.unfollowed.size, truncated,
  };
}

/** Whether a `custom` entry's `from` (relative to the CodeRepo) names an existing file inside it. */
export function customFileExists(root: string, from: string): boolean {
  if (typeof from !== "string" || from.length === 0 || isAbsolute(from) || from.includes("\\")) {
    throw new CodeRepoError("custom import.from must be a path relative to the CodeRepo");
  }
  const target = resolve(root, from);
  if (!isInside(target, root)) throw new CodeRepoError("custom import.from is outside the CodeRepo");
  const exts = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte"];
  const candidates = [...exts.map((e) => target + e), ...exts.slice(1).map((e) => join(target, `index${e}`))];
  for (const candidate of candidates) {
    let isFile = false;
    try { isFile = statSync(candidate).isFile(); } catch { /* missing */ }
    if (!isFile) continue;
    const real = realpathOrNull(candidate);
    if (!real || !isInside(real, root)) throw new CodeRepoError("custom import.from resolves outside the CodeRepo");
    return true;
  }
  return false;
}
