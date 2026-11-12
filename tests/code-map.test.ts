/**
 * Code map, PR 11e (L2F_CODE_MAP): the CodeRepo reader and the CodeMap file.
 * Every fixture is a synthetic CodeRepo built in a temp directory from
 * invented packages. No Figma, relay or network needed:
 *   bun test tests/code-map.test.ts
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { scanCodeComponents, setCodeMapEntries, registerTools } from "../src/llm2figma_mcp/tools/code-map";
import { registerWhenEnabled } from "../src/shared/flags";

const temps: string[] = [];
afterAll(() => { for (const dir of temps) rmSync(dir, { recursive: true, force: true }); });

type Tree = Record<string, string | object>;

/** Build a CodeRepo from a file tree; objects are written as JSON. Returns its real path. */
function repo(tree: Tree): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "l2f-coderepo-")));
  temps.push(root);
  write(root, tree);
  return root;
}
function write(root: string, tree: Tree) {
  for (const [path, content] of Object.entries(tree)) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content));
  }
}
function outside(tree: Tree): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "l2f-outside-")));
  temps.push(dir);
  write(dir, tree);
  return dir;
}

/** A repo with one invented package `pkg` whose package.json and declaration files are given. */
function pkgRepo(pkgJson: object, files: Tree, name = "acme-ui"): string {
  const tree: Tree = { "package.json": { name: "app", dependencies: { [name]: "^1.0.0" } }, [`node_modules/${name}/package.json`]: { name, version: "1.2.3", ...pkgJson } };
  for (const [path, content] of Object.entries(files)) tree[`node_modules/${name}/${path}`] = content;
  return repo(tree);
}

const scan = (codeRepo: string, pkg = "acme-ui", manifest?: string) => scanCodeComponents({ codeRepo, package: pkg, manifest }) as Promise<any>;
const names = (result: any) => result.components.map((c: any) => c.name);
const component = (result: any, name: string) => result.components.find((c: any) => c.name === name);
const BUTTON = "export interface ButtonProps { label: string; size?: string }\nexport declare const Button: (props: ButtonProps) => any;\n";

describe("dependency listing (1)", () => {
  test("lists dependencies, devDependencies and peerDependencies once each, and nothing else", async () => {
    const root = repo({ "package.json": { dependencies: { "acme-ui": "1", "zed": "1" }, devDependencies: { "acme-icons": "1" }, peerDependencies: { "zed": "1" } } });
    expect(await scanCodeComponents({ codeRepo: root })).toEqual({ dependencies: ["acme-icons", "acme-ui", "zed"], truncated: false });
  });
  test("a workspace manifest lists its own dependencies and finds one hoisted to the root", async () => {
    const root = repo({
      "package.json": { name: "monorepo", private: true },
      "apps/web/package.json": { name: "web", dependencies: { "@acme/ui": "^2.0.0" } },
      "node_modules/@acme/ui/package.json": { name: "@acme/ui", version: "2.0.1", types: "index.d.ts" },
      "node_modules/@acme/ui/index.d.ts": BUTTON,
    });
    expect((await scanCodeComponents({ codeRepo: root, manifest: "apps/web/package.json" }) as any).dependencies).toEqual(["@acme/ui"]);
    const result = await scan(root, "@acme/ui", "apps/web/package.json");
    expect(result.packageVersion).toBe("2.0.1");
    expect(names(result)).toEqual(["Button"]);
  });
  test("more than 100 dependencies are capped with truncated", async () => {
    const deps = Object.fromEntries(Array.from({ length: 105 }, (_, i) => [`dep-${i}`, "1"]));
    const result: any = await scanCodeComponents({ codeRepo: repo({ "package.json": { dependencies: deps } }) });
    expect(result.dependencies).toHaveLength(100);
    expect(result.truncated).toBe(true);
  });
});

