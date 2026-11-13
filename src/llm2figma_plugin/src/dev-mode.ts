// Dev Mode (L2F_DEV_MODE): DevStatus, DevResource, Measurement.
// Status, resources and reading measurements work in the design editor and in Dev Mode;
// adding a measurement only in Dev Mode (see editor-gate.ts, and requireDevEditor below).
import { MAX_URL_LENGTH, capText, matchesHttpsUrl, sameUrl } from "../../shared/dev-resource";

export { MAX_URL_LENGTH };
export const MAX_LIST = 100;
export const MAX_NAME_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 1000;

const STATUS_TYPES = ["READY_FOR_DEV", "COMPLETED"];
const SIDES = ["TOP", "RIGHT", "BOTTOM", "LEFT"];
const HORIZONTAL = ["LEFT", "RIGHT"];

// https only, with the rule in src/shared/dev-resource.ts. A pattern, so it does not
// depend on the sandbox providing URL; the server applies the same rule.
export function isHttpsUrl(url: unknown): url is string {
  return matchesHttpsUrl(url);
}

export function sameAxis(startSide: string, endSide: string): boolean {
  return HORIZONTAL.includes(startSide) === HORIZONTAL.includes(endSide);
}

async function requireNode(nodeId: string): Promise<any> {
  const node: any = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);
  return node;
}

// --- DevStatus ---

function validStatus(status: any): boolean {
  if (status === null) return true;
  if (!status || typeof status !== "object" || !STATUS_TYPES.includes(status.type)) return false;
  return status.description === undefined ||
    (typeof status.description === "string" && status.description.length <= MAX_DESCRIPTION_LENGTH);
}

export async function setDevStatus(params: { nodeIds: string[]; status: { type: string; description?: string } | null }) {
  const { nodeIds, status } = params;
  if (!Array.isArray(nodeIds) || nodeIds.length === 0 || nodeIds.length > MAX_LIST) {
    throw new Error(`nodeIds must list 1 to ${MAX_LIST} node ids`);
  }
  if (status === undefined || !validStatus(status)) {
    throw new Error(`status must be null or { type: "READY_FOR_DEV" | "COMPLETED", description? } (description up to ${MAX_DESCRIPTION_LENGTH} characters)`);
  }
  const value = status === null ? null : { type: status.type, ...(status.description !== undefined ? { description: status.description } : {}) };
  const results = [];
  for (const nodeId of nodeIds) {
    const node: any = await figma.getNodeByIdAsync(nodeId);
    if (!node) { results.push({ nodeId, result: "skipped", reason: "node not found" }); continue; }
    if (!("devStatus" in node)) {
      results.push({ nodeId, name: capText(node.name), result: "skipped", reason: `${node.type} has no dev status (sections and frames only)` });
      continue;
    }
    const parent = node.parent;
    if (!parent || (parent.type !== "PAGE" && parent.type !== "SECTION")) {
      results.push({ nodeId, name: capText(node.name), result: "skipped", reason: `not directly under a page or section (inside ${parent ? `${parent.type} ${parent.id}` : "nothing"})` });
      continue;
    }
    try {
      node.devStatus = value;
    } catch (error) {
      // For example: an ancestor section already has a status.
      results.push({ nodeId, name: capText(node.name), result: "skipped", reason: capText(error instanceof Error ? error.message : String(error)) });
      continue;
    }
    const devStatus = node.devStatus ?? null;
    results.push({ nodeId, name: capText(node.name), result: "set", devStatus: devStatus && devStatus.description !== undefined ? { ...devStatus, description: capText(devStatus.description) } : devStatus });
  }
  return {
    set: results.filter((r) => r.result === "set").length,
    skipped: results.filter((r) => r.result === "skipped").length,
    results,
  };
}

// --- DevResource ---

function resourceSummary(resource: any) {
  return {
    name: capText(resource.name),
    url: capText(resource.url),
    nodeId: resource.nodeId,
    ...(resource.inheritedNodeId ? { inheritedNodeId: resource.inheritedNodeId } : {}),
  };
}

export async function getDevResources(params: { nodeId: string; includeChildren?: boolean }) {
  const node = await requireNode(params.nodeId);
  if (typeof node.getDevResourcesAsync !== "function") throw new Error(`${node.type} ${node.id} has no dev resources`);
  const all: any[] = await node.getDevResourcesAsync({ includeChildren: params.includeChildren === true });
  return {
    nodeId: node.id,
    name: capText(node.name),
    count: all.length,
    resources: all.slice(0, MAX_LIST).map(resourceSummary),
    truncated: all.length > MAX_LIST,
  };
}

