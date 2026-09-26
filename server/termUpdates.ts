export type TermFeedEnv = {
  TERM_FEED_URLS?: string;
};

export type TermFeedEntry = {
  id: string;
  term: string;
  meaning: string;
  category: string;
  aliases: string[];
  sourceUrls: string[];
  sourceTitle: string;
  reviewed: boolean;
  updatedAt: string;
};

const curatedTerms: TermFeedEntry[] = [
  {
    id: "genealogy-collateral-line",
    term: "Collateral line",
    meaning: "A family line connected through someone other than a direct ancestor or descendant, such as an aunt, uncle, cousin, or sibling line.",
    category: "Genealogy methods",
    aliases: ["Collateral relative", "Collateral branch"],
    sourceUrls: ["https://www.familysearch.org/en/wiki/Genealogical_Terms"],
    sourceTitle: "FamilySearch Wiki genealogical terms",
    reviewed: true,
    updatedAt: "2026-09-26"
  },
  {
    id: "genealogy-affinity",
    term: "Affinity",
    meaning: "A relationship created through marriage or partnership rather than shared ancestry. In everyday genealogy notes, this often means an in-law connection.",
    category: "Families and relationships",
    aliases: ["Relationship by marriage"],
    sourceUrls: ["https://www.familysearch.org/en/wiki/Genealogical_Terms"],
    sourceTitle: "FamilySearch Wiki genealogical terms",
    reviewed: true,
    updatedAt: "2026-09-26"
  },
  {
    id: "genealogy-consanguinity",
    term: "Consanguinity",
    meaning: "A relationship by shared ancestry or bloodline. It is different from an in-law or affinity relationship.",
    category: "Families and relationships",
    aliases: ["Blood relationship", "Relationship by blood"],
    sourceUrls: ["https://www.familysearch.org/en/wiki/Genealogical_Terms"],
    sourceTitle: "FamilySearch Wiki genealogical terms",
    reviewed: true,
    updatedAt: "2026-09-26"
  },
  {
    id: "genealogy-filiation",
    term: "Filiation",
    meaning: "The recorded parent-child connection or descent of a person from a parent. A record may state filiation without proving every biological detail.",
    category: "Genealogy methods",
    aliases: ["Parent-child descent"],
    sourceUrls: ["https://www.familysearch.org/en/wiki/Genealogical_Terms"],
    sourceTitle: "FamilySearch Wiki genealogical terms",
    reviewed: true,
    updatedAt: "2026-09-26"
  },
  {
    id: "genealogy-informant",
    term: "Informant",
    meaning: "The person who supplied information for a record, such as a birth, marriage, or death certificate. Their knowledge and accuracy can vary.",
    category: "Records and evidence",
    aliases: ["Record informant"],
    sourceUrls: ["https://www.archives.gov/research/genealogy"],
    sourceTitle: "National Archives genealogy research",
    reviewed: true,
    updatedAt: "2026-09-26"
  },
  {
    id: "genealogy-negative-evidence",
    term: "Negative evidence",
    meaning: "A conclusion drawn from the absence of an expected record or detail, after checking sources where it should reasonably appear.",
    category: "Records and evidence",
    aliases: ["Evidence from absence"],
    sourceUrls: ["https://www.ngsgenealogy.org/"],
    sourceTitle: "National Genealogical Society context",
    reviewed: true,
    updatedAt: "2026-09-26"
  },
  {
    id: "genealogy-fan-club",
    term: "FAN club",
    meaning: "A research method that studies a person's friends, associates, and neighbours to solve family-history questions.",
    category: "Genealogy methods",
    aliases: ["Friends associates neighbours", "Cluster genealogy"],
    sourceUrls: ["https://www.archives.gov/research/genealogy"],
    sourceTitle: "National Archives genealogy research",
    reviewed: true,
    updatedAt: "2026-09-26"
  },
  {
    id: "genealogy-endogamy",
    term: "Endogamy",
    meaning: "Marriage or partnering within the same community or group over many generations, which can make DNA relationship estimates look closer than they are.",
    category: "DNA and relationships",
    aliases: ["Endogamous community"],
    sourceUrls: ["https://isogg.org/wiki/Endogamy"],
    sourceTitle: "ISOGG Wiki endogamy context",
    reviewed: true,
    updatedAt: "2026-09-26"
  },
  {
    id: "genealogy-pedigree-collapse",
    term: "Pedigree collapse",
    meaning: "When the same person appears in more than one place in someone's ancestry because relatives had children together in earlier generations.",
    category: "DNA and relationships",
    aliases: ["Ancestor collapse"],
    sourceUrls: ["https://isogg.org/wiki/Pedigree_collapse"],
    sourceTitle: "ISOGG Wiki pedigree collapse context",
    reviewed: true,
    updatedAt: "2026-09-26"
  },
  {
    id: "genealogy-apostille",
    term: "Apostille",
    meaning: "A certificate attached to a document so it can be recognised in another country under the apostille convention. It authenticates the document process, not the truth of every family-history statement inside.",
    category: "Records and evidence",
    aliases: ["Apostilled record"],
    sourceUrls: ["https://www.hcch.net/en/instruments/conventions/specialised-sections/apostille"],
    sourceTitle: "HCCH Apostille Section",
    reviewed: true,
    updatedAt: "2026-09-26"
  }
];

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

