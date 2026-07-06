import codeGraphPackage, {
  type CodeGraph as UpstreamCodeGraphInstance,
} from "@colbymchenry/codegraph";

const { CodeGraph } = codeGraphPackage;

// 打开或初始化 CodeGraph，并在索引为空或过期时自动重建。
export async function createReadyCodeGraph(
  repoRoot: string,
): Promise<UpstreamCodeGraphInstance> {
  const graph = CodeGraph.isInitialized(repoRoot)
    ? await CodeGraph.open(repoRoot, { sync: true })
    : await CodeGraph.init(repoRoot, { index: false });

  if (graph.getStats().fileCount === 0 || graph.isIndexStale()) {
    await graph.indexAll();
  }

  return graph;
}