export async function addDevResource(params: { nodeId: string; url: string; name?: string }) {
  const { url } = params;
  if (!isHttpsUrl(url)) {
    throw new Error(`url must be an https link (https:// and a host, no spaces, up to ${MAX_URL_LENGTH} characters)`);
  }
  const name = params.name === undefined ? undefined : String(params.name).trim();
  if (name !== undefined && (name.length === 0 || name.length > MAX_NAME_LENGTH)) {
    throw new Error(`name must be 1 to ${MAX_NAME_LENGTH} characters`);
  }
  const node = await requireNode(params.nodeId);
  if (typeof node.addDevResourceAsync !== "function") throw new Error(`${node.type} ${node.id} cannot hold dev resources`);
  // getDevResourcesAsync includes resources inherited from a main component or set.
  // Those carry inheritedNodeId, and their nodeId may be the main component's or this
  // node's, so only a resource with this nodeId and no inheritedNodeId is the node's own.
  // Links are compared with scheme and host lowercased and a trailing slash ignored.
  const findOwn = async () => (await node.getDevResourcesAsync()).find(
    (r: any) => r.nodeId === node.id && !r.inheritedNodeId && typeof r.url === "string" && sameUrl(r.url, url),
  );
  const existing = await findOwn();
  if (existing) return { nodeId: node.id, result: "already present", resource: resourceSummary(existing) };
  try {
    await node.addDevResourceAsync(url, name);
  } catch (error) {
    // Figma fails on a url the node already has, which may compare differently from
    // the check above (or have been added in between): report it when it is there.
    const present = await findOwn();
    if (present) return { nodeId: node.id, result: "already present", resource: resourceSummary(present) };
    throw error;
  }
  const added = await findOwn();
  return { nodeId: node.id, result: "added", resource: resourceSummary(added ?? { name: name ?? null, url, nodeId: node.id }) };
}

// --- Measurement ---

function requireDevEditor(command: string) {
  if (figma.editorType !== "dev") throw new Error(`${command} is only available in Dev Mode (editor: ${figma.editorType})`);
}

function pageOf(node: any): any {
  let current = node;
  while (current && current.type !== "PAGE") current = current.parent;
  return current || null;
}

async function requireOnCurrentPage(nodeId: string, role: string): Promise<any> {
  const node = await requireNode(nodeId);
  if (node.type === "PAGE" || node.type === "DOCUMENT") throw new Error(`${role} ${nodeId} is a ${node.type}, not a layer`);
  const page = pageOf(node);
  if (!page || page.id !== figma.currentPage.id) {
    throw new Error(`${role} ${nodeId} is not on the current page (${capText(figma.currentPage.name)}); measurements act on the current page only`);
  }
  return node;
}

function measurementSummary(m: any) {
  return {
    id: m.id,
    start: { nodeId: m.start.node.id, nodeName: capText(m.start.node.name), side: m.start.side },
    end: { nodeId: m.end.node.id, nodeName: capText(m.end.node.name), side: m.end.side },
    offset: m.offset,
    freeText: capText(m.freeText),
  };
}

function validOffset(offset: any): boolean {
  if (offset === undefined) return true;
  if (!offset || typeof offset !== "object") return false;
  if (offset.type === "INNER") return Number.isFinite(offset.relative);
  if (offset.type === "OUTER") return Number.isFinite(offset.fixed);
  return false;
}

export async function addMeasurement(params: {
  startNodeId: string; startSide: string; endNodeId: string; endSide: string;
  offset?: { type: "INNER"; relative: number } | { type: "OUTER"; fixed: number };
}) {
  requireDevEditor("add_measurement");
  const { startSide, endSide, offset } = params;
  if (!SIDES.includes(startSide) || !SIDES.includes(endSide)) throw new Error("startSide and endSide must be TOP, RIGHT, BOTTOM or LEFT");
  if (!sameAxis(startSide, endSide)) {
    throw new Error(`startSide ${startSide} and endSide ${endSide} are on different axes: use LEFT/RIGHT with LEFT/RIGHT, or TOP/BOTTOM with TOP/BOTTOM`);
  }
  if (!validOffset(offset)) throw new Error('offset must be { type: "INNER", relative: number } or { type: "OUTER", fixed: number }');
  const start = await requireOnCurrentPage(params.startNodeId, "startNodeId");
  const end = await requireOnCurrentPage(params.endNodeId, "endNodeId");
  const measurement = figma.currentPage.addMeasurement(
    { node: start, side: startSide as MeasurementSide },
    { node: end, side: endSide as MeasurementSide },
    offset ? { offset } : undefined,
  );
  return measurementSummary(measurement);
}

// Reading needs no Dev Mode: the typings mark only addMeasurement (and editing or
// deleting one) as Dev Mode only.
export async function getMeasurements(params: { nodeId?: string }) {
  const page = figma.currentPage;
  const all = params && params.nodeId
    ? page.getMeasurementsForNode(await requireOnCurrentPage(params.nodeId, "nodeId"))
    : page.getMeasurements();
  return {
    pageId: page.id,
    pageName: capText(page.name),
    count: all.length,
    measurements: all.slice(0, MAX_LIST).map(measurementSummary),
    truncated: all.length > MAX_LIST,
  };
}
