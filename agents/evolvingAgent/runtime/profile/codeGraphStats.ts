import type { GraphStats } from "@colbymchenry/codegraph";

export function formatCodeGraphStats(stats: GraphStats): string {
  return [
    `已索引文件数: ${stats.fileCount}`,
    `已索引节点数: ${stats.nodeCount}`,
    `已索引边数: ${stats.edgeCount}`,
    `语言分布: ${formatRecord(stats.filesByLanguage)}`,
    `节点类型分布: ${formatRecord(stats.nodesByKind)}`,
    `边类型分布: ${formatRecord(stats.edgesByKind)}`,
  ].join("\n");
}

function formatRecord(record: Record<string, number>): string {
  return Object.entries(record)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([key, count]) => `${key}=${count}`)
    .join(", ");
}
