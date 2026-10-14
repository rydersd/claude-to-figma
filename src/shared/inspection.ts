export interface InspectionOptions {
  maxNodes?: number;
  maxDepth?: number;
  maxTextLength?: number;
  fields?: string[];
}

/** Bound a REST node tree before filtering/serialization; root depth is zero. */
export function boundNodeTree(root: any, options: InspectionOptions = {}) {
  const maxNodes = Math.min(1000, Math.max(1, options.maxNodes ?? 100));
  const maxDepth = Math.min(50, Math.max(0, options.maxDepth ?? 2));
  const maxTextLength = Math.min(10000, Math.max(1, options.maxTextLength ?? 2000));
  const includeChildren = !options.fields?.length || options.fields.includes("children");
  let returnedNodes = 0;
  let truncated = false;
  function visit(node: any, depth: number): any {
    returnedNodes++;
    const result = { ...node };
    if ((!options.fields?.length || options.fields.includes("characters")) && typeof result.characters === "string" && result.characters.length > maxTextLength) {
      result.characters = result.characters.slice(0, maxTextLength);
      truncated = true;
    }
    delete result.children;
    if (includeChildren && Array.isArray(node.children)) {
      result.children = [];
      if (depth >= maxDepth) {
        if (node.children.length) truncated = true;
      } else {
        for (const child of node.children) {
          if (returnedNodes >= maxNodes) { truncated = true; break; }
          result.children.push(visit(child, depth + 1));
        }
      }
    }
    return result;
  }
  return {
    node: visit(root, 0),
    inspection: { returnedNodes, truncated, maxNodes, maxDepth, maxTextLength },
  };
}
