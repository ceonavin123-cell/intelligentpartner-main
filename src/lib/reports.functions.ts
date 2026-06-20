import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiChat, type AIProvider } from "@/lib/ai-providers";

export type ReportKind =
  | "pre_audit"
  | "sow"
  | "tax_recovery"
  | "growth_plan"
  | "operations_playbook"
  | "marketing_blueprint";

const KIND_ENUM = [
  "pre_audit",
  "sow",
  "tax_recovery",
  "growth_plan",
  "operations_playbook",
  "marketing_blueprint",
] as const;

const VISUAL_TOOLBOX = `
VISUAL TOOLBOX — Use these fenced blocks LIBERALLY (every report MUST contain at least: 1 kpi row, 2 charts of different types, 1 scorecard, 1 timeline, and 2+ callouts). Vary chart types — don't repeat the same one. Place visuals between prose, never bunch them.

\`\`\`kpi
{"items":[
 {"label":"Revenue Leak","value":"$184K","delta":"↑ recoverable in 90d","trend":"up","icon":"dollar","accent":"#10b981"},
 {"label":"Tax Exposure","value":"$42K","delta":"3 missed credits","trend":"down","icon":"warning","accent":"#f59e0b"},
 {"label":"Ops Hours/wk","value":"22h","delta":"automatable","trend":"down","icon":"zap","accent":"#8b5cf6"},
 {"label":"Pipeline Gap","value":"68%","delta":"vs benchmark","trend":"down","icon":"target","accent":"#ec4899"}
]}
\`\`\`
Icons: dollar, warning, zap, target, rocket, shield, lightbulb, trophy, flame, trending_up, trending_down, check, brain, sparkles.

\`\`\`chart
{"title":"...","subtitle":"optional","type":"bar|horizontal_bar|pie|donut|line|area|radar|radial|funnel","data":[{"label":"X","value":42}]}
\`\`\`
Pick the type that fits the data: radar for multi-dimensional scorecards, funnel for sales/pipeline, donut for mix, area for cumulative growth, radial for progress, horizontal_bar for ranked lists.

\`\`\`scorecard
{"items":[
 {"label":"Sales Channel Coverage","score":42,"max":100,"verdict":"Critical exposure — no outbound motion"},
 {"label":"Digital Authority","score":68,"max":100,"verdict":"Action needed — thin backlink profile"}
]}
\`\`\`

\`\`\`timeline
{"items":[
 {"phase":"PHASE 1","weeks":"Weeks 1-3","title":"Capital Recovery","outcome":"$60K refund filed","owner":"Tax Agent"},
 {"phase":"PHASE 2","weeks":"Weeks 4-6","title":"Ops Standardisation","outcome":"22h/wk saved","owner":"COO Agent"}
]}
\`\`\`

\`\`\`callout
{"variant":"insight|warning|win|action","title":"Optional title","body":"One punchy sentence.","icon":"lightbulb"}
\`\`\`
`;