describe("entry resolution (2)", () => {
  const cases: [string, object, Tree][] = [
    ["exports types", { exports: { ".": { types: "./dist/a.d.ts", default: "./dist/b.js" } } }, { "dist/a.d.ts": BUTTON }],
    ["exports import.types", { exports: { ".": { import: { types: "./dist/index.d.mts" } } } }, { "dist/index.d.mts": BUTTON }],
    ["exports require.types", { exports: { ".": { require: { types: "./dist/index.d.cts" } } } }, { "dist/index.d.cts": BUTTON }],
    ["exports default mapped to .d.mts", { exports: { ".": { default: "./dist/index.mjs" } } }, { "dist/index.d.mts": BUTTON }],
    ["exports conditions without a \".\" key", { exports: { types: "./lib/main.d.ts" } }, { "lib/main.d.ts": BUTTON }],
    ["types", { types: "./typed/index.d.ts" }, { "typed/index.d.ts": BUTTON }],
    ["typings", { typings: "typed.d.ts" }, { "typed.d.ts": BUTTON }],
    ["typesVersions for *", { typesVersions: { "*": { "*": ["ts/*"] } } }, { "ts/index.d.ts": BUTTON }],
    ["main mapped to a declaration file", { main: "./cjs/entry.js" }, { "cjs/entry.d.ts": BUTTON }],
    ["index.d.ts at the package root", {}, { "index.d.ts": BUTTON }],
  ];
  for (const [label, json, files] of cases) {
    test(label, async () => {
      const result = await scan(pkgRepo(json, files));
      expect(result.noDeclarations).toBe(false);
      expect(names(result)).toEqual(["Button"]);
    });
  }
  test("an earlier step wins over a later one", async () => {
    const result = await scan(pkgRepo({ exports: { ".": { types: "./a.d.ts" } }, types: "./b.d.ts" }, {
      "a.d.ts": "export declare const Alpha: (props: { a: string }) => any;", "b.d.ts": "export declare const Beta: (props: { b: string }) => any;",
    }));
    expect(names(result)).toEqual(["Alpha"]);
  });
  test("a missing step falls through to the next", async () => {
    const result = await scan(pkgRepo({ exports: { ".": { types: "./gone.d.ts" } }, types: "./here.d.ts" }, { "here.d.ts": BUTTON }));
    expect(names(result)).toEqual(["Button"]);
  });
  test("@types/<package> when the package has no declarations", async () => {
    const root = repo({
      "package.json": { dependencies: { "@acme/plain": "1" } },
      "node_modules/@acme/plain/package.json": { name: "@acme/plain", version: "3.0.0", main: "index.js" },
      "node_modules/@acme/plain/index.js": "module.exports = {};",
      "node_modules/@types/acme__plain/package.json": { name: "@types/acme__plain", types: "index.d.ts" },
      "node_modules/@types/acme__plain/index.d.ts": BUTTON,
    });
    const result = await scan(root, "@acme/plain");
    expect(result.packageVersion).toBe("3.0.0");
    expect(names(result)).toEqual(["Button"]);
  });
  test("a subpath export is scanned when named", async () => {
    const root = pkgRepo({ exports: { ".": { types: "./index.d.ts" }, "./Button": { types: "./button/index.d.ts" }, "./icons/*": { types: "./icons/*.d.ts" } } }, {
      "index.d.ts": "export declare const Root: (props: { a: string }) => any;",
      "button/index.d.ts": BUTTON,
      "icons/Star.d.ts": "export declare const StarIcon: (props: { size: number }) => any;",
    });
    const result = await scan(root, "acme-ui/Button");
    expect(result.package).toBe("acme-ui/Button");
    expect(component(result, "Button").from).toBe("acme-ui/Button");
    expect(names(await scan(root, "acme-ui/icons/Star"))).toEqual(["StarIcon"]);
    await expect(scan(root, "acme-ui/Nope")).rejects.toThrow("does not export ./Nope");
  });
});