function sanitizeTerm(item: unknown): TermFeedEntry | null {
  if (!item || typeof item !== "object") return null;
  const value = item as Partial<TermFeedEntry>;
  const term = String(value.term || "").trim();
  const meaning = String(value.meaning || "").trim();
  const category = String(value.category || "Web-discovered terms").trim();
  if (!term || !meaning || term.length > 120 || meaning.length > 900 || category.length > 80) return null;
  const aliases = Array.isArray(value.aliases) ? value.aliases.map(alias => String(alias).trim()).filter(Boolean).slice(0, 12) : [];
  const sourceUrls = Array.isArray(value.sourceUrls) ? value.sourceUrls.map(url => String(url).trim()).filter(url => /^https:\/\//.test(url)).slice(0, 6) : [];
  return {
    id: String(value.id || `web-${term.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`).slice(0, 120),
    term,
    meaning,
    category,
    aliases,
    sourceUrls,
    sourceTitle: String(value.sourceTitle || "External genealogy term feed").slice(0, 180),
    reviewed: value.reviewed === true,
    updatedAt: /^\d{4}-\d{2}-\d{2}/.test(String(value.updatedAt || "")) ? String(value.updatedAt) : new Date().toISOString().slice(0, 10)
  };
}

async function externalTerms(env: TermFeedEnv): Promise<TermFeedEntry[]> {
  const urls = (env.TERM_FEED_URLS || "").split(",").map(url => url.trim()).filter(url => /^https:\/\//.test(url)).slice(0, 5);
  const results: TermFeedEntry[] = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!response.ok || Number(response.headers.get("content-length") || "0") > 500000) continue;
      const data = await response.json() as { terms?: unknown[] } | unknown[];
      const terms = Array.isArray(data) ? data : Array.isArray(data?.terms) ? data.terms : [];
      for (const item of terms) {
        const safe = sanitizeTerm(item);
        if (safe) results.push({ ...safe, reviewed: false });
      }
    } catch {
      /* External feeds are optional; app updates should still work offline. */
    }
  }
  return results;
}

export async function termRoutes(request: Request, env: TermFeedEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/terms/latest" && url.pathname !== "/api/terms/latest/") return null;
  if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed." }, 405);
  const external = request.method === "HEAD" ? [] : await externalTerms(env);
  const byId = new Map([...curatedTerms, ...external].map(term => [term.id, term]));
  return json(request.method === "HEAD" ? null : {
    version: "2026.09.26",
    checkedAt: new Date().toISOString(),
    policy: "KinForge checks trusted web-fed genealogy term sources. Reviewed terms can update the app glossary; unreviewed external terms require review and do not modify private family libraries.",
    terms: [...byId.values()].sort((a, b) => a.term.localeCompare(b.term, "en"))
  });
}
