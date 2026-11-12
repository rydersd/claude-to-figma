# Dev Mode (L2F_DEV_MODE)

Tags: dev-mode, editor-gate, figma

Gotchas behind `set_dev_status`, `get_dev_resources`, `add_dev_resource`, `add_measurement` and `get_measurements`. Tool reference: [Tools-Prototyping-and-Annotations](../../docs/Tools-Prototyping-and-Annotations.md#dev-mode-status-resources-measurements).

## Dev Mode is read-only, with exceptions

The editor gate (`src/llm2figma_plugin/src/editor-gate.ts`) refuses every command not marked read-only when `figma.editorType === "dev"`. Dev status, dev resources and measurements are the writes Figma allows there, so they are declared per command in `COMMAND_EDITORS` rather than added to `READ_ONLY`: status and resources run in `figma` and `dev`, measurements in `dev` only. `addMeasurement` exists only in Dev Mode, so the plugin function also checks the editor itself.

## The manifest must declare Dev Mode

Without `"dev"` in `editorType` the plugin cannot be launched in Dev Mode at all, so the Dev-only tools would be unreachable. The manifest declares `"dev"` with `"capabilities": ["inspect"]` (the plugin runs in the Inspect panel there). UNCONFIRMED until the live check: that `inspect` is the right capability and that the design editor is unaffected. Changing the manifest needs a remove and re-import of the plugin; a reload keeps the old manifest.

## Inherited dev resources

`getDevResourcesAsync` returns links inherited from a main component or component set as well as the node's own. `addDevResourceAsync` fails on a duplicate url, so `add_dev_resource` checks only resources whose `nodeId` is the target and returns `already present` for those. An inherited link with the same url is not treated as a duplicate.

## DevStatus placement

Only nodes directly under a page or section hold a status, and Figma throws when an ancestor section already has one. `set_dev_status` checks the parent itself and catches the throw per node, so one bad node does not stop the rest.

## Measurements act on the current page

They are a `PageNode` method (`figma.currentPage.addMeasurement`), so both nodes must be on the current page; a node elsewhere is refused rather than silently measured against the wrong page. Sides must share an axis (`LEFT`/`RIGHT` or `TOP`/`BOTTOM`).

## Link validation without `URL`

The plugin validates `https:` links with a pattern, not `new URL()`, because the plugin sandbox has no `URL` (`typeof URL` is `"undefined"`, checked live 2026-11-12 in the design editor). The server applies the same pattern and also parses with `URL`, so a link the server accepts is one the plugin accepts.