describe("followed export forms (2)", () => {
  const files: Tree = {
    "index.d.ts": [
      "export * from './star.js';",
      "export { Alpha, Beta as Gamma } from './named';",
      "export { default as Delta } from './delta.mjs';",
      "export * from './folder';",
      "import { Epsilon } from './epsilon';",
      "declare const Zeta: (props: { z: string }) => any;",
      "export { Epsilon, Zeta };",
      "export declare const Eta: (props: { e: string }) => any;",
      "export declare function Theta(props: { t: string }): any;",
      "export declare class Iota { }",
    ].join("\n"),
    "star.d.ts": "export declare const Star: (props: { s: string }) => any;",
    "named.d.ts": "export declare const Alpha: (props: { a: string }) => any;\nexport declare const Beta: (props: { b: string }) => any;",
    "delta.d.mts": "declare const Delta: (props: { d: string }) => any;\nexport default Delta;",
    "folder/index.d.ts": "export declare const Folder: (props: { f: string }) => any;",
    "epsilon.d.ts": "export declare const Epsilon: (props: { x: string }) => any;",
  };
  test("every form is followed", async () => {
    const result = await scan(pkgRepo({ types: "index.d.ts" }, files));
    expect(names(result)).toEqual(["Alpha", "Delta", "Epsilon", "Eta", "Folder", "Gamma", "Iota", "Star", "Theta", "Zeta"]);
    expect(component(result, "Gamma").props).toEqual(["b"]);
    expect(component(result, "Delta").props).toEqual(["d"]);
  });
  test("export default of a declared component is listed as a default export", async () => {
    const result = await scan(pkgRepo({ exports: { "./Card": { types: "./card.d.ts" } } }, {
      "card.d.ts": "export interface CardProps { title: string }\ndeclare function Card(props: CardProps): any;\nexport default Card;",
    }), "acme-ui/Card");
    expect(result.components).toEqual([{ name: "Card", from: "acme-ui/Card", default: true, props: ["title"], propsState: "complete" }]);
  });
  test("type-only exports, enums and bare specifiers are not components", async () => {
    const result = await scan(pkgRepo({ types: "index.d.ts" }, {
      "index.d.ts": "export interface Theme { a: string }\nexport type Size = 'sm' | 'md';\nexport declare enum Tone { Info }\nexport * from 'other-pkg';\nexport type { Hidden } from './x';\n" + BUTTON,
    }));
    expect(names(result)).toEqual(["Button"]);
    expect(result.unfollowed).toEqual(["other-pkg"]);
  });
});

describe("props (3)", () => {
  const props = async (decl: string, name: string) => component(await scan(pkgRepo({ types: "index.d.ts" }, { "index.d.ts": decl })), name);
  test("from a <Name>Props interface", async () => {
    expect(await props("export interface PanelProps { title: string; open?: boolean; onClose(): void }\nexport declare const Panel: any;", "Panel"))
      .toMatchObject({ props: ["title", "open", "onClose"], propsState: "complete" });
  });
  test("from a <Name>Props type literal, imported from another file", async () => {
    const result = await scan(pkgRepo({ types: "index.d.ts" }, {
      "index.d.ts": "export * from './chip';",
      "chip.d.ts": "import type { ChipProps } from './types';\nexport declare function Chip(p: ChipProps): any;",
      "types.d.ts": "export type ChipProps = {\n  label: string;\n  'aria-label'?: string;\n  tone?:\n    | 'a'\n    | 'b';\n};",
    }));
    expect(component(result, "Chip")).toMatchObject({ props: ["label", "aria-label", "tone"], propsState: "complete" });
  });
  test("from the type argument of FC<…>", async () => {
    expect(await props("import * as React from 'react';\nexport declare const Badge: React.FC<{ tone: string; count?: number }>;", "Badge"))
      .toMatchObject({ props: ["tone", "count"], propsState: "complete" });
  });
  test("from the type argument of ForwardRefExoticComponent<…>", async () => {
    expect(await props("interface TileOptions { heading: string }\nexport declare const Tile: ForwardRefExoticComponent<TileOptions>;", "Tile"))
      .toMatchObject({ props: ["heading"], propsState: "complete" });
  });
  test("partial for extends, with the names it could read", async () => {
    expect(await props("interface Base { id: string }\nexport interface FieldProps extends Base, HTMLAttributes<HTMLInputElement> { value: string }\nexport declare const Field: any;", "Field"))
      .toMatchObject({ props: ["value", "id"], propsState: "partial" });
  });
  test("partial for an intersection", async () => {
    expect(await props("interface Own { kind: string }\nexport declare const Link: ForwardRefExoticComponent<Omit<Own, 'ref'> & RefAttributes<HTMLAnchorElement>>;", "Link"))
      .toMatchObject({ props: ["kind"], propsState: "partial" });
  });
  test("partial for a generic props type", async () => {
    expect(await props("export interface ListProps<T> { items: T[] }\nexport declare function List<T>(props: ListProps<T>): any;", "List"))
      .toMatchObject({ props: ["items"], propsState: "partial" });
  });
  test("unknown when no props type is found, and nothing is guessed", async () => {
    expect(await props("export declare const Mystery: SomeExternalComponentType;", "Mystery")).toMatchObject({ props: [], propsState: "unknown" });
    expect(await props("export declare function Odd(props: Imported): any;", "Odd")).toMatchObject({ props: [], propsState: "unknown" });
  });
  test("hooks and utilities are skipped", async () => {
    const result = await scan(pkgRepo({ types: "index.d.ts" }, { "index.d.ts": "export declare function useToast(): any;\nexport declare const cx: (...a: string[]) => string;\nexport declare const VERSION: string;\n" + BUTTON }));
    expect(names(result)).toEqual(["Button"]);
  });
});

