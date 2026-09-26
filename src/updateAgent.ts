type AgentSignal = {
  id: string;
  type: string;
  createdAt: string;
  detail?: Record<string, string | number | boolean>;
};

const KEY = "kinforge-monthly-update-agent-v1";
const maxSignals = 500;

function readSignals(): AgentSignal[] {
  try {
    const value = localStorage.getItem(KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.type === "string" && typeof item.createdAt === "string") : [];
  } catch {
    return [];
  }
}

function writeSignals(signals: AgentSignal[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(signals.slice(-maxSignals)));
  } catch {
    /* Full local storage should not interrupt genealogy work. */
  }
}

export function recordUpdateAgentSignal(type: string, detail: AgentSignal["detail"] = {}) {
  const safeDetail = Object.fromEntries(Object.entries(detail).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))) as AgentSignal["detail"];
  writeSignals([...readSignals(), { id: crypto.randomUUID(), type, detail: safeDetail, createdAt: new Date().toISOString() }]);
}

export function internalMonthlyUpdateBrief() {
  const signals = readSignals();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const recent = signals.filter(signal => signal.createdAt >= since);
  const counts = recent.reduce<Record<string, number>>((all, signal) => ({ ...all, [signal.type]: (all[signal.type] || 0) + 1 }), {});
  return {
    generatedAt: new Date().toISOString(),
    purpose: "Internal planning input only. Do not show this SWOT brief in the main app screen.",
    competitors: ["MacFamilyTree", "MyHeritage", "Ancestry", "Gramps Web", "RootsMagic", "Family Historian", "Family Tree Maker", "Heredis"],
    monthlyChecks: [
      "Look for genealogy competitor changes in charts, reports, source handling, photos, privacy, collaboration, mobile UX and publishing.",
      "Turn repeated local friction signals into bug fixes or accessibility improvements.",
      "Prefer user-owned export/import/sync features over locked-in workflows.",
      "Keep sensitive genealogy, government, medical, protection and family records private by default."
    ],
    signalCounts: counts
  };
}
