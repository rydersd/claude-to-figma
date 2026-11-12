// Bounded depth-first walk over a node tree, shared by the plugin and the server.
// The walk stops at maxNodes or maxDepth and says so in `truncated`; it never
// drops nodes silently. Root depth is zero.

export interface WalkOptions {
  maxNodes?: number;
  maxDepth?: number;
}

export interface WalkResult {
  visited: number;
  truncated: boolean;
  maxNodes: number;
  maxDepth: number;
}

export const WALK_LIMITS = { defaultNodes: 2000, maxNodes: 10000, defaultDepth: 30, maxDepth: 100 };

// `visit` returns false to skip a node's children (for example an instance
// treated as a leaf); skipped children do not count as truncation.
export function walkTree<N>(
  root: N,
  visit: (node: N, depth: number, parent: N | null) => boolean | void,
  options: WalkOptions = {},
  getChildren: (node: N) => readonly N[] | undefined = (node: any) => node && node.children,
): WalkResult {
  const maxNodes = Math.min(WALK_LIMITS.maxNodes, Math.max(1, Math.floor(options.maxNodes ?? WALK_LIMITS.defaultNodes)));
  const maxDepth = Math.min(WALK_LIMITS.maxDepth, Math.max(0, Math.floor(options.maxDepth ?? WALK_LIMITS.defaultDepth)));
  let visited = 0;
  let truncated = false;
  // Explicit stack keeps pre-order without recursion limits on deep trees.
  const stack: Array<{ node: N; depth: number; parent: N | null }> = [{ node: root, depth: 0, parent: null }];
  while (stack.length) {
    if (visited >= maxNodes) { truncated = true; break; }
    const { node, depth, parent } = stack.pop()!;
    visited++;
    if (visit(node, depth, parent) === false) continue;
    const children = getChildren(node);
    if (!children || !children.length) continue;
    if (depth >= maxDepth) { truncated = true; continue; }
    for (let i = children.length - 1; i >= 0; i--) stack.push({ node: children[i], depth: depth + 1, parent: node });
  }
  return { visited, truncated, maxNodes, maxDepth };
}
