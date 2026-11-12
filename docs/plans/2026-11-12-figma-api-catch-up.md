# Plan: bring llm2figma up to the current Figma Plugin and REST APIs

Date: 2026-11-12 (revised after backend and frontend review). Branch base: `feat/llm2figma-efficiency` (HEAD 856639d). Status: **confirmed by the user on 2026-11-12** (stack on `feat/llm2figma-efficiency`; `docs/` tracked; add `delete_component_property`; Figma token in the Keychain, never the shell profile). See [Review findings](#review-findings) for what changed and what did not.

Source list: the maintainer's llm2figma enhancement list, items 2 to 11 (item 1, typings 1.142.0 and the `ws` pin, is done). API names were checked against `node_modules/@figma/plugin-typings` 1.142.0. Anything the typings cannot settle is marked UNCONFIRMED and gets a live check inside its PR.

Naming, one name per object: **Comment**, **Flow**, **Variable**, **VariableCollection**, **Mode**, **ComponentProperty**, **Slot**, **GridLayout**, **DevResource**, **DevStatus**, **Measurement**, **Slide**, **TextPath**, **Spec**, **SpecLock**, **Plan**, **OpaqueNode** (the last four are defined in [Spec sync](#spec-sync-prs-11a-to-11d)). "Backend" is the MCP server (`src/llm2figma_mcp`) and relay (`src/socket.ts`); "frontend" is the Figma plugin (`src/llm2figma_plugin`).

## PR table

Sizes are estimated changed lines excluding tests, docs, and regenerated bundles (`plugin/server/*.js`, `plugin/figma-plugin/*`, `src/llm2figma_plugin/code.js`); ceiling ~430 per PR. Estimates, not measurements. Each PR is based on the one above it.

| # | PR | Side(s) | Flag | Size | Depends on |
|---|---|---|---|---|---|
| 1 | Flag registry, env pass-through for both launch paths, editor-type gate, all manifest edits (**one plugin re-import**), `test:unit` script | both | declares all | ~170 | none |
| 1b | Figma token from the Keychain for all REST calls (library tools move off `FIGMA_API_TOKEN`) | backend | none (replaces the env path) | ~150 | 1 |
| 2 | File key: `get_document_info.fileKey`, `join_channel` fallback | both | `L2F_FILE_KEY` | ~100 | 1 |
| 3 | Comments: Keychain reader, `get_comments`, `reply_to_comment` | backend | `L2F_COMMENTS` (read), `L2F_COMMENTS_WRITE` (reply) | ~260 | 1, 2 |
| 4 | Comments: pin context (node name, top-level section) via plugin | both | `L2F_COMMENTS` | ~110 | 3 |
| 5 | Flows: `get_flows`, `set_flows`, backgrounds, `get_prototype_links` | both | `L2F_FLOWS` | ~280 | 1, 2 |
| 6 | Variables: collections, modes, values, per-mode aliases, `bind_variable` | both | `L2F_VARIABLES_WRITE` | ~430 | 1 |
| 7 | ComponentProperty: get, add, edit, `bind_layer_to_property` | both | `L2F_COMPONENT_PROPERTIES` | ~340 | 1 |
| 8 | Slot: `create_slot` and SLOT property | both | `L2F_COMPONENT_PROPERTIES` | ~100 | 7 |
| 9 | GridLayout: grid in `set_layout_mode`, `set_grid_child` | both | `L2F_GRID_LAYOUT` | ~230 | 1 |
| 10 | Verify A: `resize_node` and `batch_mutate` resize read-back, `assert_contained`, `snapshot_positions`, `diff_positions` | both | `L2F_VERIFY` | ~380 | 1 |
| 11 | Verify B: `audit_paints`, `audit_structure` | both | `L2F_VERIFY` | ~260 | 10 |
| 11a | Spec sync: refactor. Lift `updateNodeProperties`, `createNode`, `syncNode` and variable binding out of the `create_node_tree` closure; additive `only` and `onBindFailure` parameters | frontend | none | ~260, mostly moved | 1 |
| 11b | Spec sync: `pull_spec` writes a Spec file and SpecLock, plus the round-trip tests | both | `L2F_SPEC_SYNC` | ~450 | 2, 10, 11a |
| 11c | Spec sync: `plan_spec` returns the property-level difference between Spec, SpecLock and live Figma; writes nothing | both | `L2F_SPEC_SYNC` | ~380 | 11b |
| 11d | Spec sync: `apply_spec` carries out one Plan by node id, reads back, updates the Spec and SpecLock | both | `L2F_SPEC_SYNC` | ~420 | 11c |
| 12 | Dev Mode: DevStatus, DevResource, Measurement | both | `L2F_DEV_MODE` | ~300 | 1 (5 for the done-when example) |
| 13 | Slides: grid read, create, name, reorder | both | `L2F_SLIDES` | ~240 | 1 |
| 14 | TextPath tool, then remove all flags | both | `L2F_TEXT_PATH`, removes all | ~190 | all |

14 PRs rather than 22, plus the four spec-sync PRs (11a to 11d) added on 2026-11-12 after the plan was confirmed. Landing order is priority order (comments first, since design review feedback is arriving as Figma comments). PRs 5 onward are independent of each other, so a stalled one can be rebased out. Land in order, not as a batch; suggested merge milestones: A = 1 to 4, B = 5, C = 6, D = 7 to 9, E = 10 to 11, E2 = 11a to 11d, F = 12 to 14. Each milestone bumps the `version` in `plugin/.claude-plugin/plugin.json` (currently 0.2.0).

## Rules every PR follows

- **Gate.** Server tools are registered only when the feature's env flag is on. There are no plugin-side toggles (see [Flag mechanism](#flag-mechanism-pr-1)).
- **Wiring.** Add the command to `FigmaCommand` and `CommandParams` in `src/llm2figma_mcp/types.ts`, a dispatcher case in `src/llm2figma_plugin/src/main.ts`, and a Zod tool in `src/llm2figma_mcp/tools/`.
- **Checks.** `bun run typecheck` (the build does not typecheck) and the `test:unit` script.
- **Bundles.** Regenerated bundles (`plugin/server/*.js`, `plugin/figma-plugin/*`, `src/llm2figma_plugin/code.js`) are rebuilt and committed only when a PR is about to merge, not in every stacked PR. After each merge, rebase the next PR and rebuild then. This avoids a bundle conflict on every restack. Bundle-free PRs are reviewed from `src/` alone.
- **Manifest.** The PR text must say "plugin re-import required" whenever `manifest.json` changes. After PR 1 no PR should need to.
- **Tests.** Server tools use the fake `server.tool` capture from `tests/efficiency.test.ts`; plugin modules use the mocked `figma` global from `tests/plugin-library.test.ts`. Each PR extends that mock with what it touches (`addMeasurement`, `getCanvasGrid`/`setCanvasGrid`, `variables.createVariableCollection` and `addMode` returning mode ids, `editorType`, `flowStartingPoints`) and each editor-gated command gets a mocked-`editorType` case. Each PR adds its test file to `test:unit`. No Figma needed.
- **Pre-PR scan** on added lines, tests and bundles included, per `~/.claude/rules/pre-pr-security-scan.md`. `plugin/server/server.js` already contains 1 `new Function(` and 7 `http://` from bundled dependencies; they are unchanged lines, so any hit in a diff is a regression. REST and prototype URLs use `https://`.
- **Size check:** `git diff --stat <base>...HEAD -- . ':(exclude)*.test.*' ':(exclude)tests' ':(exclude)plugin' ':(exclude)src/llm2figma_plugin/code.js'`.
- **Docs.** `docs/` is tracked (un-ignored before PR 1; `docs/.obsidian/` stays ignored). Each PR updates its tool page in `docs/` and the `README.md` tool list, and adds a `wiki/` entry for gotchas.
- **PR description** follows the template in `feature-change-workflow.md`. Live Figma checks are pasted as output or screenshot.
- **Deviation from "backend first, then frontend".** A tool and its plugin command ship in one PR. The plugin command is inert until a gated tool calls it, so each PR is dark and shippable.

## Flag mechanism (PR 1)

Server-side env flags only. A plugin-side toggle was considered and dropped: `figma_eval` runs arbitrary code in the plugin and is ungated, so toggles would give review isolation but no protection, and cost ~45 lines of `ui.html` plus a default-off trap.

- New `src/shared/flags.ts`: `FEATURES` and `isEnabled(feature, env = process.env)`, true when `L2F_<FEATURE>=1` or `L2F_ALL=1`. `L2F_ALL` **excludes** `L2F_COMMENTS_WRITE`, which must always be set on its own. `server.ts` registers a feature's tool module only when enabled. No tool parameter can turn a feature on; tests pass `env` as an argument.
- Flags: `L2F_FILE_KEY`, `L2F_COMMENTS`, `L2F_COMMENTS_WRITE`, `L2F_FLOWS`, `L2F_VARIABLES_WRITE`, `L2F_COMPONENT_PROPERTIES`, `L2F_GRID_LAYOUT`, `L2F_VERIFY`, `L2F_SPEC_SYNC`, `L2F_DEV_MODE`, `L2F_SLIDES`, `L2F_TEXT_PATH`.
- **Launch paths.** (a) `.mcp.json` install: add `L2F_*` entries to the `env` block, written by `scripts/write-mcp-config.ts`. (b) Claude Code plugin install: add an `env` block to `mcpServers.LLM2Figma` in `plugin/.claude-plugin/plugin.json` with `"L2F_X": "${L2F_X:-}"` for each flag, so shell exports reach the bundled server. If the live test shows the desktop app does not pass them, fall back to a server-only flags file under `CLAUDE_PLUGIN_DATA`. PR 1 tests both: unit tests on `write-mcp-config` output and the `plugin.json` env keys, and a live check that setting `L2F_FLOWS=1` makes the tools appear under each install path and unsetting removes them.
- **Existing tools that gain fields (decided per case).**
  - `get_document_info.fileKey` (PR 2): stripped server-side when `L2F_FILE_KEY` is off, so output is unchanged.
  - `resize_node` and `batch_mutate` resize results (PR 10): new keys (`requested`, `applied`, `partial`, `cause`) are stripped server-side when `L2F_VERIFY` is off; existing result keys are kept in all cases and fields are only added.
  - `get_document_info.editorType` (PR 1): additive and **ungated**, a single string field.
  - `set_layout_mode` GRID (PR 9): in the schema only when `L2F_GRID_LAYOUT` is on, so with it off the schema is byte-identical.
- **Manifest edits are ungated.** `enablePrivatePluginApi`, the `slides` and `buzz` editor types, and `dev` (if the live check shows it is needed) take effect on re-import regardless of any flag. They are folded into PR 1 so there is **one** plugin re-import for the whole stack, which is the recommended option. Folding means the manifest runs ahead of the features; that is harmless because nothing new is exposed until a tool is registered.
- **Editor-type gate (PR 1).** A dispatcher-wide check: mutating commands refuse when `figma.editorType === "dev"`, and slide-only commands refuse outside `slides`. Each later command declares its allowed editors in one table.
- **Removal.** PR 14 deletes `flags.ts`, the env checks and the `plugin.json` env block. A feature can be un-gated earlier once its live check is recorded.
- Verification: `tests/flags.test.ts` (off by default, per flag, `L2F_ALL` includes everything except `L2F_COMMENTS_WRITE`, gated module not registering, gated-off server tolerating new plugin result shapes, editor-type gate with mocked `editorType`).

## Per-PR detail

### PR 1. Flags, launch paths, manifest
Files: new `src/shared/flags.ts`; `src/llm2figma_mcp/server.ts`; `scripts/write-mcp-config.ts`; `plugin/.claude-plugin/plugin.json` (env block); `src/llm2figma_plugin/manifest.json` (`enablePrivatePluginApi: true`; editorType gains `slides`, `buzz`, and `dev` only if the live check below shows the plugin must declare it, with its required capabilities, UNCONFIRMED); `src/llm2figma_plugin/src/main.ts` (editor-type gate table, `editorType` in document info); `package.json` (`test:unit`); `CLAUDE.md` and `AGENTS.md` test command. Frontend and backend both change; tool behavior does not. **Plugin re-import required** (remove and re-import; a reload keeps old permissions). Live check: adding `dev` does not break the plugin in Design mode. Size ~170.

### PR 1b. Figma token from the Keychain, for every REST call
User requirement (2026-11-12): the Figma API token is stored in the macOS Keychain, never in `~/.zshrc` or any shell profile, and never in `.mcp.json`. This replaces how the existing library tools get their token, so it lands before any new REST tool.
- New `src/llm2figma_mcp/keychain.ts`: `getFigmaToken()` runs `security find-generic-password -s llm2figma -a figma-api-token -w` through `Bun.spawn` with an argument array (no shell, token never on a command line), kills it after ~10 s (a locked Keychain shows a GUI prompt), trims the newline, and caches nothing between calls. Missing item, locked Keychain, timeout and non-macOS each return a fixed setup message; the token never appears in a log, result or error.
- One token for everything: a personal access token with **File content: read**, **Library content: read**, **file_comments:read** and **file_comments:write**.
- `tools/library.ts`: `getLibraryConfig` takes the token from `getFigmaToken()` instead of `env.FIGMA_API_TOKEN`. `FIGMA_LIBRARY_FILE_KEYS` (not secret) stays an env var. The soft-fail setup text changes to the Keychain command.
- `scripts/write-mcp-config.ts`: stops carrying `FIGMA_API_TOKEN` into the `env` block and removes it when rewriting an existing `.mcp.json`, so a literal token left there by an earlier setup is cleaned out. `setup_status` reports whether the Keychain item exists (never its value).
- Docs: `README.md`, `CLAUDE.md` and `docs/Getting-Started.md` replace the `export FIGMA_API_TOKEN` / `~/.zshrc` steps with `security add-generic-password -s llm2figma -a figma-api-token -w` (it prompts, so the token stays out of shell history), and tell users to delete the old export from their shell profile.
- **Not flagged**, deliberately: a flag would mean keeping the env path the user has ruled out. Rollback is reverting the PR.
- **Limitation:** Keychain is macOS only. On Linux or WSL the library and comments tools soft-fail with a message; a cross-platform store is out of scope until someone needs it.
- Verification: unit tests with an injected spawn (found, missing item, locked/timeout, non-zero exit) asserting a sentinel token never appears in any output; `tests/library.test.ts` moves from `process.env.FIGMA_API_TOKEN` to an injected token reader; `write-mcp-config` test asserts `FIGMA_API_TOKEN` is dropped from an existing config. Live: with the export removed from the shell profile and the server restarted, `get_library_components` still works. Size ~150.

### PR 2. File key
Files: plugin `document.ts` `getDocumentInfo` adds `fileKey: figma.fileKey ?? null`; `tools/navigation.ts` `join_channel` gains optional `fileKey` (a bare key or a figma.com URL, key extracted then validated `^[A-Za-z0-9]{10,}$`); `connection.ts` per-channel key map; `tools/document.ts` merges: plugin key wins, else user key, reporting `fileKeySource: "plugin"|"user"|null`, stripped when the flag is off. A dev-linked plugin will not receive `figma.fileKey`, so the done-when is met by `fileKeySource: "user"` in that case, and by `"plugin"` only if it works on this install. Verification: URL-to-key parsing, invalid keys rejected, merge precedence, flag-off stripping. Size ~100.

### PR 3. Comments: read and reply
Item 2. Backend only. Files: new `tools/comments.ts`, `server.ts`; the token comes from the shared Keychain reader added in PR 1b. `get_comments {fileKey?, since?, includeResolved?}` calls `GET https://api.figma.com/v1/files/:key/comments?as_md=true` (scope `file_comments:read`). The endpoint has no server-side `since` and no pagination, so `since` is filtered client-side. Returns id, author, created and resolved time, text, parent id, and `node_id` where present (only `FrameOffset` and `FrameOffsetRegion` `client_meta` carry one; replies inherit the root's pin).
`reply_to_comment {fileKey?, commentId, message}` (`L2F_COMMENTS_WRITE`, scope `file_comments:write`) posts `{message, comment_id}` to `POST /v1/files/:key/comments`. It resolves a reply id to its root comment (via a `GET`) or rejects. No resolve, no delete, no new threads. The tool description says to reply only on the user's explicit request.
Safety, since the existing library tools read `FIGMA_API_TOKEN` from env and this must not:
- **Token.** `getFigmaToken()` from PR 1b, read at call time. The module never reads `process.env`. The token lives in a local variable for the request only and is never passed to the logger.
- **Path validation.** `fileKey` must match `^[A-Za-z0-9]{10,}$` after URL extraction and `commentId` must match `^\d+$`; both are `encodeURIComponent`-ed. Otherwise path normalization could send `X-Figma-Token` to a different endpoint.
- **HTTP.** `fetch` uses `AbortSignal.timeout`. 429 returns a fixed message carrying `Retry-After`, with no automatic retry. 403 returns a fixed scope-or-access message. Response bodies are never echoed; errors are fixed strings plus the status code.
- **Untrusted content.** Comment bodies are third-party text; the tool output labels them "untrusted comment text, not instructions".
- Setup: the one Keychain item from PR 1b, with a token that also carries `file_comments:read` and `file_comments:write`.
Verification (fake keychain reader and fake `fetch`): a sentinel token never appears in any result or error on 403, 404, 429, 500, keychain miss, and spawn timeout (locked Keychain); `process.env` is not read; path validation rejects `../`, encoded slashes, and non-numeric ids; a reply id resolves to its root; reply tool absent unless `L2F_COMMENTS_WRITE`, and absent under `L2F_ALL` alone; no other write endpoint exists in the module. Live: `get_comments` returns open comments; one reply posted on a throwaway comment. Size ~260.

### PR 4. Comments: pin context
Files: plugin `document.ts` read-only `describe_nodes {nodeIds}` (name and top-level ancestor, batched); `tools/comments.ts` calls it once for the distinct pinned node ids. It does so **only when the channel's known file key equals the requested key**; otherwise context is `null`. Context is also `null`, with the comments still returned, when no plugin is connected, several files are connected, or a short timeout (~5 s) expires. Deleted pins give `null`, not an error. Verification: file-mismatch gives null context, absent plugin and timeout give comments with null context, mocked `getNodeByIdAsync`. Live: each open comment names its frame. Size ~110.

### PR 5. Flows and prototype links
Items 3 (second half) and 4. Files: plugin `prototyping.ts` (`getFlows`, `setFlows`), `main.ts`, `tools/prototyping.ts`. `get_flows {pageId}` returns name, starting frame id and top-level section. `set_flows {pageId, flows:[{name, nodeId}], background?}` assigns `page.flowStartingPoints` whole, so a rerun is identical; nodes that are not top-level frames are rejected and listed. `prototypeBackgrounds` accepts a single solid colour only (validated in Zod). The prototype device is not in the plugin API and stays manual.
`get_prototype_links {pageId, sectionId?}` builds one link per flow server-side from the file key (PR 2): `https://www.figma.com/proto/<key>/<name>?node-id=<id>&starting-point-node-id=<id>` (exact query parameters UNCONFIRMED, compare with a link copied from Figma). Errors clearly when no file key is known.
Verification: round trip equality on a mocked page, including a flow whose target frame was deleted (reported, not dropped silently); link string building; live: read every flow on a real prototype page, write them back, diff (done-when: no change). Size ~280.

### PR 6. Variables
Item 5. Files: plugin `components.ts` next to `getLocalVariables`; `tools/components.ts`. Tools: `create_variable_collection {name, modes:[names]}` (renames the default mode to `modes[0]`); `create_variables {collection, variables:[{name, type, values:{<modeName>: literal | {alias}}}]}`; `bind_variable {nodeId, field:"fills"|"strokes", paintIndex?, variable}` (list-capable) wrapping the existing `bindVariableToColor`, which already covers fills and strokes through `setBoundVariableForPaint`. Alias targets resolve with the existing `getVariableByName`, falling back to `importVariableByKeyAsync` for library tokens (the `ref` from `get_library_variables`).
Guards: an alias is accepted only inside the per-mode `values` map and every mode must have a value, so one alias can never collapse all modes. Rerun is idempotent: an existing variable of the same name and type is updated, a type mismatch errors. Extended collections are out of scope.
Verification: mock with `createVariableCollection` and `addMode` returning mode ids; two modes aliased to different targets keep different resolved values; rerun idempotency; `boundVariables.fills[i]` and `strokes[i]` read separately. Live: a two-mode colour collection aliased to library tokens per mode and bound to a frame's fill and stroke in one batch. Size ~430 (at the ceiling; the three parts share one resolver, so splitting would duplicate it).

### PR 7. ComponentProperty
Item 6. Plugin `components.ts` and `tools/components.ts`: `get_component_property_definitions`, `add_component_property` (BOOLEAN, TEXT, INSTANCE_SWAP, VARIANT), `edit_component_property`, `delete_component_property {componentId, propertyKey, dryRun = true}` (BOOLEAN, TEXT, INSTANCE_SWAP, SLOT; not VARIANT; the dry run lists the layers whose `componentPropertyReferences` would be cleared and the instances carrying a value, and it deletes only with `dryRun: false`), `bind_layer_to_property {layerId, field:"visible"|"characters"|"mainComponent", propertyKey}` via `componentPropertyReferences` (layer must be inside the owning component). Returns the `name#id` key the API returns. Typings limits are enforced in the tool: no default change for VARIANT or SLOT, `preferredValues` only for INSTANCE_SWAP and SLOT. `componentPropertyReferences` throws `cannotApplySlotPropertyToFrameWithGrid` on grid frames; that error is surfaced as is. Existing `set_component_properties` (instance values) is untouched. VARIANT creation on a component set is verified live. Verification: mocked component and layer; the delete dry run lists affected layers and deletes nothing; live: a status-card component set gets a text label property with no `figma_eval`. Size ~380.

### PR 8. Slot
SLOT cannot be bound with `componentPropertyReferences`; it is wired with `createSlot()` plus `addComponentProperty(name, 'SLOT', ...)`. Tool `create_slot {componentId, name, parentId?}`. `setProperties` on an instance throws `cannotSetSlotProperty`; the tool reports that instead of retrying. SLOT is not part of the bind done-when in PR 7. `deleteComponentProperty` is not included (Open question 6). Verification: mock; live. Size ~100.

### PR 9. GridLayout
Item 7. `tools/layout.ts`: `set_layout_mode` gains `GRID` and `gridRowCount`, `gridColumnCount`, `gridRowGap`, `gridColumnGap`, `gridRowSizes`, `gridColumnSizes`, `gridAutoTracks`, `gridItemsPositioning`; new `set_grid_child {nodeId, row, column, rowSpan?, columnSpan?}`. Plugin `layout.ts` branches on GRID and skips `layoutWrap` and `itemReverseZIndex` there. Track sizes are applied by mutating the `GridTrackSize` entries in place (`gridRowSizes[i].type` / `.value`), not by assigning a new array. `gridRowCount` throws while `gridAutoTracks` is `ROWS`, and `setGridChildPosition` throws in auto-positioning mode; the tool names the blocking mode. "Named cell" is read as a row and column index (Open question 5). Not included: grid in `create_node_tree`. Verification: mock whose `gridRowSizes` returns entry objects (a test that assigns an array must fail); live: 3 by 2 grid, one child moved. Size ~230.

### PR 10. Verify A: read-back, containment, snapshots
Item 8. New `src/shared/walk.ts` (bounded walk with `maxNodes`, `maxDepth` and an explicit `truncated` flag).
- **`resize_node` and `batch_mutate` resize (`analysis.ts` ~line 178) read-back.** Both return `{requested, applied, partial, cause}`, keeping all existing result keys. `cause` names why Figma applied less: `layoutSizing*` HUG or FILL, `minWidth` / `minHeight`, or `maxWidth` / `maxHeight`; unexplained partials say so. Output is stripped when `L2F_VERIFY` is off.
- **`assert_contained {parentId, expected?}`** compares each child's `absoluteBoundingBox` to the parent's with a 0.5 px tolerance, ignoring render-bounds shadows and noting rotated nodes. A node whose box is null is reported `unmeasurable`, not passed. `expected` is an optional snapshot id or offset map, and the result includes `parentGrewSinceSnapshot`. The tool description states that a bare containment pass does not prove placement, because sections auto-grow around displaced children.
- **`snapshot_positions {nodeId}`** returns `{snapshotId, count}` and keeps `{id, name, parentId, box}` in a bounded plugin-side store (expiry and entry cap like `reference_cache`). **`diff_positions {snapshotId}`** returns missing ids, added ids and moved ids. The store is lost on plugin reload, so an unknown id returns "snapshot expired", never an empty diff. Ids are explicit, never "latest".
Verification: a mock that ignores height on `resize` (and a HUG case that explains the difference); `batch_mutate` read-back; containment true/false, null box, rotated, tolerance edge; a snapshot-expired test; reparent and absorb cases for the diff. Live: a resize blocked by `minHeight`; a reparent with zero drift. Size ~380.

### PR 11. Verify B: audit_paints, audit_structure
`scanNodeStyles` is not modified.
- **`audit_paints {nodeId}`** returns separate `fills` and `strokes` objects, each `{unbound, total, ids, notApplicable, boundByStyle, mixedUnaudited}`. Binding is checked per paint index with `node.boundVariables.fills[i]` / `strokes[i]`. Gradient stops are checked through their own `boundVariables.color`. Image paints count as not applicable. A node with `fillStyleId` / `strokeStyleId` counts as bound-by-style. TEXT nodes with mixed fills are read through `getStyledTextSegments(['fills'])`, or reported "mixed, unaudited".
- **`audit_structure {nodeId, flatChildLimit?}`** reports generic names (`Frame 12`), content-derived names, containers over the flat-child limit (default 40), clusters of `Frame \d+` wrappers (the suggest-auto-layout fingerprint), and containers with non-uniform individual stroke weights (`strokeLeftWeight` and siblings) and no matching line node (the absorbed-bus case).
Both are bounded with explicit truncation. Verification: an unbound stroke beside a clean fill must not read as clean; gradient, image, style-bound and mixed-text fixtures; each structure finding. Live: the walkthrough file. Size ~260.

### Spec sync (PRs 11a to 11d)

Added 2026-11-12 and revised the same day after backend and frontend review (see [Review findings](#review-findings)).

**Goal.** Editing an existing design should cost a few lines, and should never redraw. A design subtree is written to a file on disk; the model edits that file with ordinary file edits; the bridge works out the difference against live Figma, shows it, and applies only that. Nodes are matched by id, so node ids, hand tweaks and anything the file cannot express all survive.

**Why it is not the existing sync mode.** `create_node_tree` with `rootId` (`syncNode` in `src/llm2figma_plugin/src/node-tree.ts`) already updates in place, but it matches children by `name::type`, cannot reorder or move, deletes with `remove()` when `prune` is set, has no dry run, and there is no way to read a tree back in spec format. Spec sync is a new path. `create_node_tree` and its sync mode keep their behaviour and tests (`tests/sync-mode.test.ts`) unchanged.

**Objects.**

- **Spec**: a JSON file, name ending `.l2f.json`. Header `{l2fSpec: 1, fileKey, fileName, pageId, rootId}` and a `tree` in `create_node_tree` node format (same keys, so text content is `text`, not `characters`), where every node pulled from Figma also carries `id`. A node without `id` is one to create.
- **SpecLock**: the sidecar `<name>.l2f.lock.json`, never edited by the model. `{l2fLock: 1, fileKey, fileName, pageId, rootId, pulledAt, specHash, supersededFrameId, pendingApply, nodes: {<id>: {props, propsHash, parentId, children: [ids]}}}`. `props` is the node's normalised properties as Figma held them at the last pull or apply. It is the base of the three-way comparison and the known-good id list. It stores properties, not only hashes, because a property-level difference cannot be computed from a hash.
- **Plan**: the computed difference, held server-side under an explicit `planId`, never "latest". Its own bounded store (`PlanStore` in `tools/spec.ts`: 8 plans, 30-minute expiry, 4 MB each), not `ReferenceCache`, whose 64 KB entry cap a 2,000-node Plan exceeds. It records the Spec hash, the channel, and the `propsHash` it saw for every node it will touch.
- **OpaqueNode**: a node the spec format cannot express. Written as `{type: "$opaque", id, name, nodeType}` with no children. The Plan can move, reorder or remove it, never edit or recreate it, and its subtree is never touched.

**Rules for all four PRs.**

- **Write only what changed, property by property.** `apply_spec` sets a property only when the Plan lists it. A property absent from the Spec is never written. A property the model deleted from the Spec is written back to its `SPEC_DEFAULTS` value only if the SpecLock base had it.
- **Editable types** are the five `create_node_tree` handles: frame, text, rectangle, vector, instance. OpaqueNodes in v1: ellipse, line, group, boolean operation, section, component, component set, slot, any rotated node (the format cannot write rotation, and `x`/`y` are ambiguous on one), and a subtree cut off by the node budget (`truncated: true`, never dropped silently; the Plan never proposes a removal inside it).
- **An instance is a leaf.** Export its `componentKey` (or `componentId` when the main component is local and unpublished, since it has no importable key), its `properties` flattened to `{"Name#id": value}`, and its sizing. Never walk its children: their ids (`I…;…`) cannot be created, moved or removed, and they change when the main component is updated. `plan_spec` rejects any operation on an id containing `;`.
- **One normaliser.** New `src/shared/spec.ts`, bundled into both server and plugin, holds `SPEC_DEFAULTS`, `normalizeNode(node, parentLayout)` and `hashProps(props)` (a small string hash over the rounded, key-sorted JSON; the plugin sandbox has no `crypto`). Numbers are rounded to 2 decimals on both the Spec side and the live side before any comparison; raw floats are never compared. `$var:` and `$lib:` references stay references. Child order is **not** part of `propsHash`; it lives in `children`, so a reorder is a move and nothing else.
- **What the normaliser leaves out** (these are derived by Figma, and including them reports untouched nodes as changed):
  - `x` and `y` when the parent has auto-layout and the node is not `layoutPositioning: ABSOLUTE`.
  - `width` or `height` on an axis whose `layoutSizing*` is HUG or FILL.
  - Text: `height` always; `width` unless `textAutoResize` is `HEIGHT`. `textAutoResize` itself is always emitted.
  - Any property whose live value is `figma.mixed` (`cornerRadius` with unequal corners, `strokeWeight` with individual weights, mixed `fontName`, `fontSize` or fills). For text with mixed styles only `text` is emitted.
  - `lineHeight` that is not in pixels, and a fractional `fontSize` (the write path is pixels-only and uses `parseInt`).
  - A paint list with more than one visible paint, or a non-solid paint.
  - `strokeCap` unless every vertex of the vector network agrees.
  - A colour bound to a variable whose `Collection/Name` does not resolve uniquely (`getVariableByName` throws on ambiguity, `utils.ts` ~line 388).
  - `pathData` is emitted in the form Figma reads back from `vectorPaths[0].data`, and compared in that form.
- **Never delete.** A removal moves the node into a page-level frame named `l2f/superseded` (`layoutMode: NONE`, `clipsContent: false`, id kept in the SpecLock as `supersededFrameId` and re-created if gone) and renames it `<name> (superseded YYYY-MM-DD)`. Only the topmost node of a removed subtree moves; descendants travel with it. Absolute position is preserved by setting `relativeTransform` from the node's old `absoluteTransform` and the inverse of the new parent's, then asserted. Removals need `allowRemovals: true`; without it they are listed and skipped. Nothing on this path calls `remove()`.
- **Right file, right page.** Node ids are identical in a duplicated file, so every plugin command on this path takes the expected `{fileKey, fileName, pageId}` and refuses on mismatch. `fileKey` comes from PR 2 and is compared when both sides have one; otherwise `fileName` (`figma.root.name`) is compared. The page is loaded with `getNodeByIdAsync(pageId)` and `loadAsync()`, never `figma.currentPage`. Known limit, stated in the tool description: without a file key, a copy renamed to the original's name is not detected.
- **File safety.** `path` must end `.l2f.json`. Relative paths resolve against `L2F_SPEC_DIR`, or the server's working directory when unset; absolute paths are accepted only when they fall inside that base. Containment is checked after resolving symlinks on the parent directory (the file may not exist yet). An existing file is overwritten only when it parses as a Spec. Writes go to a temp file in the same directory and are renamed. `specHash` is over the parsed, normalised content, not the bytes. Specs of real designs are not committed to this repository; test fixtures are synthetic.
- **Results stay small.** No tool returns the tree. `pull_spec` returns `{path, nodeCount, opaqueCount, truncated}`. `plan_spec` returns counts and at most 100 operations, with `truncated` when there are more.
- **Timeouts.** `export_spec`, `read_spec_nodes` and `apply_spec_ops` send a progress update every 50 nodes and are called with an explicit 120 s timeout (the default is 30 s, `connection.ts` ~line 311).
- **Editor gate.** `export_spec` and `read_spec_nodes` join `READ_ONLY` in `editor-gate.ts`; `apply_spec_ops` is mutating and refuses in `dev`.
- **Flag and env.** PR 11b adds `SPEC_SYNC` to `FEATURES` in `src/shared/flags.ts` and extends `tests/flags.test.ts`. `L2F_SPEC_DIR` is a setting, not a feature, so it is added separately to what `scripts/write-mcp-config.ts` emits and to the `env` block in `plugin/.claude-plugin/plugin.json`, with a test for each launch path.

#### PR 11a. Refactor
In `node-tree.ts`, `updateNodeProperties` (~line 142), `createNode` and `syncNode` are closures inside the `create_node_tree` handler; `createNode` and `syncNode` call each other, so all three are lifted to module level together. They take a context object carrying `{counters, errors, nodes, nodeTypeCounts, maxDepthSeen, totalNodes, firstOnTop, commandId}`; `COLOR_FIELDS` moves to module scope. The font cache and variable index are already module-level in `utils.ts` and need no context. The `$var:` resolution and binding steps (currently inline in `syncNode` steps 2 and 4 and in `createNode`) are lifted as one helper, `resolveAndBind`, because apply needs it and `updateNodeProperties` alone would hand a `$var:` string to `applyColorPaint`.

Two additive parameters, both defaulting to today's behaviour:
- `updateNodeProperties(node, spec, ctx, only?: Set<string>)`. With `only`, every branch not named is skipped. This matters because today the text branch always sets `fontName` (defaulting to Inter Regular), and `fillColor`, `strokeColor`, `fontColor`, `effects`, `lineHeight` and `letterSpacing` are written whenever present, with `applyColorPaint` replacing the whole paint array.
- `createNode(spec, parentId, depth, ctx, {onBindFailure})`: `"remove"` (today, line ~712) or `"keep"`, which renames the node `<name> (failed)` and reports it. Each created node is returned with the index path of its Spec node, so ids can be mapped back even when an earlier sibling failed.

Verification: `tests/sync-mode.test.ts` and the `create_node_tree` cases in `tests/efficiency.test.ts` pass before and after with no test edits; new spy tests, one per property branch, show that with `only` set no unnamed setter fires (text content alone must not touch `fontName`; `x` alone must not touch fills); `bun run typecheck`. Size ~260, mostly moved lines.

#### PR 11b. `pull_spec`
- Plugin command `export_spec {nodeId, expect: {fileKey?, fileName?, pageId?}, maxNodes = 2000, maxDepth = 30}` in a new `src/llm2figma_plugin/src/spec.ts`: walks with `src/shared/walk.ts` (PR 10), reads each node into spec properties, and returns `{fileKey, fileName, pageId, tree, nodes, nodeCount, opaqueCount, truncated}`, where `nodes` is the SpecLock map. Reading is the inverse of `updateNodeProperties`, subject to the omission list above.
- Cost at 2,000 nodes: `getMainComponentAsync` per instance, and `getVariableByIdAsync` plus the collection lookup per bound paint, are cached by id for the run. `getStyledTextSegments` is called only when a text property is `figma.mixed`.
- Tool `pull_spec {nodeId, path, maxNodes?, maxDepth?, replaceEdited = false}` in a new `src/llm2figma_mcp/tools/spec.ts` writes the Spec, then the SpecLock. If the Spec exists and its hash differs from `specHash` (unapplied edits), or `pendingApply` is set, it refuses and says why. With `replaceEdited: true` it first renames the old pair to `<name>.<timestamp>.bak`.
- Verification, mocked `figma`: (1) each editable type round-trips: `create_node_tree(tree)` then `export_spec` equals the normalised `tree`; (2) defaults are omitted, with a parity test against the defaults `createFrame` and `createNode` actually apply (`itemReverseZIndex` defaults to true in `creation.ts` ~line 172; `x`/`y` default to 0), so a default dropped on export is the same default create would apply; (3) every row of the omission list has a fixture; (4) a bound colour comes back as `$var:`, an ambiguous one is omitted; (5) group, ellipse, section and a rotated frame come back as OpaqueNodes with their subtree absent; an instance comes back as a leaf with flattened `properties`, and a local component as `componentId`; (6) the node budget yields a `truncated` OpaqueNode; (7) path escape through a symlinked parent, wrong extension, absolute path outside the base, and overwrite of a non-Spec file are refused; (8) unapplied edits and `pendingApply` are refused; (9) `L2F_SPEC_DIR` reaches both launch paths. Size ~450.

#### PR 11c. `plan_spec`
- Plugin command `read_spec_nodes {rootId, expect, baseHashes, maxNodes}` returns, for every node in the live subtree, `{propsHash, parentId, children}`, plus `props` only for nodes whose `propsHash` differs from the `baseHashes` entry sent in. It shares the walk and caches with `export_spec`.
- Tool `plan_spec {path}` refuses when `pendingApply` is set (an earlier apply may have partly run; the message says to pull). It rejects a Spec with a duplicate `id`, or with an `id` the SpecLock does not know. Then, for each node id and **each property** (base = SpecLock, desired = Spec, live = Figma):

  | Desired vs base | Live vs base | Result |
  |---|---|---|
  | same | same | unchanged |
  | differs | same | `update` of that property |
  | same | differs | `drift`: kept as Figma has it, reported; the message says to pull |
  | differs | differs, equal to desired | converged, no operation |
  | differs | differs otherwise | `conflict` on that property: reported, skipped by apply |

  Structure, compared the same three ways using `parentId` and `children`:

  | Case | Result |
  |---|---|
  | Spec node with no `id` | `create`, carrying its index path in the Spec |
  | Desired parent or sibling order differs from base, live matches base | `move` |
  | Live parent or order differs from base, desired matches base | `drift` |
  | Both differ and disagree | `conflict` |
  | Id in base, absent from Spec, live node unchanged | `remove` |
  | Id in base, absent from Spec, live node changed since base | `conflict` |
  | Id in base, absent from Spec, already gone from Figma | converged |
  | Id in Spec, gone from Figma | `missing`, treated as a conflict |
  | Node in Figma, in neither base nor Spec (added by hand) | left alone; reported as `drift`; sibling positions are computed against live children |
  | Any edit to an OpaqueNode other than its parent or position | error naming the node |
  | Any operation on an id containing `;` | error |

- An update that lists `width` or `height` alone is completed with the other dimension from live, because the resize branches need both (`node-tree.ts` ~lines 178, 327, 353).
- Returns `{planId, counts, operations (max 100), truncated, drift, conflicts}`. Writes nothing to Figma or disk.
- Verification: one test per row of both tables; reorder of siblings yields `move` only and no `update` on the parent; a text edit under a HUG parent yields one `update` and no drift on ancestors; an expired `planId` is an error, never an empty plan. Live done-when (covers 11b too): pull a real frame of 200+ nodes containing auto-layout, instances and at least one group; `plan_spec` on the untouched file reports zero operations and zero drift; then change one text string and one fill, and the Plan lists exactly two updates. Size ~380.

#### PR 11d. `apply_spec`
- Tool `apply_spec {planId, allowRemovals = false, onConflict = "skip"}`. It re-reads the Spec and refuses if its hash is not the one the Plan recorded. `onConflict: "spec"` is the only way to overwrite a conflicting property and must be passed explicitly. Before sending, it writes `pendingApply: planId` to the SpecLock.
- Plugin command `apply_spec_ops {rootId, expect, operations, expectedHashes, allowRemovals, commandId}`. The staleness check happens **inside the plugin**, in the same run as the writes: before any write it recomputes `propsHash` and `children` for every node the operations touch and refuses the whole run if any differs from `expectedHashes`. A check made in a separate round trip leaves a gap.
- It calls `figma.commitUndo()` before and after. Order of work:
  1. Creates, parents before children, through `createNode` with `onBindFailure: "keep"`; each returns `{path, id}`.
  2. Updates, through `resolveAndBind` and `updateNodeProperties` with `only` set to the listed properties.
  3. Moves. Per parent, walk the desired order `i = 0..n-1` over the nodes the Spec knows and call `insertChild(i', node)` only when the live child at that position is not that node, where `i'` accounts for hand-added nodes left in place; then read `children` back and assert the order. A reparent keeps absolute position the same way removals do. Moving a non-frame into a SECTION is refused by `appendOrInsertChild` (`utils.ts` ~line 512) and is reported, not retried.
  4. Removals, last, into `l2f/superseded`.
  One operation failing is recorded and the rest continue.
- After the run the plugin re-reads the **whole subtree**, not only the touched nodes, because a text edit resizes HUG ancestors and reflows siblings. A touched property whose live value is not the desired value is reported under `partial` (the silent-resize case from PR 10).
- The server then re-checks the Spec hash (the model may have edited the file during the run; if so it stops and says to pull), writes created ids into the Spec by index path, writes the Spec, then rewrites the SpecLock from the read-back and clears `pendingApply`. Properties reported `partial` or failed keep their old base value, so the next plan shows them again. If the command timed out or the plugin reloaded, `pendingApply` stays set and the next `plan_spec` refuses until a pull.
- Result: `{applied: {created, updated, moved, removed}, skipped, partial, failed, undo}`. `undo` says one undo in Figma reverts the apply and anything done by hand while it ran. The tool never calls `triggerUndo`.
- Verification, mocked `figma`: only listed properties are assigned; a text update on a Roboto Bold node leaves `fontName` alone; a fill update on a node with a variable-bound stroke leaves the stroke binding; ids of all pre-existing nodes are unchanged; apply followed by `plan_spec` yields zero operations and zero drift, including after a text edit under a HUG parent; a create whose earlier sibling failed still gets the right id; a hash changed between plan and apply refuses with nothing written; wrong `fileName` or `pageId` refuses; a removal without `allowRemovals` is skipped; a removal with it lands in `l2f/superseded` at the same absolute position, including out of a section and for a node with a rotated OpaqueNode child, and nothing calls `remove()`; a hand-added sibling keeps its place through a reorder; an OpaqueNode's subtree is untouched after a move; a resize the mock ignores is reported `partial`; a simulated timeout leaves `pendingApply` set and the next plan refuses. Live done-when: on a real frame, change two strings, one fill and one sibling order in the Spec; apply; node ids before and after are identical (`snapshot_positions` and `diff_positions` from PR 10 show only the moved sibling and expected reflow); one undo in Figma restores the original. Size ~420.

**Not in v1 (candidates for a later PR).** Refreshing only the nodes the event stream says changed, instead of a full pull. Taking drift into the Spec without a full pull. Components and component sets as editable frames. Rotation, per-corner radii, multiple and non-solid paints, and non-pixel line height in the format. INSTANCE_SWAP properties (they take a component node id, not a key). A `core` tool profile that registers only these three tools plus screenshots for edit-only sessions.

### PR 12. Dev Mode
Item 9. Annotations are untouched.
- **`set_dev_status {nodeIds, status}`**, with `status` `{type:"READY_FOR_DEV"|"COMPLETED", description?}` or `null`. A node is validated with `"devStatus" in node` (sections and the frame family; only nodes directly under a page or section qualify). A throw because an ancestor already has a status is caught per node and returned as `skipped` with the reason.
- **`get_dev_resources`, `add_dev_resource {nodeId, url, name?}`.** `getDevResourcesAsync` includes inherited resources, so the duplicate check compares only resources whose `nodeId` equals the target. Duplicate gives `already present`, since `addDevResourceAsync` fails on a duplicate url.
- **Status and resources work in the design editor**; only measurements are Dev-only.
- **Measurements `add_measurement {startNodeId, startSide, endNodeId, endSide, offset?}`, `get_measurements {nodeId?}`.** These use `MeasurementsMixin` on the page (`figma.currentPage.addMeasurement`), so they act on the current page only: both nodes are resolved and rejected if not on it. Sides must be on the same axis (validated in Zod and again in the plugin). `offset` is `{type:"INNER", relative}` or `{type:"OUTER", fixed}`. They refuse unless `figma.editorType === "dev"`. The `dev` manifest capability is UNCONFIRMED (PR 1 live check).
Done-when: a frame marked ready for dev with the link from `get_prototype_links` (PR 5). Verification: mocks for status skip reasons, inherited-resource duplicates, off-page rejection, cross-axis rejection, mocked `editorType` for the Dev-only gate. Size ~300.

### PR 13. Slides and Buzz
Item 10. Manifest editor types already landed in PR 1. Plugin new `slides.ts`: `get_slide_grid` and `set_slide_order` use `getCanvasGrid` / `setCanvasGrid` (`SceneNode[][]`; Slides and Buzz); `create_slides {slides:[{name}], row?}` uses `createSlide` / `createSlideRow` (Slides only). Buzz gets grid read and reorder only. `setCanvasGrid` must include every existing node, so the tool validates set-equality with the current grid before writing and lists missing or extra ids. `create_slides` matches existing slides by name first (rerun safe). Deprecated `getSlideGrid` / `setSlideGrid` are not used. Verification: mocked `getCanvasGrid` / `setCanvasGrid` round trip, the set-equality rejection, `createSlide` refused under mocked `buzz` and `figma` editors, `getCanvasGrid` allowed under `buzz`. Live: a deck with named slides in a set order. Size ~240.

### PR 14. TextPath, then flag removal
`create_text_path {vectorId, startSegment, startPosition, characters?, textNodeId?}` calls `figma.createTextPath(vector, startSegment, startPosition)`. Given `textNodeId`, it copies characters and font from that text node; fonts load through the shared font loader first. Validates the target is a VECTOR. Then, in the same PR, delete `flags.ts`, the env checks and the `plugin.json` env block, register everything unconditionally, bump the plugin version, and update the Roadmap rows where they live (Open question 3). A feature without a recorded live check stays flagged. Verification: mocked vector; live on a circle; after removal, the full `test:unit` run. Size ~190 (90 + 100 net).

## Frontend and backend impact

| Area | Backend (MCP server) | Frontend (plugin) |
|---|---|---|
| Comments (PR 3) | New REST path, Keychain reader | No change |
| Comment pins (PR 4) | Calls plugin once | One read-only command |
| File key (PR 2) | Channel key map, merge | `fileKey` in document info |
| Manifest, flags (PR 1) | Env flags, plugin.json env | Manifest edits, editor-type gate |
| Spec sync (PR 11a to 11d) | File read and write, Plan store, three-way comparison | Export, hash and apply commands; refactor of `node-tree.ts` |
| Everything else | Zod tool and types | Command and dispatcher case |
| Relay `src/socket.ts` | No change in any PR | n/a |

## Out of scope (pull in later if wanted)

- Motion (`figma.motion`, timelines, spring easing in reactions), shaders, video export and video fills.
- Extended variable collections (Enterprise only).
- Grid in the `create_node_tree` spec and `parse_wireframe`.
- Moving the existing library tools off `FIGMA_API_TOKEN` env onto the Keychain.
- Prototype device size (not in the plugin API).
- Resolving or deleting comments, creating new comment threads.
- Figma's "suggest auto layout" and any delete-and-recreate helper (both in the wiki's "Not proposed").
- Stale `claude_to_figma` paths in `docs/Architecture.md` and `docs/Plugin-Development.md` (pre-existing).

## Workflow status

Steps 1 to 3 of the feature-change workflow are done: architecture read, plan written, backend and frontend reviews folded in below. Step 4, user confirmation, is done (2026-11-12).

Spec sync (PRs 11a to 11d) was added afterwards at the user's request. Its backend and frontend reviews are done and folded in (see the spec-sync tables under Review findings). The user asked for it to be added but has not yet confirmed the reviewed version; no spec-sync code is written until they do.

## Review findings

Backend reviewer:

| # | Finding | Result |
|---|---|---|
| Merge | Consolidate to ~12 PRs (3+5, 6+7, 8+9+10, 11+12, 14+16, 15 stays, 17+18, 19+20, 21 into 22) | Applied: 14 PRs, SLOT split out per the coordinator. The count is 14 rather than 12 because comment pin context (PR 4) and verify B (PR 11) stay separate |
| Flags | Server-side env flags only; separate `L2F_COMMENTS_WRITE`; `L2F_ALL` excludes it | Applied |
| Flags | Env pass-through for the plugin install, test both launch paths | Applied (PR 1) |
| Flags | Additive fields: strip or state ungated, per case | Applied (per-case list in Flag mechanism) |
| Manifest | State `enablePrivatePluginApi` is ungated; fold three manifest edits into PR 1 | Applied |
| Bundles | Regenerate only at merge; bump plugin version per milestone; "plugin re-import required" text | Applied |
| 1 | Validate `fileKey` and `commentId`, encode both | Applied (PR 3, PR 2) |
| 2 | Pin lookup only when channel file key matches; null context on absent plugin, several files, timeout; only FrameOffset kinds carry `node_id` | Applied (PR 3, PR 4) |
| 3 | Flags in the plugin install | Applied (PR 1) |
| 4 | `batch_mutate` resize still silent | Applied: read-back extended there (PR 10), existing keys kept |
| 5 | Keychain timeout, newline trim, fetch timeout, 429, 403, drop `since` UNCONFIRMED | Applied (PR 3) |
| 6 | Reply resolves to root, untrusted-text label, description says reply on explicit request | Applied (PR 3) |
| 10 | Tests: path validation, file mismatch, spawn timeout, 429, gated-off server with new plugin shapes | Applied (PR 1, 3, 4) |

Frontend reviewer:

| # | Finding | Result |
|---|---|---|
| 1 | `assert_contained` expected map, grew flag, null box, rotation, tolerance, shadows | Applied (PR 10) |
| 2 | `audit_paints` gradients, images, styles, mixed text, per-index | Applied (PR 11) |
| 3 | `audit_structure` stroke-weight and `Frame \d+` cluster checks | Applied (PR 11) |
| 4 | Measurement page scope, same-axis, offset shapes, editor gate, `dev` capability | Applied (PR 1, 12); `dev` capability stays UNCONFIRMED pending live check |
| 5 | DevStatus validation and skips, inherited resources, status works in design editor | Applied (PR 12) |
| 6 | Slides API split by editor, set-equality, Buzz scope, drop UNCONFIRMED | Applied (PR 13); the Buzz live-account question is dropped because the scope is now grid read and reorder only |
| 8 | Read-back cause reporting; mock ignoring height | Applied (PR 10) |
| 9 | Grid track entries mutated in place; grid-frame binding error | Applied (PR 9, 7) |
| 10 | SLOT wiring, `cannotSetSlotProperty`, out of bind done-when, delete as a choice | Applied (PR 8); user chose to add `delete_component_property` (PR 7) |
| 11 | Dev-linked plugin has no `fileKey`; done-when via `fileKeySource: "user"` | Applied (PR 2) |
| 12 | Flows: whole assignment, solid-only background, deleted-target round trip | Applied (PR 5) |
| 13 | Extend plugin mock per PR, mocked editor type per gated command | Applied (Rules) |
| 14 | Snapshot store lost on reload gives "snapshot expired" | Applied (PR 10) |

Not applied: none. Two items were adjusted rather than copied: the PR count (14, not 12, for the reason above), and the Slides Buzz question, which the narrower scope settled.

Spec sync, backend reviewer (2026-11-12):

| # | Finding | Result |
|---|---|---|
| 1 | A property-level difference cannot be computed from hashes alone | Applied: the SpecLock stores normalised properties, parent and child order |
| 2 | Apply can run against a duplicated file, where node ids are identical | Applied: `expect {fileKey, fileName, pageId}` on every plugin command; depends on PR 2. Limit stated: no file key and an identically named copy is not detected |
| 3 | A timed-out apply leaves created nodes unrecorded, so the next plan creates them again | Applied: `pendingApply` marker, explicit 120 s timeout, progress updates |
| 4 | Child order inside the node hash, and derived geometry, give false drift | Applied: order kept apart from `propsHash`; omission list; whole subtree re-locked after apply |
| 5 | Three-way table incomplete | Applied: structure table added (hand-added nodes, duplicate and unknown ids, remove against drift, already gone, truncated regions) |
| 6 | `updateNodeProperties` cannot take a partial list; text key is `text`; `createNode` calls `remove()` | Applied (PR 11a `only` and `onBindFailure`; paired dimension filled from live in 11c) |
| 7 | `ReferenceCache` caps are too small for a Plan | Applied: separate `PlanStore` |
| 8 | File safety: parent symlinks, absolute paths, temp file location, `L2F_SPEC_DIR` in both launch paths, hash over content, write order | Applied |
| 9 | 11b's live check needed 11c; SpecLock version field; flag registry and test | Applied |
| 10 | Stale check and apply in separate round trips leave a gap | Applied: checked inside the plugin run |

Spec sync, frontend reviewer (2026-11-12):

| # | Finding | Result |
|---|---|---|
| 1 | Lifted update code writes fonts, paints and effects whether or not they changed | Applied: `only` parameter with a spy test per branch (PR 11a) |
| 2 | Variable binding is outside `updateNodeProperties` | Applied: `resolveAndBind` lifted (PR 11a) |
| 3 | Created ids cannot be mapped back after a failure; `remove()` on bind failure | Applied: index paths; `onBindFailure: "keep"` |
| 4, 5 | Layout-derived values and library updates cause phantom drift | Applied: omission list, rotated nodes opaque, instance as leaf, defaults parity test, full re-lock |
| 6 | Round-trip gaps (path data, stroke cap, line height, font size, mixed values, instance property keys, local components) | Applied: omission list, `componentId`, flattened keys. Not added to the format in v1: per-corner radii, INSTANCE_SWAP (listed under "Not in v1") |
| 7 | Instance children cannot be operated on | Applied: leaf rule, ids with `;` rejected |
| 8 | Move index semantics, absolute position on reparent, superseded frame, sections, page loading | Applied (PR 11d) |
| 9 | `commitUndo` brackets the run but includes hand edits made during it | Applied: wording in the result; no `triggerUndo` |
| 10 | Closure state beyond counters; `createNode` and `syncNode` are mutually recursive | Applied (PR 11a) |
| 11 | Export cost at 2,000 nodes | Applied: per-run caches, conditional `getStyledTextSegments` |

Not applied: none. One change of design beyond the findings: the comparison is per property rather than per node, which the stored base properties make possible and which keeps more hand edits.

## Decisions (2026-11-12)

- **Base branch:** the stack bases on `feat/llm2figma-efficiency`.
- **Docs:** `docs/` is tracked.
- **Delete tools:** `delete_component_property` only (PR 7, dry run by default). Flows and dev status are still cleared with `set_flows([])` and `null`.
- **Figma token:** in the macOS Keychain (service `llm2figma`, account `figma-api-token`) for every REST call, including the existing library tools (PR 1b). Never in a shell profile or `.mcp.json`.
- **Defaults taken, change any time:** grid cells addressed by row and column index; add the `dev` editor type in PR 1 only if the live check needs it.

## Open questions

- **Install type.** Private org plugin or local dev plugin only? Decides whether `fileKeySource: "plugin"` is ever possible (PR 2 works either way).
