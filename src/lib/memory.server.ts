// ============================================================
// GEOMETRIC MEMORY ENGINE
// Runs parallel to every answer — zero latency learning
// Multi-provider support (Gemini, OpenRouter, MiniMax)
// ============================================================

import { aiChat, type AIProvider } from "@/lib/ai-providers";

// ─── 1. EXTRACT INSIGHTS FROM CONVERSATION ──────────────────
// Runs parallel to every answer — extracts 3-5 key insights
export async function extractInsights(opts: {
  companyId: string;
  userMessage: string;
  assistantReply: string;
  agent?: string;
}): Promise<{
  insights: Array<{ content: string; category: string; confidence: number }>;
}> {
  const system = `You are a memory extractor for a business consulting AI. 
Extract key insights from this conversation exchange.

Return STRICT JSON: {"insights": [{"content": "string", "category": "string", "confidence": number}]}

Categories (pick the best one):
- fact: Hard data (revenue, dates, names, amounts)
- decision: Something decided or committed to
- risk: A problem, concern, or vulnerability identified
- relationship: Connection between people, companies, or concepts
- preference: What the user likes, wants, or prioritizes
- context: Background information or situation details
- prediction: Something expected or forecasted
- update: A change from previous information

Rules:
- Extract 3-5 insights maximum
- Each insight must be a complete, standalone sentence
- Confidence: 0.0 (unsure) to 1.0 (certain)
- Focus on INFORMATION WORTH REMEMBERING
- Skip pleasantries, greetings, meta-discussion
- If user shares a number, ALWAYS extract it as a fact`;

  const user = `User message: ${opts.userMessage}

Assistant reply (first 500 chars): ${opts.assistantReply.slice(0, 500)}

Extract key insights now.`;

  try {
    const content = await aiChat([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);

    if (!content) return { insights: [] };
    const parsed = JSON.parse(content);
    return { insights: Array.isArray(parsed.insights) ? parsed.insights : [] };
  } catch {
    return { insights: [] };
  }
}

// ─── 2. STORE INSIGHTS IN PARALLEL ──────────────────────────
// Saves extracted insights + creates connections
export async function storeInsights(
  supabase: any,
  companyId: string,
  insights: Array<{ content: string; category: string; confidence: number }>,
  agent: string = "orchestrator",
): Promise<{ stored: number; connections: number }> {
  let stored = 0;
  let connections = 0;

  for (const insight of insights) {
    // Check for duplicate (same content within last 24h)
    const { data: existing } = await supabase
      .from("semantic_memories")
      .select("id")
      .eq("company_id", companyId)
      .eq("content", insight.content)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1);

    if (existing && existing.length > 0) continue;

    // Store the insight
    const { data: memory, error } = await supabase
      .from("semantic_memories")
      .insert({
        company_id: companyId,
        agent,
        category: insight.category,
        content: insight.content,
        confidence: Math.max(0, Math.min(1, insight.confidence)),
        source: "chat",
      })
      .select("id")
      .single();

    if (error || !memory) continue;
    stored++;

    // Find and create connections to related memories
    const { data: related } = await supabase
      .from("semantic_memories")
      .select("id, content")
      .eq("company_id", companyId)
      .neq("id", memory.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (related && related.length > 0) {
      // Simple keyword overlap for connection strength
      const words = new Set(
        insight.content
          .toLowerCase()
          .split(/\W+/)
          .filter((w: string) => w.length > 3),
      );

      for (const rel of related) {
        const relWords = new Set(
          rel.content
            .toLowerCase()
            .split(/\W+/)
            .filter((w: string) => w.length > 3),
        );
        const overlap = [...words].filter((w: string) => relWords.has(w)).length;
        const strength = Math.min(1, overlap / Math.max(words.size, 1));

        if (strength > 0.2) {
          await supabase.from("memory_connections").insert({
            company_id: companyId,
            source_memory_id: memory.id,
            source_memory_type: "semantic",
            target_memory_id: rel.id,
            target_memory_type: "semantic",
            connection_type: "related",
            strength,
          });
          connections++;
        }
      }
    }
  }

  return { stored, connections };
}

// ─── 3. LOAD RELEVANT MEMORIES FOR CONTEXT ──────────────────
// Before answering, load all relevant memories ranked by importance
export async function loadMemoryContext(
  supabase: any,
  companyId: string,
  query: string,
  limit: number = 15,
): Promise<{
  semanticMemories: any[];
  proceduralMemories: any[];
  recentFacts: any[];
  patterns: any[];
}> {
  // Load semantic memories (weighted by confidence × recency × access)
  const { data: semanticMemories } = await supabase
    .from("semantic_memories")
    .select("*")
    .eq("company_id", companyId)
    .gt("current_weight", 0.1)
    .order("current_weight", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  // Load procedural memories (active patterns)
  const { data: proceduralMemories } = await supabase
    .from("procedural_memories")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("confidence", { ascending: false })
    .limit(10);

  // Load recent facts (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentFacts } = await supabase
    .from("semantic_memories")
    .select("content, category, confidence, created_at")
    .eq("company_id", companyId)
    .eq("category", "fact")
    .gte("created_at", weekAgo)
    .order("created_at", { ascending: false })
    .limit(10);

  // Load patterns
  const { data: patterns } = await supabase
    .from("procedural_memories")
    .select("pattern_text, pattern_type, confidence, times_observed")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("confidence", { ascending: false })
    .limit(5);

  return {
    semanticMemories: semanticMemories ?? [],
    proceduralMemories: proceduralMemories ?? [],
    recentFacts: recentFacts ?? [],
    patterns: patterns ?? [],
  };
}

// ─── 4. UPDATE MEMORY WEIGHTS (access = more important) ─────
export async function accessMemory(
  supabase: any,
  memoryId: string,
  memoryType: "semantic" | "procedural",
): Promise<void> {
  const table = memoryType === "semantic" ? "semantic_memories" : "procedural_memories";

  await supabase
    .rpc("increment_memory_access", {
      p_table: table,
      p_memory_id: memoryId,
    })
    .catch(() => {
      // Fallback if RPC doesn't exist
      supabase
        .from(table)
        .update({
          access_count: supabase.raw("access_count + 1"),
          last_accessed_at: new Date().toISOString(),
          current_weight: supabase.raw("GREATEST(current_weight * 1.05, 1.0)"),
        })
        .eq("id", memoryId);
    });
}

// ─── 5. DECAY OLD MEMORIES (weekly background job) ──────────
export async function decayMemories(
  supabase: any,
  companyId: string,
): Promise<{ decayed: number; removed: number }> {
  // Apply decay to all memories
  const { data: memories } = await supabase
    .from("semantic_memories")
    .select("id, current_weight, decay_rate, last_accessed_at")
    .eq("company_id", companyId)
    .gt("current_weight", 0.01);

  let decayed = 0;
  let removed = 0;

  if (memories && memories.length > 0) {
    for (const mem of memories) {
      const daysSinceAccess = Math.max(
        0,
        (Date.now() - new Date(mem.last_accessed_at).getTime()) / (1000 * 60 * 60 * 24),
      );
      const newWeight = Math.max(
        0,
        mem.current_weight * (1 - mem.decay_rate * (daysSinceAccess / 7)),
      );

      if (newWeight < 0.1) {
        // Remove very low weight memories
        await supabase.from("semantic_memories").delete().eq("id", mem.id);
        removed++;
      } else if (newWeight !== mem.current_weight) {
        await supabase
          .from("semantic_memories")
          .update({ current_weight: newWeight })
          .eq("id", mem.id);
        decayed++;
      }
    }
  }

  return { decayed, removed };
}

// ─── 6. DETECT PATTERNS (weekly background job) ─────────────
export async function detectPatterns(
  supabase: any,
  companyId: string,
): Promise<{ patterns: Array<{ text: string; type: string; confidence: number }> }> {
  // Get all semantic memories
  const { data: memories } = await supabase
    .from("semantic_memories")
    .select("content, category, confidence, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!memories || memories.length < 5) return { patterns: [] };

  const memoryText = memories
    .map(
      (m: any) => `[${m.category}] ${m.content} (${new Date(m.created_at).toLocaleDateString()})`,
    )
    .join("\n");

  const system = `You are a pattern detection AI. Analyze these memories about a company and find patterns.

Return STRICT JSON: {"patterns": [{"text": "string", "type": "string", "confidence": number}]}

Pattern types:
- trend: Direction something is moving (up/down/growing/shrinking)
- anomaly: Something unusual or unexpected
- cycle: Something that repeats (seasonal, quarterly)
- correlation: Two things that move together
- prediction: What will likely happen next
- risk: Emerging risk based on patterns

Rules:
- Find 2-5 patterns maximum
- Each pattern must be supported by at least 3 memory entries
- Confidence: how sure are you this is a real pattern (0.0-1.0)
- Focus on ACTIONABLE patterns that matter for business decisions
- Don't state the obvious — find non-obvious insights`;

  const user = `Company memories (${memories.length} entries):

${memoryText}

Find patterns now.`;

  try {
    const content = await aiChat([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);

    if (!content) return { patterns: [] };
    const parsed = JSON.parse(content);
    return { patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [] };
  } catch {
    return { patterns: [] };
  }
}

// ─── 7. STORE PATTERNS ──────────────────────────────────────
export async function storePatterns(
  supabase: any,
  companyId: string,
  patterns: Array<{ text: string; type: string; confidence: number }>,
): Promise<{ stored: number }> {
  let stored = 0;

  for (const pattern of patterns) {
    // Check if similar pattern exists
    const { data: existing } = await supabase
      .from("procedural_memories")
      .select("id, times_observed, confidence")
      .eq("company_id", companyId)
      .eq("pattern_type", pattern.type)
      .ilike("pattern_text", `%${pattern.text.slice(0, 50)}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update existing pattern (observed again → more confident)
      await supabase
        .from("procedural_memories")
        .update({
          times_observed: existing[0].times_observed + 1,
          confidence: Math.min(1, existing[0].confidence + 0.1),
          last_observed_at: new Date().toISOString(),
        })
        .eq("id", existing[0].id);
    } else {
      // New pattern
      const { error } = await supabase.from("procedural_memories").insert({
        company_id: companyId,
        pattern_type: pattern.type,
        pattern_text: pattern.text,
        confidence: pattern.confidence,
        evidence: [new Date().toISOString()],
      });

      if (!error) stored++;
    }
  }

  return { stored };
}

// ─── 8. CALCULATE INTELLIGENCE SCORE ────────────────────────
export async function calculateIntelligenceScore(
  supabase: any,
  companyId: string,
): Promise<{
  score: number;
  breakdown: {
    memories: number;
    connections: number;
    patterns: number;
    avgConfidence: number;
    daysActive: number;
  };
}> {
  const [semanticCount, proceduralCount, connectionCount, avgConf] = await Promise.all([
    supabase
      .from("semantic_memories")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    supabase
      .from("procedural_memories")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("is_active", true),
    supabase
      .from("memory_connections")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    supabase.from("semantic_memories").select("confidence").eq("company_id", companyId).limit(100),
  ]);

  const memories = (semanticCount?.count ?? 0) + (proceduralCount?.count ?? 0);
  const connections = connectionCount?.count ?? 0;
  const patterns = proceduralCount?.count ?? 0;
  const confValues = (avgConf?.data ?? []).map((r: any) => r.confidence);
  const avgConfidence =
    confValues.length > 0
      ? confValues.reduce((a: number, b: number) => a + b, 0) / confValues.length
      : 0;

  // Calculate days active
  const { data: firstMemory } = await supabase
    .from("semantic_memories")
    .select("created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(1);

  const daysActive =
    firstMemory && firstMemory.length > 0
      ? Math.max(
          1,
          Math.floor(
            (Date.now() - new Date(firstMemory[0].created_at).getTime()) / (1000 * 60 * 60 * 24),
          ),
        )
      : 1;

  // Geometric formula: connections grow faster than facts
  // Score = (memories * avgConfidence) * (1 + connections/memories)^2 * (1 + patterns/10)
  const connectionMultiplier = 1 + (memories > 0 ? connections / memories : 0);
  const patternMultiplier = 1 + patterns / 10;
  const score = Math.round(
    memories *
      avgConfidence *
      Math.pow(connectionMultiplier, 2) *
      patternMultiplier *
      Math.min(3, daysActive / 7),
  );

  // Store the score
  await supabase.from("intelligence_scores").insert({
    company_id: companyId,
    total_memories: memories,
    semantic_count: semanticCount?.count ?? 0,
    procedural_count: proceduralCount?.count ?? 0,
    connection_count: connections,
    avg_confidence: avgConfidence,
    intelligence_score: score,
    predictions_made: patterns,
    risks_flagged:
      (
        await supabase
          .from("procedural_memories")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("pattern_type", "risk")
          .eq("is_active", true)
      )?.count ?? 0,
  });

  return {
    score,
    breakdown: { memories, connections, patterns, avgConfidence, daysActive },
  };
}

// ─── 9. BUILD MEMORY CONTEXT FOR AI ─────────────────────────
// Formats all memory into a prompt section
export async function buildMemoryPrompt(supabase: any, companyId: string): Promise<string> {
  const memory = await loadMemoryContext(supabase, companyId, "", 15);

  if (memory.semanticMemories.length === 0 && memory.proceduralMemories.length === 0) {
    return "";
  }

  const semanticSection =
    memory.semanticMemories.length > 0
      ? `SEMANTIC MEMORIES (facts, decisions, relationships):
${memory.semanticMemories.map((m: any) => `- [${m.category}] ${m.content} (confidence: ${m.confidence}, weight: ${m.current_weight})`).join("\n")}`
      : "";

  const proceduralSection =
    memory.proceduralMemories.length > 0
      ? `LEARNED PATTERNS:
${memory.proceduralMemories.map((p: any) => `- [${p.pattern_type}] ${p.pattern_text} (confidence: ${p.confidence}, observed: ${p.times_observed}x)`).join("\n")}`
      : "";

  const recentSection =
    memory.recentFacts.length > 0
      ? `RECENT FACTS (last 7 days):
${memory.recentFacts.map((f: any) => `- ${f.content} (${new Date(f.created_at).toLocaleDateString()})`).join("\n")}`
      : "";

  const patternsSection =
    memory.patterns.length > 0
      ? `ACTIVE PREDICTIONS/WARNINGS:
${memory.patterns.map((p: any) => `- [${p.pattern_type}] ${p.pattern_text} (confidence: ${p.confidence})`).join("\n")}`
      : "";

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 COMPANY MEMORY (geometric intelligence)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This company has been analyzed for ${memory.semanticMemories.length + memory.proceduralMemories.length} memory entries.
Use these memories to give more accurate, context-aware answers.

${semanticSection}

${proceduralSection}

${recentSection}

${patternsSection}

Always reference memories when relevant. If a memory contradicts user input, ask for clarification.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ─── 10. REAL-TIME LEARNING (runs parallel to answering) ────
// Main entry point — called from chat function
export async function learnFromConversation(
  supabase: any,
  opts: {
    companyId: string;
    userMessage: string;
    assistantReply: string;
    agent?: string;
  },
): Promise<{ insightsStored: number; connectionsMade: number }> {
  // Step 1: Extract insights
  const { insights } = await extractInsights({
    companyId: opts.companyId,
    userMessage: opts.userMessage,
    assistantReply: opts.assistantReply,
    agent: opts.agent,
  });

  if (insights.length === 0) return { insightsStored: 0, connectionsMade: 0 };

  // Step 2: Store insights + create connections
  const result = await storeInsights(supabase, opts.companyId, insights, opts.agent);

  // Step 3: Update intelligence score (fire and forget)
  calculateIntelligenceScore(supabase, opts.companyId).catch(console.error);

  return { insightsStored: result.stored, connectionsMade: result.connections };
}

// ─── 8. MEMORY CONSOLIDATION ──────────────────────────────────
// Merges duplicate memories and strengthens important ones
export async function consolidateMemories(
  supabase: any,
  companyId: string,
): Promise<{
  merged: number;
  strengthened: number;
  pruned: number;
}> {
  let merged = 0;
  let strengthened = 0;
  let pruned = 0;

  // Step 1: Find duplicate memories (same key, similar values)
  const { data: memories } = await supabase
    .from("semantic_memories")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (!memories || memories.length < 2) return { merged: 0, strengthened: 0, pruned: 0 };

  // Group by agent + key
  const groups: Record<string, any[]> = {};
  for (const mem of memories) {
    const groupKey = `${mem.agent}:${mem.key}`;
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(mem);
  }

  // Step 2: Merge duplicates within each group
  for (const [groupKey, mems] of Object.entries(groups)) {
    if (mems.length < 2) continue;

    // Find similar values (simple string similarity)
    const toMerge: any[] = [];
    const seen = new Set<string>();

    for (const mem of mems) {
      if (seen.has(mem.id)) continue;

      // Find similar memories
      const similar = mems.filter(
        (m) => m.id !== mem.id && !seen.has(m.id) && calculateSimilarity(mem.value, m.value) > 0.7,
      );

      if (similar.length > 0) {
        toMerge.push(mem, ...similar);
        seen.add(mem.id);
        similar.forEach((s) => seen.add(s.id));
      }
    }

    // Merge similar memories
    if (toMerge.length >= 2) {
      // Keep the one with highest confidence
      const best = toMerge.reduce((a, b) => ((a.confidence || 0) > (b.confidence || 0) ? a : b));

      // Average confidence of all merged
      const avgConfidence =
        toMerge.reduce((sum, m) => sum + (m.confidence || 0.5), 0) / toMerge.length;

      // Update best memory with merged confidence
      await supabase
        .from("semantic_memories")
        .update({
          confidence: Math.min(avgConfidence * 1.2, 1), // Boost confidence for merged
          updated_at: new Date().toISOString(),
        })
        .eq("id", best.id);

      // Delete duplicates
      const toDelete = toMerge.filter((m) => m.id !== best.id);
      if (toDelete.length > 0) {
        await supabase
          .from("semantic_memories")
          .delete()
          .in(
            "id",
            toDelete.map((m) => m.id),
          );
        merged += toDelete.length;
      }
    }
  }

  // Step 3: Strengthen frequently accessed memories
  const { data: connections } = await supabase
    .from("memory_connections")
    .select("source_memory_id")
    .eq("company_id", companyId);

  const accessCounts: Record<string, number> = {};
  for (const conn of connections || []) {
    accessCounts[conn.source_memory_id] = (accessCounts[conn.source_memory_id] || 0) + 1;
  }

  // Boost confidence for frequently connected memories
  for (const [memId, count] of Object.entries(accessCounts)) {
    if (count >= 3) {
      const { data: mem } = await supabase
        .from("semantic_memories")
        .select("confidence")
        .eq("id", memId)
        .single();

      if (mem && mem.confidence < 0.9) {
        const newConfidence = Math.min(mem.confidence + 0.1 * Math.log(count), 1);
        await supabase
          .from("semantic_memories")
          .update({ confidence: newConfidence })
          .eq("id", memId);
        strengthened++;
      }
    }
  }

  // Step 4: Prune very old, low-confidence memories
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: oldMemories } = await supabase
    .from("semantic_memories")
    .select("id")
    .eq("company_id", companyId)
    .lt("confidence", 0.3)
    .lt("created_at", thirtyDaysAgo.toISOString());

  if (oldMemories && oldMemories.length > 0) {
    // Don't delete, just mark as low priority
    await supabase
      .from("semantic_memories")
      .update({ confidence: 0.1 })
      .in(
        "id",
        oldMemories.map((m: any) => m.id),
      );
    pruned = oldMemories.length;
  }

  console.log(
    `[consolidation] Merged: ${merged}, Strengthened: ${strengthened}, Pruned: ${pruned}`,
  );

  return { merged, strengthened, pruned };
}

// ─── HELPER: Calculate string similarity ─────────────────────
function calculateSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower === bLower) return 1;
  if (aLower.includes(bLower) || bLower.includes(aLower)) return 0.8;

  // Simple word overlap
  const aWords = new Set(aLower.split(/\s+/));
  const bWords = new Set(bLower.split(/\s+/));
  const intersection = [...aWords].filter((w) => bWords.has(w));
  const union = new Set([...aWords, ...bWords]);

  return intersection.length / union.size;
}

// ─── 9. SCHEDULED CONSOLIDATION (run daily) ──────────────────
export async function scheduledConsolidation(supabase: any, companyId: string) {
  console.log(`[consolidation] Starting scheduled consolidation for ${companyId}`);

  const result = await consolidateMemories(supabase, companyId);

  // Also consolidate procedural memories
  const { data: procedures } = await supabase
    .from("procedural_memories")
    .select("*")
    .eq("company_id", companyId);

  if (procedures && procedures.length > 0) {
    // Find similar procedures and merge
    const groups: Record<string, any[]> = {};
    for (const proc of procedures) {
      const key = proc.action;
      if (!groups[key]) groups[key] = [];
      groups[key].push(proc);
    }

    for (const [action, procs] of Object.entries(groups)) {
      if (procs.length < 2) continue;

      // Keep the most successful one
      const best = procs.reduce((a, b) => ((a.success_rate || 0) > (b.success_rate || 0) ? a : b));

      // Update frequency
      const totalFrequency = procs.reduce((sum, p) => sum + (p.frequency || 1), 0);
      await supabase
        .from("procedural_memories")
        .update({ frequency: totalFrequency })
        .eq("id", best.id);

      // Delete duplicates
      const toDelete = procs.filter((p) => p.id !== best.id);
      if (toDelete.length > 0) {
        await supabase
          .from("procedural_memories")
          .delete()
          .in(
            "id",
            toDelete.map((p) => p.id),
          );
        result.merged += toDelete.length;
      }
    }
  }

  console.log(
    `[consolidation] Completed: ${result.merged} merged, ${result.strengthened} strengthened, ${result.pruned} pruned`,
  );

  return result;
}
