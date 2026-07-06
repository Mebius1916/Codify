import type {
  BuildContextOptions,
  CodeGraph as UpstreamCodeGraphInstance,
  Edge,
  Node,
} from "@colbymchenry/codegraph";

type GraphInput = { graph: UpstreamCodeGraphInstance };


export async function buildCodeGraphContext(
  input: GraphInput & {
    query: string;
    maxNodes: number;
    maxCodeBlocks: number;
    maxCodeBlockSize: number;
  },
): Promise<string> {
  const options: BuildContextOptions = {
    format: "markdown",
    includeCode: true,
    maxNodes: input.maxNodes,
    maxCodeBlocks: input.maxCodeBlocks,
    maxCodeBlockSize: input.maxCodeBlockSize,
    traversalDepth: 2,
    searchLimit: 8,
  };
  const codeContext = await input.graph.buildContext(input.query, options);
  return typeof codeContext === "string"
    ? codeContext
    : JSON.stringify(codeContext, null, 2);
}

export async function inspectCodeGraphNode(
  input: GraphInput & { nodeId: string },
): Promise<{
  node: Node;
  code: string | null;
  callers: Array<{ name: string; filePath: string; line: number }>;
  callees: Array<{ name: string; filePath: string; line: number }>;
  usages: Array<{
    name: string;
    filePath: string;
    line: number;
    edgeKind: string;
  }>;
} | null> {
  const node = input.graph.getNode(input.nodeId);
  if (!node) return null;
  return {
    node,
    code: await input.graph.getCode(input.nodeId),
    callers: input.graph
      .getCallers(input.nodeId, 1)
      .map(({ node }: { node: Node }) => formatRelatedNode(node)),
    callees: input.graph
      .getCallees(input.nodeId, 1)
      .map(({ node }: { node: Node }) => formatRelatedNode(node)),
    usages: input.graph
      .findUsages(input.nodeId)
      .map(({ node, edge }: { node: Node; edge: Edge }) => ({
        ...formatRelatedNode(node),
        edgeKind: edge.kind,
      })),
  };
}

function formatRelatedNode(node: Node): {
  name: string;
  filePath: string;
  line: number;
} {
  return {
    name: node.qualifiedName || node.name,
    filePath: node.filePath,
    line: node.startLine,
  };
}
