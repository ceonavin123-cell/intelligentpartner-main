import { callAI } from "./research.server";

export type ScrapedJob = {
  title: string;
  company: string;
  email?: string;
  website?: string;
  address?: string;
  salary?: string;
  source_url: string;
  source: string;
};

const CATEGORIES = [
  "accounting",
  "finance",
  "operations",
  "management consultant",
  "business automation",
];

export async function scrapeJobs(): Promise<ScrapedJob[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY missing");
  const { default: Firecrawl } = await import("@mendable/firecrawl-js");
  const fc = new Firecrawl({ apiKey: key });

  type Snippet = { source: string; url: string; title: string; description: string };
  const snippets: Snippet[] = [];

  // Search per category per site to maximize hit-rate
  const queries: { source: string; q: string }[] = [];
  for (const cat of CATEGORIES) {
    queries.push({ source: "Merojob", q: `site:merojob.com ${cat} jobs Nepal` });
    queries.push({ source: "JobsNepal", q: `site:jobsnepal.com ${cat} jobs` });
  }

  await Promise.all(
    queries.map(async ({ source, q }) => {
      try {
        const r: any = await fc.search(q, { limit: 5 });
        const items = r?.web ?? r?.data ?? r?.results ?? [];
        for (const it of Array.isArray(items) ? items : []) {
          const url = it.url ?? it.link;
          if (!url) continue;
          snippets.push({
            source,
            url,
            title: it.title ?? "",
            description: it.description ?? it.snippet ?? "",
          });
        }
      } catch (e) {
        console.error("[jobs] search failed", source, q, (e as any)?.message);
      }
    }),
  );

  console.log(`[jobs] collected ${snippets.length} snippets from search`);

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = snippets.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });

  // Scrape top postings for richer details (limit to keep within timeout)
  const toScrape = unique.slice(0, 18);
  const scraped: { source: string; url: string; markdown: string }[] = [];
  await Promise.all(
    toScrape.map(async (s) => {
      try {
        const r: any = await fc.scrape(s.url, {
          formats: ["markdown"],
          onlyMainContent: true,
        });
        const md = r?.markdown ?? r?.data?.markdown ?? "";
        if (md) scraped.push({ source: s.source, url: s.url, markdown: md.slice(0, 4000) });
      } catch (e) {
        console.error("[jobs] scrape failed", s.url, (e as any)?.message);
      }
    }),
  );

  console.log(`[jobs] scraped ${scraped.length} postings`);

  // Build corpus combining snippet titles + scraped content
  const corpusParts: string[] = [];
  for (const s of unique) {
    corpusParts.push(
      `### LISTING [${s.source}]\nTITLE: ${s.title}\nURL: ${s.url}\nSNIPPET: ${s.description}`,
    );
  }
  for (const p of scraped) {
    corpusParts.push(`### POSTING [${p.source}]\nURL: ${p.url}\nCONTENT:\n${p.markdown}`);
  }
  const corpus = corpusParts.join("\n\n---\n\n");

  if (!corpus) return [];

  const system = `You extract job postings from scraped data of Nepali job boards (Merojob, JobsNepal).
Return STRICT JSON: {"jobs": [{"title": string, "company": string, "email": string|null, "website": string|null, "address": string|null, "salary": string|null, "source_url": string, "source": "Merojob"|"JobsNepal"}]}.

Rules:
- Return AS MANY relevant jobs as you can find, up to 30.
- Be INCLUSIVE — include any job that plausibly relates to: accounting, finance, audit, bookkeeping, operations, supply chain, logistics, management, consulting, business analyst, process automation, ERP, RPA, digital transformation.
- If a listing has only a title and URL but the title matches the categories, INCLUDE it (use null for unknown fields).
- Never invent emails, salaries, or addresses — use null when unknown.
- source_url must be the URL given to you.
- source = "Merojob" if URL contains merojob.com, "JobsNepal" if jobsnepal.com.
- Do NOT return an empty array unless the corpus truly contains nothing job-related.`;

  const user = `Extract jobs from the following scraped data:\n\n${corpus.slice(0, 60000)}`;

  let content = "";
  try {
    content = await callAI({
      system,
      user,
      json: true,
      model: "minimaxai/minimax-m3",
    });
  } catch (e) {
    console.error("[jobs] AI extraction failed", e);
  }

  let jobs: ScrapedJob[] = [];
  try {
    const parsed = JSON.parse(content);
    jobs = Array.isArray(parsed?.jobs) ? parsed.jobs : [];
  } catch (e) {
    console.error("[jobs] AI JSON parse failed", e);
  }

  // Fallback: if AI returned nothing, synthesize minimal entries from snippets
  if (jobs.length === 0 && unique.length > 0) {
    console.log("[jobs] falling back to raw snippets");
    jobs = unique.slice(0, 30).map((s) => ({
      title: s.title || "Job posting",
      company: extractCompanyFromTitle(s.title) || "—",
      source_url: s.url,
      source: s.source,
    }));
  }

  return jobs.slice(0, 30).map((j) => ({
    title: j.title ?? "",
    company: j.company ?? "",
    email: j.email ?? undefined,
    website: j.website ?? undefined,
    address: j.address ?? undefined,
    salary: j.salary ?? undefined,
    source_url: j.source_url ?? "",
    source: j.source ?? "Merojob",
  }));
}

function extractCompanyFromTitle(t: string): string | undefined {
  if (!t) return undefined;
  // Common patterns: "Job Title at Company | Merojob" or "Job Title - Company"
  const at = t.split(/\s+at\s+/i)[1];
  if (at) return at.split(/[|\-–]/)[0].trim();
  const dash = t.split(/\s[-–|]\s/);
  if (dash.length > 1) return dash[1].replace(/merojob|jobsnepal/gi, "").trim();
  return undefined;
}
