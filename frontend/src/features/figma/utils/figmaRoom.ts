export interface FigmaRoomRef {
  roomId: string
  fileKey: string
  nodeId: string
  fileSlug: string
}

export function parseFigmaRoomUrl(figmaUrl: string): FigmaRoomRef {
  const parsed = new URL(figmaUrl)
  const pathMatch = parsed.pathname.match(/\/(?:file|design)\/([a-zA-Z0-9]+)(?:\/([^/?#]+))?/)
  if (!pathMatch) {
    throw new Error('无法从 Figma 链接中提取房间号')
  }

  const nodeId = parsed.searchParams.get('node-id')
  if (!nodeId) {
    throw new Error('Figma 链接缺少 node-id，无法生成房间号')
  }

  const fileKey = pathMatch[1]
  const normalizedNodeId = nodeId.replace(/:/g, '-')

  return {
    roomId: `${fileKey}--${normalizedNodeId}`,
    fileKey,
    nodeId: normalizedNodeId,
    fileSlug: pathMatch[2] ? decodeURIComponent(pathMatch[2]) : fileKey,
  }
}
