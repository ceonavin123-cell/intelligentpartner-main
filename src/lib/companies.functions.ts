import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { researchCompany, runAgentAssessment } from "./research.server";
import { AGENT_KEYS } from "./agents";

const AGENTS = AGENT_KEYS;

export const createCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; website?: string; industry?: string }) =>
    z
      .object({
        name: z.string().min(1).max(200),
        website: z.string().url().max(500).optional().or(z.literal("")),
        industry: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: company, error } = await supabase
      .from("companies")
      .insert({
        owner_id: userId,
        name: data.name,
        website: data.website || null,
        industry: data.industry || null,
        status: "researching",
      })
      .select()
      .single();
    if (error) {
      console.error("[server] DB error:", error.message);
      throw new Error("Database operation failed");
    }
    return { company };
  });

export const listCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("companies")
      .select("*")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[server] DB error:", error.message);
      throw new Error("Database operation failed");
    }
    return { companies: data ?? [] };
  });

export const getCompanyDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [c, a, s, r, t, d] = await Promise.all([
      supabase.from("companies").select("*").eq("id", data.id).eq("owner_id", userId).single(),
      supabase.from("agent_assessments").select("*").eq("company_id", data.id),
      supabase.from("research_sources").select("*").eq("company_id", data.id),
      supabase.from("reports").select("*").eq("company_id", data.id).order("created_at", { ascending: false }),
      supabase.from("chat_threads").select("*").eq("company_id", data.id).order("created_at", { ascending: false }),
      supabase.from("company_documents").select("id,name,mime,size_bytes,created_at").eq("company_id", data.id).order("created_at", { ascending: false }),
    ]);

    if (c.error || !c.data) {
      throw new Error("Company not found or access denied");
    }

    return {
      company: c.data,
      assessments: a.data ?? [],
      sources: s.data ?? [],
      reports: r.data ?? [],
      threads: t.data ?? [],
      documents: d.data ?? [],
    };
  });

export const runCompanyResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify ownership
    const { data: company, error: cErr } = await supabase
      .from("companies")
      .select("*")
      .eq("id", data.companyId)
      .eq("owner_id", userId)
      .single();

    if (cErr || !company) throw new Error("Company not found or access denied");

    await supabase.from("companies").update({ status: "researching" }).eq("id", company.id);

    // Replace existing assessments with pending rows
    await supabase.from("agent_assessments").delete().eq("company_id", company.id);
    await supabase.from("research_sources").delete().eq("company_id", company.id);
    await supabase.from("agent_assessments").insert(
      AGENTS.map((agent) => ({
        company_id: company.id,
        agent,
        status: "running",
        findings: {},
      })),
    );

    const research = await researchCompany({ name: company.name, website: company.website });

    // Store sources
    const sourceRows = research.searchResults.map((r) => ({
      company_id: company.id,
      url: r.url,
      title: r.title,
      excerpt: r.description,
    }));
    if (company.website && research.websiteSummary) {
      sourceRows.unshift({
        company_id: company.id,
        url: company.website,
        title: `${company.name} — website`,
        excerpt: research.websiteSummary.slice(0, 500),
      });
    }
    if (sourceRows.length) await supabase.from("research_sources").insert(sourceRows);

    // Run agents in 2 batches for speed + avoid MiniMax rate limiting
    const runAgent = async (agent: AgentKey) => {
      try {
        const r = await Promise.race([
          runAgentAssessment({
            agent,
            companyName: company.name,
            website: company.website,
            research,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`${agent} timed out after 120s`)), 120_000)
          ),
        ]);
        await supabase
          .from("agent_assessments")
          .update({
            status: "complete",
            summary: r.summary,
            findings: r.findings,
            risk_score: r.risk_score,
          })
          .eq("company_id", company.id)
          .eq("agent", agent);
        console.log(`[agent] ${agent} completed`);
        return { agent, ok: true };
      } catch (e: any) {
        console.error(`[agent] ${agent} failed:`, e.message);
        await supabase
          .from("agent_assessments")
          .update({
            status: "error",
            summary: `Assessment failed: ${e.message}`,
            findings: {},
            risk_score: 50,
          })
          .eq("company_id", company.id)
          .eq("agent", agent);
        return { agent, ok: false, error: e?.message };
      }
    };

    // Batch 1: CFO + COO + Tax (parallel)
    console.log("[research] Batch 1: CFO, COO, Tax");
    const batch1 = await Promise.all([
      runAgent("cfo"),
      runAgent("coo"),
      runAgent("tax"),
    ]);

    // Batch 2: Marketing + BizDev (parallel)
    console.log("[research] Batch 2: Marketing, BizDev");
    const batch2 = await Promise.all([
      runAgent("marketing"),
      runAgent("bizdev"),
    ]);

    const results = [...batch1, ...batch2];

    await supabase
      .from("companies")
      .update({ status: "ready", research_summary: research.websiteSummary || null })
      .eq("id", company.id);

    return { ok: true, results };
  });

