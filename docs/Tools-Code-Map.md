# Tools Code Map

**Tags:** `reference` · `tools` · `components` · `code`

Tools that connect Figma components to the components of a code repository. Both are behind `L2F_CODE_MAP=1` (see [feature flags](Getting-Started.md#feature-flags)) and need no Figma connection.

Nothing about any design system is built in. The repository is passed as `codeRepo` (an absolute path) on every call and is never remembered.

## Objects

- **CodeRepo**: the repository directory, `codeRepo`.
- **Manifest**: the `package.json` that lists the design-system packages. `<codeRepo>/package.json` by default; in a workspace, pass `manifest` relative to the CodeRepo (`apps/web/package.json`). Packages are found by walking up `node_modules` from the Manifest to the CodeRepo root, so hoisted dependencies work.
- **DesignSystemPackage**: a package in the Manifest's `dependencies`, `devDependencies` or `peerDependencies`.
- **CodeComponent**: `{name, from, props, propsState}`, read from a package's declaration files.
- **CodeMap**: `<codeRepo>/.l2f/code-map.json`, committed in the CodeRepo:
  `{l2fCodeMap: 1, packages: {<name>: <version>}, components: {<figmaKey>: CodeMapEntry}, tokens: {<Collection/Name>: <code token>}}`.

## Safety

- **Never runs anything** from the CodeRepo: no `import`, `require`, compiler or package manager. Declaration files (`.d.ts`, `.d.mts`, `.d.cts`) are read as text.
- **Reads** only the Manifest, each package's `package.json` and declaration files (and its `@types/<package>`), the CodeMap, and whether a `custom` file exists. Every path is resolved through symlinks and must stay inside the CodeRepo; a pnpm-style link into a store inside the CodeRepo is fine. Package names and subpaths are validated before they touch a path.
- **Writes** only the CodeMap. A symlinked `.l2f` or CodeMap is refused, and an existing file that is not a CodeMap is never overwritten. Writes to one CodeMap run one at a time, go through a temp file, and are retried once if the file changed meanwhile, then fail with "the code map changed while writing".

## Tools

- `scan_code_components {codeRepo, manifest?, package?}` — without `package`, returns `{dependencies, truncated}` so the caller picks one. With `package` (a dependency, or `name/subpath`), returns the package's components:

  ```json
  // scan_code_components → { "codeRepo": "/work/app", "package": "acme-ui" }
  {
    "package": "acme-ui",
    "packageVersion": "1.2.3",
    "noDeclarations": false,
    "components": [
      { "name": "Button", "from": "acme-ui", "props": ["label", "size"], "propsState": "complete" },
      { "name": "Field", "from": "acme-ui", "props": ["value", "id"], "propsState": "partial" }
    ],
    "truncated": false
  }
  ```

  Only PascalCase value exports are components; hooks, utilities, types and enums are skipped. `propsState` is `complete` for a plain interface or type literal, `partial` for `extends`, intersections, generics and `Omit`/`Pick` (with the names it could read), and `unknown` when no props type is found. `noDeclarations: true` means the package has no declaration entry; an uninstalled package also returns `installed: false`. Re-exports from other packages are not followed and are listed under `unfollowed`. The scan stops at 400 files, 2 MB per file and 2,000 exports, and returns at most 100 components; any of these sets `truncated: true`.

- `set_code_map_entries {codeRepo, manifest?, entries, tokens?}` — merges entries into the CodeMap, creating it when absent; `null` removes a key. Returns `{path, written, removed, rejected: [{figmaKey, reason}], unverified}`. Rejected entries are not written; the rest are.

  ```json
  // set_code_map_entries
  {
    "codeRepo": "/work/app",
    "entries": {
      "4f2a…": {
        "figmaName": "Button",
        "status": "package",
        "import": { "from": "acme-ui", "name": "Button" },
        "props": {
          "Label": { "children": true },
          "Size": { "prop": "size", "values": { "Small": "sm", "Large": "lg" } },
          "State": { "values": { "Disabled": { "disabled": true }, "Hover": null } }
        },
        "variants": [{ "when": { "Type": "Icon only" }, "import": { "from": "acme-ui", "name": "IconButton" } }]
      },
      "9c1e…": { "figmaName": "Hero", "status": "custom", "import": { "from": "src/components/Hero.tsx", "name": "Hero" } },
      "77b0…": { "figmaName": "Data grid", "status": "missing", "note": "not built yet" }
    },
    "tokens": { "Color/Primary": "--color-primary" }
  }
  ```

  Each entry is checked: `status` is `package`, `custom` or `missing`; `package` and `custom` need an `import` on the entry or on every variant, `missing` has none; a `package` import's package must be in the Manifest and, when it has declarations, the import's name (its root identifier for `Card.Header`, or the default export for `default: true`) must be exported; a `custom` import's `from` must be relative, inside the CodeRepo and exist; each PropRule must be one of `{prop}`, `{prop, values}`, `{values: {<value>: {<codeProp>: literal} | null}}`, `{children: true}` or `{ignore: true}`.

  `verified` is set by the tool. It is `true` when the import was confirmed by a scan and every mapped prop is in a `complete` prop list (for `custom`, when the file exists and no props are mapped). It is `false` for a package without declarations, a `{tag}` import, `partial` or `unknown` props, or a mapped prop the scan did not find. Unverified entries are still written. The installed version of every package an entry uses is recorded in `packages`.

## Known limits

Packages that describe components without TypeScript declarations (Vue single-file components, Angular modules, web-component manifests) scan as `noDeclarations`; map them by hand, unverified. The scan is a bounded text scan, not a compiler, so unusual declaration shapes give `unknown` props rather than a guess. Token values are stored, not compared.
