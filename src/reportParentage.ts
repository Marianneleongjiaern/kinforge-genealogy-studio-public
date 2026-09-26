import type { AppState } from "./domain";
import type { Parentage } from "./reportOptions";

export const PARENTAGE_LABELS: Record<Parentage, string> = {
  unspecified: "Not recorded", biological: "Biological", adoptive: "Adoptive", foster: "Foster", step: "Step-parent"
};

export function reportParentageState(state: AppState, parentage?: "all" | Parentage): AppState {
  if (!parentage || parentage === "all") return state;
  const relationships = state.relationships.filter(r => r.type !== "parent-child" || (r.parentage || "unspecified") === parentage);
  return { ...state, relationships, families: state.families.map(f => ({ ...f,
    childIds: f.childIds.filter(id => relationships.some(r => r.type === "parent-child" && r.treeId === f.treeId && r.toId === id && f.partnerIds.includes(r.fromId)))
  })) };
}
