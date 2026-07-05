import type {
  InstrumentationFieldValue,
  InstrumentationPacket,
  InstrumentationRecord,
} from "../types.js";

export interface InstrumentationRecordInput<Payload> {
  strategyPoint: string;
  intent: string;
  recordType: string;
  targetId?: string;
  title?: string;
  fields: Record<string, InstrumentationFieldValue>;
  payload: Payload;
}

// 创建通用 instrumentation packet。
export function createInstrumentationPacket<Summary>(
  strategyId: string,
  intent: string,
  summary: Summary,
  records: InstrumentationRecord[],
): InstrumentationPacket<Summary> {
  return { strategyId, intent, summary, records };
}

// 创建通用 instrumentation record。
export function createInstrumentationRecord<Payload>(
  input: InstrumentationRecordInput<Payload>,
): InstrumentationRecord {
  return input;
}

// 统计满足条件的条目数量。
export function countBy<Item>(items: Item[], predicate: (item: Item) => boolean): number {
  return items.filter(predicate).length;
}

// 计算数值数组的平均值。
export function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
