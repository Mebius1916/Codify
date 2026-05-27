import type { RepairPatch } from "../interfaces/repairPatch.js";

export function sanitizeRepairPatches(
  patches: RepairPatch[],
  _context: { currentHtml?: string; previousHtml?: string }
): RepairPatch[] {
  return patches
    .map((patch) => ({
      ...patch,
      category: patch.category.trim(),
      target: patch.target.trim(),
      change: patch.change.trim(),
      reason: patch.reason.trim(),
    }))
    .filter(
      (patch) =>
        patch.category !== "" &&
        patch.target !== "" &&
        patch.change !== "" &&
        patch.reason !== ""
    );
}