type ReportType = "assessment" | "sow" | "summary" | "work_output";
const REPORT_BRIEFS: Record<ReportKind, { title: string; type: ReportType; brief: string }> = {
  pre_audit: {
    title: "Strategic Enterprise External Diagnosis",
    type: "assessment",
    brief: `Produce a PRE-AUDIT REPORT in exactly 3 visually-rich pages. Treat it like an infographic-heavy McKinsey deliverable — every page must have multiple visual blocks, not walls of text.

STRUCTURE (use this EXACT skeleton, fill with concrete numbers; mark estimates "est."):

# 🌐 STRATEGIC ENTERPRISE EXTERNAL DIAGNOSIS
**CONFIDENTIAL REPORT PREPARED FOR:** {company name}
**AUDITED DOMAIN:** {website} · **INDUSTRY:** {industry} · **DATE:** {today}
**ISSUED BY:** Strategic Advisory Collective

---

## Executive Snapshot
3 tight sentences. Then a \`\`\`kpi\`\`\` block with 4 headline metrics (external competitive index, total leak USD, fastest recoverable, momentum score).

## Competitive Gap Scorecard
A \`\`\`scorecard\`\`\` block with 5 dimensions: Sales Channel, Digital Authority, Tax Efficiency, Ops & Tech, Brand Trust — each with a 1-line verdict.

Then a \`\`\`chart\`\`\` type "radar" showing the same 5 dimensions vs industry benchmark.

A \`\`\`callout\`\`\` variant "warning" calling out the single biggest leak.

---

## Departmental Diagnostics

For each: 💰 CFO · ⚖️ Tax · 📢 Marketing · 🤖 Ops — write 2–3 lines (Gap → Benchmark → Opportunity).

A \`\`\`chart\`\`\` type "donut" titled "Estimated Annual Recovery Mix (USD)" with 4–5 slices.
A \`\`\`chart\`\`\` type "horizontal_bar" ranking top 5 quick wins by USD impact.
A \`\`\`callout\`\`\` variant "insight" on the highest-leverage department.

---

## Integrated Advisory Roadmap
A \`\`\`timeline\`\`\` block with 3 phases (Capital Recovery 1-3w · Ops Standardisation 4-6w · Automated Acquisition 7-9w) — include owner agent and expected outcome per phase.

## Projected 12-Month Impact
A \`\`\`chart\`\`\` type "area" titled "Projected Cumulative Recovery (USD)" with M1,M3,M6,M9,M12.

A \`\`\`chart\`\`\` type "funnel" titled "Pipeline Build-Up" with 5 stages (Suspects → Closed-Won).

A \`\`\`callout\`\`\` variant "win" summarising the 12-month upside in one line.

## 🚀 Momentum — Next Step
3 confident lines inviting a 30-minute Results Walkthrough.

IMPORTANT: Do NOT write "PAGE 1", "PAGE 2", "PAGE 3" anywhere. No page labels in the body — page numbers are added automatically in the print footer.`,
  },
  sow: {
    title: "Statement of Work — Strategic Engagement",
    type: "sow",
    brief: `Professional SOW. Required visual blocks: opening \`\`\`kpi\`\`\` (4 engagement metrics: duration, agents deployed, deliverables count, projected ROI), \`\`\`chart\`\`\` donut for workstream effort split, \`\`\`timeline\`\`\` for milestones, \`\`\`scorecard\`\`\` for pricing tier comparison, \`\`\`callout\`\`\` variant "action" for acceptance criteria. Sections: Engagement Overview, Objectives, In/Out of Scope, Workstreams per agent, Deliverables table, Pricing tiers, Momentum closing.`,
  },
  tax_recovery: {
    title: "Tax Recovery & Optimization Dossier",
    type: "work_output",
    brief: `Tax dossier. Required visuals: \`\`\`kpi\`\`\` (total refund est., # credits, exposure, recovery window), \`\`\`chart\`\`\` horizontal_bar "Refund Estimate by Category", \`\`\`chart\`\`\` radar "Compliance Risk Map", \`\`\`timeline\`\`\` filing roadmap, \`\`\`callout\`\`\` variant "warning" on top compliance risk. Sections: Jurisdiction Map, Eligible Credits, Retroactive Refund Estimate, Risks, Filing Roadmap.`,
  },
  growth_plan: {
    title: "90-Day Growth & BizDev Plan",
    type: "work_output",
    brief: `Growth playbook. Required visuals: \`\`\`kpi\`\`\` (pipeline target, MQLs/wk, channels, projected CAC), \`\`\`chart\`\`\` funnel "Pipeline Stages", \`\`\`chart\`\`\` area "Weekly Pipeline Build-Up", \`\`\`chart\`\`\` horizontal_bar "Channel ROI Projection", \`\`\`timeline\`\`\` 90-day rollout, \`\`\`callout\`\`\` variant "win" on top channel bet. Sections: ICP, Target Account criteria, Channel Mix, Outbound Sequence, Partnerships, KPIs.`,
  },
  operations_playbook: {
    title: "Operations Standardization Playbook",
    type: "work_output",
    brief: `COO playbook. Required visuals: \`\`\`kpi\`\`\` (hours saved/wk, SOPs delivered, automation count, key-person risk score), \`\`\`chart\`\`\` donut "Automation Categories", \`\`\`chart\`\`\` bar "Weekly Admin Hours Saved", \`\`\`scorecard\`\`\` "Process Maturity", \`\`\`timeline\`\`\` rollout, \`\`\`callout\`\`\` variant "insight" on top automation win. Sections: Process Map, Key-Person Risks, SOP Catalog, Automation, Tooling.`,
  },
  marketing_blueprint: {
    title: "Digital Marketing Blueprint",
    type: "work_output",
    brief: `Marketing blueprint. Required visuals: \`\`\`kpi\`\`\` (organic traffic target, keyword opportunities, content cadence, projected CPL), \`\`\`chart\`\`\` donut "Budget Split", \`\`\`chart\`\`\` horizontal_bar "Keyword Opportunity", \`\`\`chart\`\`\` radar "Brand Audit Dimensions", \`\`\`timeline\`\`\` content calendar, \`\`\`callout\`\`\` variant "action" on first 30-day priority. Sections: Brand Audit, SEO Gap, Content Pillars, Paid Channel Test Plan, Funnel KPIs.`,
  },
};

