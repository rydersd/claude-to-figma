// Spec and SpecLock files on disk (L2F_SPEC_SYNC): where they may live, how an
// existing pair is read, and how they are written.
//
// - A Spec path ends `.l2f.json`; its SpecLock is `<name>.l2f.lock.json` beside it.
// - Relative paths resolve against L2F_SPEC_DIR (absolute), or the server's
//   working directory when it is unset. An absolute path is accepted only inside
//   that base. Containment is checked after resolving symlinks on the parent
//   directory, since the file may not exist yet.
// - A Spec or SpecLock that is a symlink is refused, never followed. An existing
//   file is overwritten only when it parses as a Spec (or SpecLock).
// - Writes go to a new temp file in the same directory and are renamed over the
//   target, so a reader never sees half a file.

import { randomBytes } from "node:crypto";
import { lstat, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { isSpecFile, isSpecLockFile, type SpecFile, type SpecLockFile } from "../shared/spec.js";

export const SPEC_SUFFIX = ".l2f.json";
export const LOCK_SUFFIX = ".l2f.lock.json";

export interface SpecPaths {
  specPath: string;
  lockPath: string;
  baseDir: string;
}

// The directory Spec paths resolve against. L2F_SPEC_DIR is read from the server
// environment only; an empty value (an unset `${L2F_SPEC_DIR:-}`) means unset.
export function specBaseDir(env: Record<string, string | undefined>, cwd: () => string = () => process.cwd()): string {
  const configured = env.L2F_SPEC_DIR;
  if (configured) {
    if (!isAbsolute(configured)) throw new Error(`L2F_SPEC_DIR must be an absolute path (got "${configured}").`);
    return configured;
  }
  return cwd();
}

function isInside(base: string, target: string): boolean {
  const rel = relative(base, target);
  return rel !== "" && rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel);
}

export async function resolveSpecPaths(input: string, baseDir: string): Promise<SpecPaths> {
  if (typeof input !== "string" || input.includes("\0") || !input.endsWith(SPEC_SUFFIX) || input.endsWith(LOCK_SUFFIX) || basename(input) === SPEC_SUFFIX) {
    throw new Error(`A Spec path must name a file ending in "${SPEC_SUFFIX}" (and not "${LOCK_SUFFIX}"), got "${input}".`);
  }
  let base: string;
  try {
    base = await realpath(baseDir);
  } catch {
    throw new Error(`The Spec directory does not exist: ${baseDir}`);
  }
  const candidate = isAbsolute(input) ? resolve(input) : resolve(baseDir, input);
  let parent: string;
  try {
    parent = await realpath(dirname(candidate));
  } catch {
    throw new Error(`The directory for ${input} does not exist. Create it inside ${base} first.`);
  }
  const name = basename(candidate);
  const specPath = join(parent, name);
  if (!isInside(base, specPath)) {
    throw new Error(`Refusing ${input}: it resolves to ${specPath}, outside the Spec directory ${base} (set L2F_SPEC_DIR to change it).`);
  }
  return { specPath, lockPath: join(parent, name.slice(0, -SPEC_SUFFIX.length) + LOCK_SUFFIX), baseDir: base };
}

// lstat without following, or null when the path does not exist.
async function entry(path: string) {
  try {
    return await lstat(path);
  } catch (error: any) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function readExisting<T>(path: string, kind: string, guard: (value: any) => value is T): Promise<T | null> {
  const stat = await entry(path);
  if (!stat) return null;
  if (stat.isSymbolicLink()) throw new Error(`Refusing ${path}: it is a symbolic link. A ${kind} is never read or written through a link.`);
  if (!stat.isFile()) throw new Error(`Refusing ${path}: it is not a regular file.`);
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new Error(`Refusing to overwrite ${path}: it exists and is not a ${kind} (not valid JSON).`);
  }
  if (!guard(value)) throw new Error(`Refusing to overwrite ${path}: it exists and is not a ${kind}.`);
  return value;
}

export async function readExistingPair(paths: SpecPaths): Promise<{ spec: SpecFile | null; lock: SpecLockFile | null }> {
  return {
    spec: await readExisting(paths.specPath, "Spec", isSpecFile),
    lock: await readExisting(paths.lockPath, "SpecLock", isSpecLockFile),
  };
}

// Write `text` to `path` through a new temp file in the same directory and a
// rename. The temp file is created exclusively (never an existing entry), and a
// target that is a symlink or not a regular file is refused.
export async function writeFileAtomic(path: string, text: string): Promise<void> {
  const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  const handle = await open(tmp, "wx", 0o644);
  try {
    await handle.writeFile(text, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    const stat = await entry(path);
    if (stat && (stat.isSymbolicLink() || !stat.isFile())) throw new Error(`Refusing to write ${path}: it is a symbolic link or not a regular file.`);
    await rename(tmp, path);
  } catch (error) {
    await unlink(tmp).catch(() => {});
    throw error;
  }
}

// Rename an existing file to `<file>.<stamp>.bak`, never over another file.
export async function backUp(path: string, stamp: string): Promise<string | null> {
  if (!(await entry(path))) return null;
  const target = `${path}.${stamp}.bak`;
  if (await entry(target)) throw new Error(`Refusing to back up ${path}: ${target} already exists.`);
  await rename(path, target);
  return target;
}