describe("noDeclarations (4)", () => {
  test("a package with no declaration files at all", async () => {
    const result = await scan(pkgRepo({ main: "index.js" }, { "index.js": "module.exports = {};" }));
    expect(result).toMatchObject({ packageVersion: "1.2.3", noDeclarations: true, components: [] });
  });
  test("distinct from a package that declares zero components", async () => {
    const result = await scan(pkgRepo({ types: "index.d.ts" }, { "index.d.ts": "export declare function useThing(): void;" }));
    expect(result).toMatchObject({ noDeclarations: false, components: [] });
  });
});

describe("bounds (5)", () => {
  test("more than 400 files", async () => {
    const files: Tree = { "index.d.ts": Array.from({ length: 405 }, (_, i) => `export * from './f${i}';`).join("\n") };
    for (let i = 0; i < 405; i++) files[`f${i}.d.ts`] = `export declare const C${i}x: (props: { a: string }) => any;`;
    expect((await scan(pkgRepo({ types: "index.d.ts" }, files))).truncated).toBe(true);
  });
  test("a file over 2 MB", async () => {
    const result = await scan(pkgRepo({ types: "index.d.ts" }, { "index.d.ts": "export * from './big';\n" + BUTTON, "big.d.ts": "export declare const Big: any;\n" + " ".repeat(2 * 1024 * 1024 + 10) }));
    expect(result.truncated).toBe(true);
    expect(names(result)).toEqual(["Button"]);
  });
  test("more than 2,000 exports", async () => {
    const decl = Array.from({ length: 2005 }, (_, i) => `export declare const useHook${i}: () => void;`).join("\n");
    expect((await scan(pkgRepo({ types: "index.d.ts" }, { "index.d.ts": decl }))).truncated).toBe(true);
  });
  test("more than 100 components are capped at 100 rows", async () => {
    const decl = Array.from({ length: 120 }, (_, i) => `export declare const Comp${String(i).padStart(3, "0")}: (props: { a: string }) => any;`).join("\n");
    const result = await scan(pkgRepo({ types: "index.d.ts" }, { "index.d.ts": decl }));
    expect(result.components).toHaveLength(100);
    expect(result.truncated).toBe(true);
  });
  test("a package within every bound is not truncated", async () => {
    expect((await scan(pkgRepo({ types: "index.d.ts" }, { "index.d.ts": BUTTON }))).truncated).toBe(false);
  });
});

