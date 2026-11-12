// Bounded depth-first walk over a node tree, shared by the plugin and the server.
// The walk stops at maxNodes or maxDepth and says so in `truncated`; it never
// drops nodes silently. Root depth is zero. `truncatedParents` names every
// visited node whose child list was cut off (by the depth limit, or by the node
// budget running out before all of its children were visited), so a caller can
// tell "this node has no more children" from "the walk stopped looking".

export interface WalkOptions {
  maxNodes?: number;
  maxDepth?: number;
}

export interface WalkResult<N = unknown> {
  visited: number;
  truncated: boolean;
  // Visited nodes whose children were not all visited, each listed once.
  truncatedParents: N[];
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
): WalkResult<N> {
  const maxNodes = Math.min(WALK_LIMITS.maxNodes, Math.max(1, Math.floor(options.maxNodes ?? WALK_LIMITS.defaultNodes)));
  const maxDepth = Math.min(WALK_LIMITS.maxDepth, Math.max(0, Math.floor(options.maxDepth ?? WALK_LIMITS.defaultDepth)));
  let visited = 0;
  let truncated = false;
  const cutOff = new Set<N>();
  // Explicit stack keeps pre-order without recursion limits on deep trees.
  const stack: Array<{ node: N; depth: number; parent: N | null }> = [{ node: root, depth: 0, parent: null }];
  while (stack.length) {
    if (visited >= maxNodes) {
      truncated = true;
      // Every node still queued is an unvisited child of its parent.
      for (const pending of stack) if (pending.parent !== null) cutOff.add(pending.parent);
      break;
    }
    const { node, depth, parent } = stack.pop()!;
    visited++;
    if (visit(node, depth, parent) === false) continue;
    const children = getChildren(node);
    if (!children || !children.length) continue;
    if (depth >= maxDepth) { truncated = true; cutOff.add(node); continue; }
    for (let i = children.length - 1; i >= 0; i--) stack.push({ node: children[i], depth: depth + 1, parent: node });
  }
  return { visited, truncated, truncatedParents: [...cutOff], maxNodes, maxDepth };
}
