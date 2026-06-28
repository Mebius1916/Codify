import type { GraphStats } from "@colbymchenry/codegraph";

export function formatCodeGraphStats(stats: GraphStats): string {
  return [
    `Indexed files: ${stats.fileCount}`,
    `Indexed nodes: ${stats.nodeCount}`,
    `Indexed edges: ${stats.edgeCount}`,
    `Languages: ${formatRecord(stats.filesByLanguage)}`,
    `Node kinds: ${formatRecord(stats.nodesByKind)}`,
    `Edge kinds: ${formatRecord(stats.edgesByKind)}`,
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