describe("refusals (6)", () => {
  test("a relative codeRepo", async () => {
    await expect(scanCodeComponents({ codeRepo: "relative/path" })).rejects.toThrow("absolute path");
  });
  test("a manifest outside the CodeRepo", async () => {
    const root = repo({ "package.json": {} });
    outside({ "package.json": {} });
    await expect(scanCodeComponents({ codeRepo: root, manifest: "../package.json" })).rejects.toThrow("outside the CodeRepo");
    await expect(scanCodeComponents({ codeRepo: root, manifest: "/etc/package.json" })).rejects.toThrow("relative to the CodeRepo");
    const away = outside({ "package.json": { dependencies: { x: "1" } } });
    symlinkSync(away, join(root, "linked"));
    await expect(scanCodeComponents({ codeRepo: root, manifest: "linked/package.json" })).rejects.toThrow("outside the CodeRepo");
  });
  test("a missing Manifest", async () => {
    await expect(scanCodeComponents({ codeRepo: repo({ "README.md": "x" }) })).rejects.toThrow("Manifest not found");
  });
  test("a package name or subpath with ..", async () => {
    const root = pkgRepo({ types: "index.d.ts" }, { "index.d.ts": BUTTON });
    await expect(scan(root, "../acme-ui")).rejects.toThrow("Invalid package name");
    await expect(scan(root, "acme-ui/../../secret")).rejects.toThrow("Invalid package subpath");
    await expect(scan(root, "acme-ui/a\\b")).rejects.toThrow("Invalid package subpath");
  });
  test("a package that is not in the Manifest", async () => {
    await expect(scan(pkgRepo({}, { "index.d.ts": BUTTON }), "other-ui")).rejects.toThrow("not a dependency");
  });
  test("a package symlinked outside the CodeRepo", async () => {
    const root = repo({ "package.json": { dependencies: { "acme-ui": "1" } } });
    const away = outside({ "package.json": { name: "acme-ui" }, "index.d.ts": BUTTON });
    mkdirSync(join(root, "node_modules"));
    symlinkSync(away, join(root, "node_modules/acme-ui"));
    await expect(scan(root)).rejects.toThrow("resolves outside the CodeRepo");
  });
  test("a declarations path resolving outside the package", async () => {
    await expect(scan(pkgRepo({ types: "../../evil.d.ts" }, {}))).rejects.toThrow("outside the package");
    await expect(scan(pkgRepo({ types: "index.d.ts" }, { "index.d.ts": "export * from '../sibling/index';" }))).rejects.toThrow("outside the package");
    const root = pkgRepo({ types: "index.d.ts" }, {});
    const away = outside({ "evil.d.ts": BUTTON });
    symlinkSync(join(away, "evil.d.ts"), join(root, "node_modules/acme-ui/index.d.ts"));
    await expect(scan(root)).rejects.toThrow("outside the package");
  });
  test("a pnpm-style symlink into a store inside the CodeRepo is accepted", async () => {
    const root = repo({
      "package.json": { dependencies: { "@acme/ui": "1" } },
      "node_modules/.pnpm/@acme+ui@1.0.0/node_modules/@acme/ui/package.json": { name: "@acme/ui", version: "1.0.0", types: "index.d.ts" },
      "node_modules/.pnpm/@acme+ui@1.0.0/node_modules/@acme/ui/index.d.ts": BUTTON,
    });
    mkdirSync(join(root, "node_modules/@acme"));
    symlinkSync("../.pnpm/@acme+ui@1.0.0/node_modules/@acme/ui", join(root, "node_modules/@acme/ui"));
    expect(names(await scan(root, "@acme/ui"))).toEqual(["Button"]);
  });
  test("nothing from the CodeRepo is executed", async () => {
    const root = pkgRepo({ types: "index.d.ts", main: "index.js", scripts: { postinstall: "touch ran-script" } }, {
      "index.d.ts": BUTTON,
      "index.js": "require('fs').writeFileSync(require('path').join(__dirname, 'ran-module'), 'x');",
    });
    await scan(root);
    await setCodeMapEntries({ codeRepo: root, entries: { k1: { figmaName: "Button", status: "package", import: { from: "acme-ui", name: "Button" } } } });
    expect(existsSync(join(root, "node_modules/acme-ui/ran-module"))).toBe(false);
    expect(existsSync(join(root, "ran-script"))).toBe(false);
  });
});

const entry = (overrides: object = {}) => ({ figmaName: "Button", status: "package", import: { from: "acme-ui", name: "Button" }, ...overrides });
const mapOf = (root: string) => JSON.parse(readFileSync(join(root, ".l2f/code-map.json"), "utf8"));

