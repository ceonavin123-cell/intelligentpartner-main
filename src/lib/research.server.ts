import { AGENTS, type AgentKey } from "@/lib/agents";
import { aiChat, type AIProvider } from "@/lib/ai-providers";

export async function callAI(opts: {
  system: string;
  user: string;
  model?: string;
  json?: boolean;
  provider?: AIProvider;
}) {
  const content = await aiChat(
    [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    { provider: opts.provider, model: opts.model },
  );
  return content || "";
}

export type ResearchBundle = {
  websiteMarkdown: string;
  websiteSummary: string;
  searchResults: Array<{ url: string; title: string; description: string; markdown?: string }>;
};

export async function researchCompany(opts: {
  name: string;
  website?: string | null;
}): Promise<ResearchBundle> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY missing");
  const { default: Firecrawl } = await import("@mendable/firecrawl-js");
  const fc = new Firecrawl({ apiKey: key });

  let websiteMarkdown = "";
  let websiteSummary = "";
  if (opts.website) {
    try {
      const scraped: any = await fc.scrape(opts.website, {
        formats: ["markdown", "summary"],
        onlyMainContent: true,
      });
      websiteMarkdown = scraped?.markdown ?? scraped?.data?.markdown ?? "";
      websiteSummary = scraped?.summary ?? scraped?.data?.summary ?? "";
    } catch (e) {
      console.error("[research] scrape failed", e);
    }
  }

  let searchResults: ResearchBundle["searchResults"] = [];
  try {
    const q = `${opts.name} company financials operations tax`;
    const search: any = await fc.search(q, { limit: 6 });
    const items = search?.web ?? search?.data ?? [];
    searchResults = (Array.isArray(items) ? items : []).slice(0, 6).map((r: any) => ({
      url: r.url,
      title: r.title ?? "",
      description: r.description ?? r.snippet ?? "",
      markdown: r.markdown,
    }));
  } catch (e) {
    console.error("[research] search failed", e);
  }

  return { websiteMarkdown, websiteSummary, searchResults };
}

export async function runAgentAssessment(opts: {
  agent: AgentKey;
  companyName: string;
  website?: string | null;
  research: ResearchBundle;
}): Promise<{ summary: string; findings: any; risk_score: number }> {
  const a = AGENTS[opts.agent];
  const sourcesText = [
    opts.research.websiteSummary && `WEBSITE SUMMARY:\n${opts.research.websiteSummary}`,
    opts.research.websiteMarkdown &&
      `WEBSITE CONTENT (truncated):\n${opts.research.websiteMarkdown.slice(0, 6000)}`,
    opts.research.searchResults.length &&
      `WEB SEARCH RESULTS:\n${opts.research.searchResults
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.description}`)
        .join("\n\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const system = `${a.prompt}\n\nReturn STRICT JSON with shape: {"summary": string, "risk_score": number (0-100), "findings": {"strengths": string[], "risks": string[], "opportunities": string[], "key_questions": string[]}}`;
  const user = `Company: ${opts.companyName}\nWebsite: ${opts.website ?? "n/a"}\n\nSOURCES:\n${sourcesText || "(no sources available — base assessment on the name and general industry knowledge, and flag low confidence)"}\n\nProduce the assessment now.`;

  const content = await callAI({ system, user, json: true });
  try {
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary ?? "",
      findings: parsed.findings ?? {},
      risk_score: Number(parsed.risk_score ?? 50),
    };
  } catch {
    return { summary: content, findings: {}, risk_score: 50 };
  }
}
