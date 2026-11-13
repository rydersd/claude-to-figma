# Dev Mode (L2F_DEV_MODE)

Tags: dev-mode, editor-gate, figma

Gotchas behind `set_dev_status`, `get_dev_resources`, `add_dev_resource`, `add_measurement` and `get_measurements`. Tool reference: [Tools-Prototyping-and-Annotations](../../docs/Tools-Prototyping-and-Annotations.md#dev-mode-status-resources-measurements).

## Dev Mode is read-only; which writes it allows is partly unconfirmed

The editor gate (`src/llm2figma_plugin/src/editor-gate.ts`) refuses every command not marked read-only when `figma.editorType === "dev"`. The Dev Mode tools are declared per command in `COMMAND_EDITORS` rather than added to `READ_ONLY`: status, resources and `get_measurements` run in `figma` and `dev`, `add_measurement` in `dev` only. What is sourced: the plugin typings mark `addMeasurement` as Dev Mode only (so the plugin function also checks the editor itself), and `getMeasurements` carries no such note. Figma's Dev Mode guide calls Dev Mode read-only with pluginData, relaunchData and `exportAsync` as the exceptions and does not mention `devStatus` or dev resources, so whether those writes succeed in Dev Mode is a live check, not documented. `COMMAND_EDITORS` is read with an own-key check so `constructor` or `toString` are not mistaken for entries.

## The manifest must declare Dev Mode

Without `"dev"` in `editorType` the plugin cannot be launched in Dev Mode at all, so the Dev-only tools would be unreachable. The manifest declares `"dev"` with `"capabilities": ["inspect"]` (the plugin runs in the Inspect panel there). Figma's manifest docs mark `"editorType": ["figjam", "dev"]` as unsupported, so `figjam` was dropped: FigJam is not supported for now. The editor gate still lists `figjam`, which is harmless. The docs say nothing on `slides` or `buzz` with `dev`, nor on `inspect` in a plugin that also runs in the design editor. UNCONFIRMED until the live check: that `inspect` is the right capability and that the design editor is unaffected. Changing the manifest needs a remove and re-import of the plugin; a reload keeps the old manifest.

## Inherited dev resources

`getDevResourcesAsync` returns links inherited from a main component or component set as well as the node's own. The docs do not say whether an inherited one reports the main component's `nodeId` or the instance's, so the node's own are those with `nodeId` equal to the target **and** no `inheritedNodeId`, in the duplicate check and in the read-back. Urls are compared with scheme and host lowercased and a trailing slash ignored (`src/shared/dev-resource.ts`). `addDevResourceAsync` fails on a duplicate url; when it throws, the plugin re-reads and returns `already present` if the link is there, and passes the error on otherwise.

## DevStatus placement

Only nodes directly under a page or section hold a status, and Figma throws when an ancestor section already has one. `set_dev_status` checks the parent itself and catches the throw per node, so one bad node does not stop the rest.

## Measurements act on the current page

They are a `PageNode` method (`figma.currentPage.addMeasurement`), so both nodes must be on the current page; a node elsewhere is refused rather than silently measured against the wrong page. Sides must share an axis (`LEFT`/`RIGHT` or `TOP`/`BOTTOM`).

## Link validation without `URL`

The plugin validates `https:` links with a pattern, not `new URL()`, because the plugin sandbox has no `URL` (`typeof URL` is `"undefined"`, checked live 2026-11-12 in the design editor). Plugin and server share the pattern in `src/shared/dev-resource.ts`: non-empty DNS labels, port 1 to 65535, path of printable ASCII without backslash (`[!-\[\]-~]*`). The server then sends `new URL(v).href` only when it is the same link (case of scheme and host and a trailing slash aside); anything URL rewrites otherwise (`..`, `:443`, `<` percent-encoded) is refused, so the plugin only ever receives a link both readings agree on.

## Untrusted text

Node names, resource names and urls, measurement `freeText` and page names come from the file. The plugin cuts each to 200 characters and the server adds an `untrustedText` note to every Dev Mode result.