describe("write safety (7)", () => {
  test("creates .l2f and the file, and writes nothing else", async () => {
    const root = pkgRepo({ types: "index.d.ts" }, { "index.d.ts": BUTTON });
    const result = await setCodeMapEntries({ codeRepo: root, entries: { k1: entry() } });
    expect(result.path).toBe(join(root, ".l2f/code-map.json"));
    expect(mapOf(root)).toEqual({ l2fCodeMap: 1, packages: { "acme-ui": "1.2.3" }, components: { k1: { ...entry(), verified: true } }, tokens: {} });
    const { readdirSync } = await import("node:fs");
    expect(readdirSync(join(root, ".l2f"))).toEqual(["code-map.json"]);
  });
  test(".l2f symlinked outside is refused", async () => {
    const root = pkgRepo({ types: "index.d.ts" }, { "index.d.ts": BUTTON });
    const away = outside({});
    symlinkSync(away, join(root, ".l2f"));
    await expect(setCodeMapEntries({ codeRepo: root, entries: { k1: entry() } })).rejects.toThrow(".l2f is a symlink");
    expect(existsSync(join(away, "code-map.json"))).toBe(false);
  });
  test("a symlinked CodeMap is refused", async () => {
    const root = pkgRepo({ types: "index.d.ts" }, { "index.d.ts": BUTTON });
    const away = outside({ "target.json": { l2fCodeMap: 1, packages: {}, components: {}, tokens: {} } });
    mkdirSync(join(root, ".l2f"));
    symlinkSync(join(away, "target.json"), join(root, ".l2f/code-map.json"));
    await expect(setCodeMapEntries({ codeRepo: root, entries: { k1: entry() } })).rejects.toThrow("code map is a symlink");
    expect(JSON.parse(readFileSync(join(away, "target.json"), "utf8")).components).toEqual({});
  });
  test("a file that is not a CodeMap is not overwritten", async () => {
    const root = pkgRepo({ types: "index.d.ts" }, { "index.d.ts": BUTTON, "../../.l2f/code-map.json": '{"something":"else"}' });
    await expect(setCodeMapEntries({ codeRepo: root, entries: { k1: entry() } })).rejects.toThrow("not a code map");
    expect(readFileSync(join(root, ".l2f/code-map.json"), "utf8")).toBe('{"something":"else"}');
  });
  test("two concurrent calls both land", async () => {
    const root = pkgRepo({ types: "index.d.ts" }, { "index.d.ts": BUTTON });
    await Promise.all([
      setCodeMapEntries({ codeRepo: root, entries: { k1: entry() } }),
      setCodeMapEntries({ codeRepo: root, entries: { k2: entry({ figmaName: "Button 2" }) } }),
      setCodeMapEntries({ codeRepo: root, entries: {}, tokens: { "Color/Primary": "--color-primary" } }),
    ]);
    const map = mapOf(root);
    expect(Object.keys(map.components)).toEqual(["k1", "k2"]);
    expect(map.tokens).toEqual({ "Color/Primary": "--color-primary" });
  });
  test("a change between read and rename is merged on retry", async () => {
    const root = pkgRepo({ types: "index.d.ts" }, { "index.d.ts": BUTTON });
    await setCodeMapEntries({ codeRepo: root, entries: { k1: entry() } });
    let calls = 0;
    await setCodeMapEntries({ codeRepo: root, entries: { k2: entry() } }, {
      beforeRename: async (file) => {
        if (calls++ > 0) return;
        const map = JSON.parse(readFileSync(file, "utf8"));
        map.components.k3 = { figmaName: "Other", status: "missing", verified: false };
        writeFileSync(file, JSON.stringify(map));
      },
    });
    expect(Object.keys(mapOf(root).components)).toEqual(["k1", "k2", "k3"]);
  });
  test("a file that keeps changing fails, leaves no temp file and keeps the other writer's content", async () => {
    const root = pkgRepo({ types: "index.d.ts" }, { "index.d.ts": BUTTON });
    await setCodeMapEntries({ codeRepo: root, entries: { k1: entry() } });
    let n = 0;
    const promise = setCodeMapEntries({ codeRepo: root, entries: { k2: entry() } }, {
      beforeRename: async (file) => {
        const map = JSON.parse(readFileSync(file, "utf8"));
        map.tokens[`Other/T${n++}`] = "x";
        writeFileSync(file, JSON.stringify(map));
      },
    });
    await expect(promise).rejects.toThrow("the code map changed while writing");
    const { readdirSync } = await import("node:fs");
    expect(readdirSync(join(root, ".l2f"))).toEqual(["code-map.json"]);
    expect(mapOf(root).components.k2).toBeUndefined();
  });
});

describe("merge (8)", () => {
  test("keeps untouched entries, null removes, versions are recorded", async () => {
    const root = repo({
      "package.json": { dependencies: { "acme-ui": "^1", "acme-icons": "^4" } },
      "node_modules/acme-ui/package.json": { name: "acme-ui", version: "1.2.3", types: "index.d.ts" },
      "node_modules/acme-ui/index.d.ts": BUTTON,
      "node_modules/acme-icons/package.json": { name: "acme-icons", version: "4.5.6", types: "index.d.ts" },
      "node_modules/acme-icons/index.d.ts": "export declare const StarIcon: (props: { size?: number }) => any;",
    });
    await setCodeMapEntries({ codeRepo: root, entries: { a: entry(), b: entry(), c: entry() }, tokens: { "Color/A": "a", "Color/B": "b" } });
    const result = await setCodeMapEntries({
      codeRepo: root,
      entries: { b: null, d: entry({ figmaName: "Star", import: { from: "acme-icons", name: "StarIcon" } }), nope: null },
      tokens: { "Color/A": null },
    });
    expect(result).toMatchObject({ written: ["d"], removed: ["b"], rejected: [], unverified: [] });
    const map = mapOf(root);
    expect(Object.keys(map.components)).toEqual(["a", "c", "d"]);
    expect(map.packages).toEqual({ "acme-icons": "4.5.6", "acme-ui": "1.2.3" });
    expect(map.tokens).toEqual({ "Color/B": "b" });
  });
});

