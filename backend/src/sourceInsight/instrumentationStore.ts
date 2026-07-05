import {
  listInstrumentationStrategyPoints,
  readInstrumentationStrategyPoint,
  type InstrumentationPacket,
  type InstrumentationSearchGroup,
  type InstrumentationStrategyPointDirectory,
} from '@codify/converters'
import { appDatabase } from '../database/appDatabase.ts'
import type { FigmaNodeRef } from '../conversion/types.ts'

interface PacketJsonRow {
  packet_json: string
}

interface ReadPointOptions {
  query?: string
  limit?: number
  offset?: number
}

// 按 fileKey+nodeId+strategyId 逐策略写入或更新，每个策略单独成行。
export function upsertInstrumentationPackets(
  nodeRef: FigmaNodeRef,
  packets: InstrumentationPacket[],
): void {
  const statement = appDatabase.prepare(`
    INSERT INTO instrumentation_packets (
      figma_file_key,
      figma_node_id,
      strategy_id,
      packet_json
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(figma_file_key, figma_node_id, strategy_id) DO UPDATE SET
      packet_json = excluded.packet_json,
      updated_at = CURRENT_TIMESTAMP
  `)

  for (const packet of packets) {
    statement.run(nodeRef.fileKey, nodeRef.nodeId, packet.strategyId, JSON.stringify(packet))
  }
}

// 判定该节点是否落库过任何策略记录，供 agent 是否启用 instrumentation 检索使用。
export function hasInstrumentationPackets(nodeRef: FigmaNodeRef): boolean {
  const row = appDatabase
    .prepare(`
      SELECT 1
      FROM instrumentation_packets
      WHERE figma_file_key = ? AND figma_node_id = ?
      LIMIT 1
    `)
    .get(nodeRef.fileKey, nodeRef.nodeId)

  return Boolean(row)
}

// 只读取该节点全部策略的目录（strategy -> strategyPoint），不返回具体记录。
export function listNodeStrategyPoints(
  nodeRef: FigmaNodeRef,
): InstrumentationStrategyPointDirectory[] {
  return listInstrumentationStrategyPoints(readAllPackets(nodeRef))
}

// 按需只查该节点的单个策略行，再对其记录分页返回缩略结果。
export function readNodeStrategyPoint(
  nodeRef: FigmaNodeRef,
  strategyId: string,
  strategyPoint: string,
  options: ReadPointOptions = {},
): InstrumentationSearchGroup {
  return readInstrumentationStrategyPoint(
    readStrategyPackets(nodeRef, strategyId),
    strategyId,
    strategyPoint,
    options,
  )
}

// 读取该节点某个策略的行（正常只有一行），反序列化为 packet 数组。
function readStrategyPackets(nodeRef: FigmaNodeRef, strategyId: string): InstrumentationPacket[] {
  const rows = appDatabase
    .prepare(`
      SELECT packet_json
      FROM instrumentation_packets
      WHERE figma_file_key = ? AND figma_node_id = ? AND strategy_id = ?
    `)
    .all(nodeRef.fileKey, nodeRef.nodeId, strategyId) as unknown as PacketJsonRow[]

  return rows.map((row) => JSON.parse(row.packet_json) as InstrumentationPacket)
}

// 读取该节点全部策略行，仅用于生成目录，不进入 agent 上下文。
function readAllPackets(nodeRef: FigmaNodeRef): InstrumentationPacket[] {
  const rows = appDatabase
    .prepare(`
      SELECT packet_json
      FROM instrumentation_packets
      WHERE figma_file_key = ? AND figma_node_id = ?
    `)
    .all(nodeRef.fileKey, nodeRef.nodeId) as unknown as PacketJsonRow[]

  return rows.map((row) => JSON.parse(row.packet_json) as InstrumentationPacket)
}
