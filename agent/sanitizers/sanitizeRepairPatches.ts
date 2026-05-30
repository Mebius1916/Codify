import type { RepairPlanGroup } from "../interfaces/repairPatch.js";

const PRIORITY_RANK: Record<RepairPlanGroup["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function sanitizeRepairPlanGroups(
  groups: RepairPlanGroup[],
  _context: { currentHtml?: string; previousHtml?: string }
): RepairPlanGroup[] {
  const normalized = groups
    .map((group) => ({
      ...group,
      dataIds: group.dataIds.map((dataId) => dataId.trim()).filter(Boolean),
      change: group.change
        .map((item) => ({
          dataId: item.dataId.trim(),
          action: item.action.trim(),
        }))
        .filter((item) => item.dataId && item.action),
    }))
    .filter((group) => group.dataIds.length >= 2 && group.change.length > 0);

  return normalized
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .slice(0, 10);
}