describe("validation (9)", () => {
  const root = repo({
    "package.json": { dependencies: { "acme-ui": "^1", "acme-plain": "^1", "acme-absent": "^1" } },
    "node_modules/acme-ui/package.json": { name: "acme-ui", version: "1.2.3", types: "index.d.ts" },
    "node_modules/acme-ui/index.d.ts": BUTTON + "export interface CardProps extends Base { title: string }\nexport declare const Card: any;\ninterface Base { id: string }",
    "node_modules/acme-plain/package.json": { name: "acme-plain", version: "0.1.0", main: "index.js" },
    "node_modules/acme-plain/index.js": "",
    "src/components/Hero.tsx": "export const Hero = () => null;",
  });
  const rejected = async (value: object, key = "k") =>
    (await setCodeMapEntries({ codeRepo: root, entries: { [key]: value } })).rejected[0]?.reason;

  test("each rule has a rejected case", async () => {
    expect(await rejected(entry(), "bad key!")).toContain("figmaKey");
    expect(await rejected(entry({ figmaName: "" }))).toContain("figmaName");
    expect(await rejected(entry({ status: "built" }))).toContain("status");
    expect(await rejected(entry({ colour: "red" }))).toContain("unknown field");
    expect(await rejected({ figmaName: "Button", status: "package" })).toContain("needs an import");
    expect(await rejected({ figmaName: "Button", status: "custom" })).toContain("needs an import");
    expect(await rejected(entry({ status: "missing" }))).toContain("no import");
    expect(await rejected(entry({ import: { from: "acme-ui" } }))).toContain("import must be");
    expect(await rejected(entry({ import: { from: "acme-ui", name: "not valid" } }))).toContain("import.name");
    expect(await rejected(entry({ import: { from: "acme-ui", name: "Button", default: false } }))).toContain("import.default");
    expect(await rejected(entry({ import: { tag: "<bad>" } }))).toContain("tag");
    expect(await rejected(entry({ import: { from: "other-ui", name: "Button" } }))).toContain("not a dependency in the Manifest");
    expect(await rejected(entry({ import: { from: "acme-ui/../x", name: "Button" } }))).toContain("Invalid package subpath");
    expect(await rejected(entry({ import: { from: "acme-ui", name: "Gone" } }))).toContain("Gone is not exported by acme-ui");
    expect(await rejected(entry({ import: { from: "acme-ui", name: "Button", default: true } }))).toContain("no default export");
    expect(await rejected(entry({ status: "custom", import: { from: "/abs/Hero.tsx", name: "Hero" } }))).toContain("relative");
    expect(await rejected(entry({ status: "custom", import: { from: "../outside/Hero", name: "Hero" } }))).toContain("outside the CodeRepo");
    expect(await rejected(entry({ status: "custom", import: { from: "src/components/Nope", name: "Nope" } }))).toContain("not found");
    expect(await rejected(entry({ props: { Size: { prop: "size", extra: 1 } } }))).toContain("not a valid PropRule");
    expect(await rejected(entry({ props: { Size: { values: { Small: "sm" } } } }))).toContain("not a valid PropRule");
    expect(await rejected(entry({ props: { Label: { children: "yes" } } }))).toContain("not a valid PropRule");
    expect(await rejected(entry({ props: { Label: { ignore: false } } }))).toContain("not a valid PropRule");
    expect(await rejected(entry({ props: "size" }))).toContain("props must be");
    expect(await rejected(entry({ variants: [{ when: {}, import: { from: "acme-ui", name: "Button" } }] }))).toContain("when");
    expect(await rejected(entry({ variants: [{ when: { Type: "Icon" } }] }))).toContain("needs an import");
    expect(await rejected(entry({ variants: [{ when: { Type: "Icon" }, import: { from: "acme-ui", name: "Gone" } }] }))).toContain("Gone is not exported");
    const tokens = await setCodeMapEntries({ codeRepo: root, entries: {}, tokens: { NoSlash: "x", "Color/Empty": "" } });
    expect(tokens.rejected.map((r) => r.figmaKey)).toEqual(["token:NoSlash", "token:Color/Empty"]);
  });
  test("rejected entries are not written and the rest are", async () => {
    const result = await setCodeMapEntries({ codeRepo: root, entries: { good: entry(), bad: entry({ status: "nope" }) } });
    expect(result.written).toEqual(["good"]);
    expect(result.rejected.map((r) => r.figmaKey)).toEqual(["bad"]);
    expect(mapOf(root).components.bad).toBeUndefined();
  });
  test("every PropRule shape, variants, dotted names and the caller's verified are accepted and verified from the scan", async () => {
    const result = await setCodeMapEntries({
      codeRepo: root,
      entries: {
        full: entry({
          verified: false,
          props: {
            Label: { children: true }, Size: { prop: "size", values: { Small: "sm" } }, Text: { prop: "label" },
            State: { values: { Disabled: { size: "sm" }, Hover: null } }, Icon: { ignore: true },
          },
          variants: [{ when: { Type: "Card" }, import: { from: "acme-ui", name: "Card.Header" } }],
        }),
      },
    });
    expect(result.rejected).toEqual([]);
    expect(mapOf(root).components.full.verified).toBe(true);
  });
  test("unverified: undeclared package, not installed, tag, partial props, unknown prop, custom with props", async () => {
    const result = await setCodeMapEntries({
      codeRepo: root,
      entries: {
        plain: entry({ import: { from: "acme-plain", name: "Thing" } }),
        absent: entry({ import: { from: "acme-absent", name: "Thing" } }),
        tag: entry({ import: { tag: "acme-button" } }),
        partial: entry({ import: { from: "acme-ui", name: "Card" }, props: { Title: { prop: "title" } } }),
        unknownProp: entry({ props: { Tone: { prop: "tone" } } }),
        customProps: entry({ status: "custom", import: { from: "src/components/Hero", name: "Hero" }, props: { T: { prop: "t" } } }),
        custom: entry({ status: "custom", import: { from: "./src/components/Hero.tsx", name: "Hero" } }),
        missing: { figmaName: "Later", status: "missing", note: "to build" },
      },
    });
    expect(result.rejected).toEqual([]);
    expect(result.unverified.sort()).toEqual(["absent", "customProps", "partial", "plain", "tag", "unknownProp"]);
    const map = mapOf(root);
    expect(map.components.plain.verified).toBe(false);
    expect(map.components.custom.verified).toBe(true);
    expect(map.components.missing).toEqual({ figmaName: "Later", status: "missing", verified: false, note: "to build" });
    expect(map.packages["acme-plain"]).toBe("0.1.0");
    expect(map.packages["acme-absent"]).toBeUndefined();
  });
});

describe("flag (10)", () => {
  const capture = () => {
    const names: string[] = [];
    return { names, server: { tool: (name: string) => names.push(name) } };
  };
  test("no code map tool is registered when CODE_MAP is off", () => {
    const { names, server } = capture();
    expect(registerWhenEnabled("CODE_MAP", (s: any) => registerTools(s), server, null, {})).toBe(false);
    expect(registerWhenEnabled("CODE_MAP", (s: any) => registerTools(s), server, null, { L2F_FLOWS: "1" })).toBe(false);
    expect(names).toEqual([]);
  });
  test("both tools are registered when CODE_MAP is on", () => {
    const { names, server } = capture();
    expect(registerWhenEnabled("CODE_MAP", (s: any) => registerTools(s), server, null, { L2F_CODE_MAP: "1" })).toBe(true);
    expect(names).toEqual(["scan_code_components", "set_code_map_entries"]);
  });
  test("server.ts registers the module only through the CODE_MAP gate", () => {
    const source = readFileSync("src/llm2figma_mcp/server.ts", "utf8");
    expect(source).toContain('registerFeature("CODE_MAP", (s) => registerCodeMapTools(s));');
    expect(source.match(/registerCodeMapTools\(/g)).toHaveLength(1);
  });
});
