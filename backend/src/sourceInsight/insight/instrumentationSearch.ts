import type {
  InstrumentationPacket,
  InstrumentationRecord,
  InstrumentationSearchGroup,
  InstrumentationSearchResult,
  InstrumentationStrategyPointDirectory,
} from '@codify/contracts'

interface ReadPointOptions {
  query?: string
  limit?: number
  offset?: number
}

// 第一步只返回 strategy -> strategyPoint 目录，不返回具体记录。
export function listInstrumentationStrategyPoints(
  packets: InstrumentationPacket[],
): InstrumentationStrategyPointDirectory[] {
  const directories = new Map<string, InstrumentationStrategyPointDirectory>()

  packets.forEach((packet) => {
    packet.records.forEach((record) => {
      const key = `${packet.strategyId}:${record.strategyPoint}`
      if (directories.has(key)) return

      directories.set(key, {
        strategyId: packet.strategyId,
        strategyPoint: record.strategyPoint,
        intent: record.intent,
      })
    })
  })

  return [...directories.values()].sort((a, b) => {
    if (a.strategyId !== b.strategyId) return a.strategyId.localeCompare(b.strategyId)
    return a.strategyPoint.localeCompare(b.strategyPoint)
  })
}

// 第二步按某个 strategyPoint 小步读取固定数量的缩略记录。
export function readInstrumentationStrategyPoint(
  packets: InstrumentationPacket[],
  strategyId: string,
  strategyPoint: string,
  options: ReadPointOptions = {},
): InstrumentationSearchGroup {
  const terms = options.query ? normalize(options.query).split(' ').filter(Boolean) : []
  const limit = options.limit ?? 5
  const offset = options.offset ?? 0
  const records: InstrumentationSearchResult[] = []

  packets.forEach((packet, packetIndex) => {
    if (packet.strategyId !== strategyId) return

    packet.records.forEach((record, recordIndex) => {
      if (record.strategyPoint !== strategyPoint) return

      const result = terms.length > 0
        ? scoreRecord(packet, record, terms, packetIndex, recordIndex)
        : toSearchResult(record, 0, packetIndex, recordIndex)
      if (terms.length > 0 && result.score <= 0) return
      records.push(result)
    })
  })

  const sorted = records.sort((a, b) => b.score - a.score)
  return {
    strategyId,
    strategyPoint,
    records: sorted.slice(offset, offset + limit),
    totalMatches: sorted.length,
    offset,
    nextOffset: offset + limit < sorted.length ? offset + limit : null,
  }
}

// 对单条记录按关键词命中情况打分。
function scoreRecord(
  packet: InstrumentationPacket,
  record: InstrumentationRecord,
  terms: string[],
  packetIndex: number,
  recordIndex: number,
): InstrumentationSearchResult {
  const text = normalize([
    packet.strategyId,
    packet.intent,
    record.strategyPoint,
    record.intent,
    record.recordType,
    record.targetId,
    record.title,
    ...Object.keys(record.fields),
    ...Object.values(record.fields).map(String),
  ].join(' '))

  const score = terms.reduce((sum, term) => {
    if (text === term) return sum + 8
    if (text.includes(term)) return sum + 3
    return sum
  }, 0)

  return toSearchResult(record, score, packetIndex, recordIndex)
}

// 把内部记录转换为对外缩略搜索结果。
function toSearchResult(
  record: InstrumentationRecord,
  score: number,
  packetIndex: number,
  recordIndex: number,
): InstrumentationSearchResult {
  return {
    recordType: record.recordType,
    score,
    title: record.title,
    targetId: record.targetId,
    fields: record.fields,
    recordRef: {
      packetIndex,
      recordIndex,
    },
  }
}

// 归一化文本用于关键词匹配。
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5_.-]+/g, ' ').trim()
}
