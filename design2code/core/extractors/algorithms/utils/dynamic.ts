export function quantizeSize(val: number): number {
  if (val < 50) {
    // 小元素 (Icon, Badge): 高精度，2px 容错
    return Math.round(val / 2) * 2;
  } else if (val < 200) {
    // 中元素 (Button, Avatar): 中等精度，5px 容错
    return Math.round(val / 5) * 5;
  } else {
    // 大元素 (Card, Image): 低精度，10px 容错
    return Math.round(val / 10) * 10;
  }
}

export function isZeroPadding(padding: string): boolean {
  const [t, r, b, l] = parsePadding(padding);
  return t === 0 && r === 0 && b === 0 && l === 0;
}

export function mergePadding(parentPadding?: string, childPadding?: string): string | undefined {
  const [pt, pr, pb, pl] = parsePadding(parentPadding);
  const [ct, cr, cb, cl] = parsePadding(childPadding);
  const t = pt + ct;
  const r = pr + cr;
  const b = pb + cb;
  const l = pl + cl;
  return `${t}px ${r}px ${b}px ${l}px`;
}

function parsePadding(padding?: string): [number, number, number, number] {
  if (!padding) return [0, 0, 0, 0];
  const parts = padding
    .trim()
    .split(/\s+/)
    .map((value) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    });

  if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
  if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
  if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]];
  return [parts[0], parts[1], parts[2], parts[3]];
}
