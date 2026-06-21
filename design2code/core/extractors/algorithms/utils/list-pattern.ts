import type { SimplifiedNode } from "../../../types/extractor-types.js";
import { createVirtualFrame } from "./virtual-node.js";
import { buildContainerByGap } from "./layout-inference.js";

const MAX_GAP_STEP = 4;

type PatternMatch = {
  loopItems: SimplifiedNode[];
  consumed: number;
  effectiveItems: number;
  gapStep: number;
  length: number;
};

// 查找最佳重复模式
export function groupRepeatedPatterns(
  nodes: SimplifiedNode[],
): SimplifiedNode[] {
  const result: SimplifiedNode[] = [];
  let i = 0;
  // 匹配分组，会一直分组直到处理完整个节点列表
  while (i < nodes.length) {
    const picked = bestPatternAt(nodes, i);

    if (picked) {
      flushRun(picked.loopItems, result);
      i += picked.consumed; // 跳过已处理的节点
    } else {
      result.push(nodes[i]);
      i++;
    }
  }

  return result;
}

// 在指定起点尝试不同长度与策略，选择最优重复模式
function bestPatternAt(
  nodes: SimplifiedNode[],
  start: number,
): PatternMatch | null {
  let best: PatternMatch | null = null;
  // 一组最长元素，不能超过剩余节点的一半，确保至少有两段可比
  const maxK = Math.floor((nodes.length - start) / 2);

  for (const allowGap of [false, true]) {
    // 查找最优的单组长度
    for (let k = 1; k <= maxK; k++) {
      const match = detectPattern(nodes, start, k, allowGap);
      if (!match) continue;
      if (!best || isBetterMatch(match, best)) {
        best = match;
      }
    }
  }

  return best;
}

// 根据传入的单组长度，计算出能分成几组
function detectPattern(
  nodes: SimplifiedNode[],
  start: number,
  length: number, // 步长
  allowGap: boolean,
): PatternMatch | null {
  if (start + length > nodes.length) return null;
  // 分组
  const loopItems: SimplifiedNode[] = [];

  const addChunk = (fromIndex: number) => {
    if (length === 1) {
      loopItems.push(nodes[fromIndex]);
      return;
    }
    const chunk = nodes.slice(fromIndex, fromIndex + length);
    loopItems.push(createVirtualGroup(chunk));
  };

  // 断裂的元素
  const addGapItems = (fromIndex: number, gap: number) => {
    for (let g = 0; g < gap; g++) {
      loopItems.push(nodes[fromIndex + g]);
    }
  };

  addChunk(start);
  let count = 1;
  let gapStep = 0;
  let p = start + length;

  while (p + length <= nodes.length) {
    // 连续重复情况
    if (signaturesMatch(nodes, start, p, length)) {
      addChunk(p);
      count++;
      p += length;
      continue;
    }

    // 断裂重复情况
    if (!allowGap) break;

    // 断裂间隔上限：不超过步长、不越界且不超过全局阈值
    const maxGap = Math.min(length, nodes.length - p - length, MAX_GAP_STEP);
    if (maxGap < 1) break;

    const startGap = gapStep > 0 ? gapStep : 1;
    const endGap = gapStep > 0 ? Math.min(gapStep, maxGap) : maxGap;
    let matched = false;
    for (let gap = startGap; gap <= endGap; gap++) {
      if (!signaturesMatch(nodes, start, p + gap, length)) continue;
      addGapItems(p, gap);
      if (gapStep === 0) gapStep = gap;
      p += gap;
      addChunk(p);
      count++;
      p += length;
      matched = true;
      break;
    }
    if (!matched) break;
  }

  if (count < 2) return null;
  const effectiveItems = count * length;
  const consumed = p - start;

  return { loopItems, consumed, effectiveItems, gapStep, length };
}

// 比较两个匹配结果，优先选择更有效率的
function isBetterMatch(next: PatternMatch, best: PatternMatch): boolean {
  if (next.effectiveItems !== best.effectiveItems) {
    return next.effectiveItems > best.effectiveItems;
  }
  if (next.gapStep !== best.gapStep) {
    return next.gapStep < best.gapStep;
  }
  if (next.length !== best.length) {
    return next.length < best.length;
  }
  return false;
}

// 比较两个片段在指纹层面是否完全一致
function signaturesMatch(
  nodes: SimplifiedNode[],
  start1: number,
  start2: number,
  length: number,
): boolean {
  for (let j = 0; j < length; j++) {
    if (
      nodes[start1 + j].visualSignature !== nodes[start2 + j].visualSignature
    ) {
      return false;
    }
  }
  return true;
}

function createVirtualGroup(children: SimplifiedNode[]): SimplifiedNode {
  return createVirtualFrame({
    idPrefix: "virtual-list-pattern",
    name: "Item Group",
    type: "CONTAINER",
    layout: {
      mode: "none",
      sizing: {},
      position: "static",
    },
    children: children,
    visualSignature: children.map(c => c.visualSignature).join("+")
  });
}

// 节点分组
function flushRun(run: SimplifiedNode[], result: SimplifiedNode[]) {
  if (run.length < 2) {
    result.push(...run);
    return;
  }

  const first = run[0];
  const second = run[1];
  const dy = Math.abs((first.absRect?.y || 0) - (second.absRect?.y || 0));
  const dx = Math.abs((first.absRect?.x || 0) - (second.absRect?.x || 0));
  const isVertical = dy > dx;

  const listNode = createVirtualList(run, isVertical);
  result.push(listNode);
}

function createVirtualList(children: SimplifiedNode[], isVertical: boolean): SimplifiedNode {
  return buildContainerByGap({
    name: "List",
    idPrefix: "virtual-list",
    children,
    direction: isVertical ? "column" : "row",
    semanticTag: "list",
  });
}
