import type { RepairPatch } from "../interfaces/repairPatch.js";

const PRIORITY_RANK: Record<RepairPatch["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function sanitizeRepairPatches(
  patches: RepairPatch[],
  _context: { currentHtml?: string; previousHtml?: string }
): RepairPatch[] {
  const normalized = patches
    .map((patch) => ({
      ...patch,
      target: patch.target.trim(),
      change: patch.change.trim(),
    }))
    .filter((patch) => patch.target !== "" && patch.change !== "");

  return normalized
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .slice(0, 10);
}
