export type RepairActionType = "plan" | "rewrite";

export interface RepairAction {
  type: RepairActionType;
  reason: string;
}