export const generateStructuredReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string; kind: string; templateId?: string }) =>
    z
      .object({
        companyId: z.string().uuid(),
        kind: z.string().min(1),
        templateId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY missing");

    const [
      { data: company },
      { data: assessments },
      { data: sources },
      { data: memory },
      { data: documents },
    ] = await Promise.all([
      supabase.from("companies").select("*").eq("id", data.companyId).single(),
      supabase.from("agent_assessments").select("*").eq("company_id", data.companyId),
      supabase
        .from("research_sources")
        .select("url,title,excerpt")
        .eq("company_id", data.companyId)
        .limit(15),
      supabase
        .from("agent_memory")
        .select("agent,key,value")
        .eq("company_id", data.companyId)
        .limit(40),
      supabase
        .from("company_documents")
        .select("name,content")
        .eq("company_id", data.companyId)
        .limit(20),
    ]);
    if (!company) throw new Error("Company not found");

    let spec: { title: string; type: string; brief: string };
    if (data.kind === "custom" && data.templateId) {
      const { data: tpl, error: tErr } = await supabase
        .from("report_templates")
        .select("label,brief,report_type")
        .eq("id", data.templateId)
        .single();
      if (tErr || !tpl) throw new Error("Template not found");
      spec = { title: tpl.label, type: tpl.report_type, brief: tpl.brief };
    } else if (data.kind in REPORT_BRIEFS) {
      spec = REPORT_BRIEFS[data.kind as ReportKind];
    } else {
      throw new Error(`Unknown report kind: ${data.kind}`);
    }

    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const assessmentBlock =
      (assessments ?? [])
        .map(
          (a: any) =>
            `### ${a.agent.toUpperCase()} (risk ${a.risk_score ?? "?"})\n${a.summary ?? ""}\nFindings: ${JSON.stringify(a.findings ?? {}).slice(0, 1200)}`,
        )
        .join("\n\n") || "(no assessments)";
    const sourceBlock =
      (sources ?? []).map((s: any) => `- ${s.title ?? s.url} — ${s.url}`).join("\n") ||
      "(no sources)";
    const memoryBlock =
      (memory ?? []).map((m: any) => `- [${m.agent}] ${m.key}: ${m.value}`).join("\n") || "(none)";
    const docBlock =
      (documents ?? [])
        .map((d: any) => `### Document: ${d.name}\n${String(d.content ?? "").slice(0, 6000)}`)
        .join("\n\n---\n\n") || "(none)";

    const system = `You are a senior consulting partner producing a polished, visually-rich, board-ready infographic deliverable for ${company.name}.
Tone: confident, specific, McKinsey-grade. Never conversational. Never "I think" / "as an AI". Use real numbers; mark estimates "est.".
The reader expects a MIX of pictorial, attractive, unique infographics — not a wall of text. Every section must mix prose with visual blocks. Vary chart types (radar, donut, area, funnel, horizontal_bar, radial) — never use bar/pie repeatedly.
Use H2/H3 headings, short paragraphs (2–3 lines), tables only when comparing, and end with a "## 🚀 Momentum" CTA.

${VISUAL_TOOLBOX}`;

    const user = `COMPANY CONTEXT
Name: ${company.name}
Website: ${company.website ?? "n/a"}
Industry: ${company.industry ?? "unknown"}
Date: ${today}

AGENT ASSESSMENTS
${assessmentBlock}

LEARNED MEMORY
${memoryBlock}

RESEARCH SOURCES
${sourceBlock}

CLIENT-PROVIDED DOCUMENTS
${docBlock}

DELIVERABLE BRIEF
${spec.brief}

CRITICAL: You MUST include these visual blocks in your response:
- At least 1 kpi block with 4 metrics
- At least 2 chart blocks (different types: bar, donut, radar, funnel, area, etc.)
- At least 1 scorecard block
- At least 1 timeline block
- At least 2 callout blocks

Each visual block MUST be a fenced code block with the language tag (kpi, chart, scorecard, timeline, callout) containing valid JSON.

Example format:
\`\`\`kpi
{"items":[{"label":"Metric","value":"$100K","delta":"↑ 20%","trend":"up","icon":"dollar","accent":"#10b981"}]}
\`\`\`

Now produce the complete report as markdown with ALL visual blocks included.`;

    const content = await aiChat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { provider: "minimax" },
    );
    if (!content) throw new Error("Empty report generation");

    const { data: rep, error } = await supabase
      .from("reports")
      .insert({
        company_id: company.id,
        type: spec.type as any,
        title: `${spec.title} — ${company.name}`,
        content,
        agents_involved: (assessments ?? []).map((a: any) => a.agent),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { report: rep };
  });
