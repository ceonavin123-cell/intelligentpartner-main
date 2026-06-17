import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateIntelligenceScore, loadMemoryContext } from "@/lib/memory.server";

export const getCompanyMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { companyId } = data;

    // Load all memory data in parallel
    const [memory, intelligenceScore, semanticResult, connectionResult, recentActivity] =
      await Promise.all([
        loadMemoryContext(supabase, companyId, "", 50),
        calculateIntelligenceScore(supabase, companyId),
        supabase
          .from("semantic_memories")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId),
        supabase
          .from("memory_connections")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId),
        supabase
          .from("semantic_memories")
          .select("id, content, category, confidence, agent, created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

    return {
      memories: memory.semanticMemories,
      patterns: memory.proceduralMemories,
      recentActivity: recentActivity.data ?? [],
      intelligence: {
        score: intelligenceScore.score,
        breakdown: intelligenceScore.breakdown,
        totalMemories: semanticResult.count ?? 0,
        totalConnections: connectionResult.count ?? 0,
      },
    };
  });

export const getMemoryTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Get memories grouped by date
    const { data: memories } = await supabase
      .from("semantic_memories")
      .select("id, content, category, confidence, agent, created_at")
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!memories || memories.length === 0) return { timeline: [] };

    // Group by date
    const grouped: Record<string, any[]> = {};
    for (const mem of memories) {
      const date = new Date(mem.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(mem);
    }

    return { timeline: Object.entries(grouped).map(([date, items]) => ({ date, items })) };
  });