export const updateCompanyTokenLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string; limit: number }) =>
    z.object({ companyId: z.string().uuid(), limit: z.number().int().nonnegative() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify ownership
    const { data: company, error: fetchErr } = await supabase
      .from("companies")
      .select("id")
      .eq("id", data.companyId)
      .eq("owner_id", userId)
      .single();

    if (fetchErr || !company) {
      throw new Error("Company not found or access denied");
    }

    const { error } = await supabase
      .from("companies")
      .update({ token_limit: data.limit })
      .eq("id", data.companyId);

    if (error) {
      console.error("[server] DB error:", error.message);
      throw new Error("Database operation failed");
    }

    return { ok: true };
  });

export const resetCompanyTokenUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify ownership
    const { data: company, error: fetchErr } = await supabase
      .from("companies")
      .select("id")
      .eq("id", data.companyId)
      .eq("owner_id", userId)
      .single();

    if (fetchErr || !company) {
      throw new Error("Company not found or access denied");
    }

    const { error } = await supabase
      .from("companies")
      .update({ token_used: 0 })
      .eq("id", data.companyId);

    if (error) {
      console.error("[server] DB error:", error.message);
      throw new Error("Database operation failed");
    }

    return { ok: true };
  });

export const rerunSingleAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string; agent: string }) =>
    z.object({ companyId: z.string().uuid(), agent: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify ownership
    const { data: company } = await supabase
      .from("companies")
      .select("*")
      .eq("id", data.companyId)
      .eq("owner_id", userId)
      .single();

    if (!company) throw new Error("Company not found or access denied");

    const { data: sources } = await supabase
      .from("research_sources")
      .select("url,title,excerpt")
      .eq("company_id", data.companyId);

    const research = {
      websiteMarkdown: "",
      websiteSummary: sources?.find((s: any) => s.url === company.website)?.excerpt || "",
      searchResults: (sources ?? [])
        .filter((s: any) => s.url !== company.website)
        .map((s: any) => ({ url: s.url, title: s.title, description: s.excerpt })),
    };

    await supabase
      .from("agent_assessments")
      .update({ status: "running" })
      .eq("company_id", data.companyId)
      .eq("agent", data.agent);

    try {
      const r = await Promise.race([
        runAgentAssessment({
          agent: data.agent as any,
          companyName: company.name,
          website: company.website,
          research,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${data.agent} timed out after 120s`)), 120_000)
        ),
      ]);
      await supabase
        .from("agent_assessments")
        .update({
          status: "complete",
          summary: r.summary,
          findings: r.findings,
          risk_score: r.risk_score,
        })
        .eq("company_id", data.companyId)
        .eq("agent", data.agent);
      return { ok: true };
    } catch (e: any) {
      await supabase
        .from("agent_assessments")
        .update({
          status: "error",
          summary: `Assessment failed: ${e.message}`,
          findings: {},
          risk_score: 50,
        })
        .eq("company_id", data.companyId)
        .eq("agent", data.agent);
      return { ok: false, error: e.message };
    }
  });