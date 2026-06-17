// ============================================================
// FILE: src/lib/rag.server.ts
// RAG + GraphRAG helper functions (Multi-provider support)
// ============================================================

import { aiChat, type AIProvider } from "@/lib/ai-providers";

const GEMINI_API_KEY = () => {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY missing");
  return k;
};

// ─── 1. CHUNK TEXT ──────────────────────────────────────────
// Splits long text into overlapping chunks for embedding
export function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim()) chunks.push(chunk);
    i += chunkSize - overlap;
  }
  return chunks;
}

// ─── 1B. SEMANTIC CHUNKING ──────────────────────────────────
// Smart chunking that respects sentence and paragraph boundaries
export function semanticChunkText(
  text: string,
  maxChunkSize: number = 2000,
  minChunkSize: number = 200,
): string[] {
  const chunks: string[] = [];

  // Step 1: Split by paragraphs first (double newline)
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  let currentChunk = "";

  for (const para of paragraphs) {
    // If adding this paragraph exceeds max, save current and start new
    if (currentChunk.length + para.length > maxChunkSize && currentChunk.length >= minChunkSize) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }

    // If single paragraph is too large, split by sentences
    if (para.length > maxChunkSize) {
      const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];

      for (const sentence of sentences) {
        if (
          currentChunk.length + sentence.length > maxChunkSize &&
          currentChunk.length >= minChunkSize
        ) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }
        currentChunk += sentence + " ";
      }
    } else {
      currentChunk += para + "\n\n";
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length >= minChunkSize) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// ─── 2. EMBED TEXT ──────────────────────────────────────────
// Calls Gemini embedding API for a single text
export async function embedText(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text }] },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Embedding API ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.embedding?.values ?? [];
}

// ─── 3B. METADATA EXTRACTION ─────────────────────────────────
// Extracts metadata from document name for structured search
function extractMetadataFromDocName(docName: string): Record<string, any> {
  const lower = docName.toLowerCase();
  const metadata: Record<string, any> = {};

  // Extract document type
  if (lower.endsWith(".pdf")) metadata.document_type = "pdf";
  else if (lower.endsWith(".doc") || lower.endsWith(".docx")) metadata.document_type = "word";
  else if (lower.endsWith(".xls") || lower.endsWith(".xlsx") || lower.endsWith(".csv"))
    metadata.document_type = "spreadsheet";
  else if (lower.endsWith(".ppt") || lower.endsWith(".pptx"))
    metadata.document_type = "presentation";
  else if (lower.endsWith(".txt") || lower.endsWith(".md")) metadata.document_type = "text";
  else metadata.document_type = "other";

  // Extract year (e.g., 2024, 2025)
  const yearMatch = docName.match(/(20[0-9]{2})/);
  if (yearMatch) metadata.year = parseInt(yearMatch[1]);

  // Extract quarter (e.g., Q1, Q2, Q3, Q4)
  const quarterMatch = docName.match(/(Q[1-4])/i);
  if (quarterMatch) metadata.quarter = quarterMatch[1].toUpperCase();

  // Extract category keywords
  if (lower.match(/(financial|finance|revenue|profit|loss|income)/))
    metadata.category = "financial";
  else if (lower.match(/(marketing|campaign|advertising|social)/)) metadata.category = "marketing";
  else if (lower.match(/(strategy|plan|roadmap|vision)/)) metadata.category = "strategy";
  else if (lower.match(/(compliance|legal|regulation|policy)/)) metadata.category = "compliance";
  else if (lower.match(/(operation|process|workflow|procedure)/)) metadata.category = "operations";

  return metadata;
}

// ─── 3C. STRUCTURED SEARCH ──────────────────────────────────
// Search with metadata filtering
export async function structuredSearch(
  supabase: any,
  companyId: string,
  query: string,
  filters: {
    documentType?: string;
    year?: number;
    quarter?: string;
    category?: string;
  } = {},
  topK: number = 5,
): Promise<Array<{ content: string; document_name: string; metadata: Record<string, any> }>> {
  let dbQuery = supabase
    .from("document_chunks")
    .select("content, document_name, metadata")
    .eq("company_id", companyId);

  // Apply metadata filters
  if (filters.documentType) {
    dbQuery = dbQuery.eq("metadata->>'document_type'", filters.documentType);
  }
  if (filters.year) {
    dbQuery = dbQuery.eq("metadata->>'year'", filters.year.toString());
  }
  if (filters.quarter) {
    dbQuery = dbQuery.eq("metadata->>'quarter'", filters.quarter);
  }
  if (filters.category) {
    dbQuery = dbQuery.eq("metadata->>'category'", filters.category);
  }

  // Simple text search for now (in production, use embedding similarity)
  dbQuery = dbQuery.or(`content.ilike.%${query}%,document_name.ilike.%${query}%`);

  dbQuery = dbQuery.limit(topK);

  const { data, error } = await dbQuery;

  if (error) {
    console.error("Structured search error:", error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    content: row.content,
    document_name: row.document_name,
    metadata: row.metadata || {},
  }));
}

// ─── 3D. EMBED AND STORE DOCUMENT CHUNKS ─────────────────────
// Call this after inserting a document into company_documents
export async function embedAndStoreDocument(
  supabase: any,
  companyId: string,
  documentId: string,
  documentName: string,
  content: string,
) {
  const chunks = semanticChunkText(content, 2000, 200);
  console.log("Total chunks:", chunks.length);

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    let embedding: number[] = [];

    try {
      embedding = await embedText(chunk);
      console.log("Embedded chunk:", idx, "vector length:", embedding.length);
    } catch (e) {
      console.error(`Embedding failed for chunk ${idx}:`, e);
      continue;
    }

    // Extract metadata from document name
    const metadata = extractMetadataFromDocName(documentName);

    const result = await supabase.from("document_chunks").insert({
      company_id: companyId,
      document_id: documentId,
      document_name: documentName,
      chunk_index: idx,
      content: chunk,
      embedding: JSON.stringify(embedding),
      metadata,
    });
    console.log("Insert result for chunk", idx, ":", result.error);
  }
}

// ─── 4. SEMANTIC SEARCH ──────────────────────────────────────
// Returns top-K relevant chunks for a given query
export async function semanticSearch(
  supabase: any,
  companyId: string,
  query: string,
  topK = 5,
): Promise<{ content: string; document_name: string; similarity: number }[]> {
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(query);
  } catch {
    return []; // fallback gracefully if embedding fails
  }

  const { data, error } = await supabase.rpc("match_document_chunks", {
    p_company_id: companyId,
    p_embedding: JSON.stringify(queryEmbedding),
    p_match_count: topK,
  });

  if (error) {
    console.error("Semantic search error:", error.message);
    return [];
  }

  return data ?? [];
}

// ─── 5. EXTRACT KNOWLEDGE GRAPH ENTITIES ────────────────────
// Calls Gemini to extract (entity, relation, target) triples from text
export async function extractAndStoreGraph(
  supabase: any,
  companyId: string,
  documentName: string,
  content: string,
  provider: AIProvider = "nvidia",
) {
  // Only process first 8000 chars to keep costs low
  const snippet = content.slice(0, 8000);

  const raw = await aiChat(
    [
      {
        role: "system",
        content: `You are a knowledge graph extractor. Extract important entities and relationships from the text.
Return ONLY a valid JSON array. No explanation. No markdown. Example:
[
  {"entity": "Company ABC", "relation": "revenue", "target": "$5M in 2023"},
  {"entity": "CEO John", "relation": "leads", "target": "Company ABC"},
  {"entity": "Product X", "relation": "targets", "target": "SMB market"}
]
Extract up to 30 triples. Focus on: people, companies, numbers, dates, products, goals, risks.`,
      },
      {
        role: "user",
        content: snippet,
      },
    ],
    { provider },
  );

  if (!raw) return; // fail silently, graph is bonus

  let triples: { entity: string; relation: string; target: string }[] = [];
  try {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```json|```/g, "").trim();
    triples = JSON.parse(cleaned);
  } catch {
    return; // bad JSON, skip
  }

  if (!Array.isArray(triples) || triples.length === 0) return;

  const rows = triples
    .filter((t) => t.entity && t.relation && t.target)
    .map((t) => ({
      company_id: companyId,
      entity: String(t.entity).slice(0, 200),
      relation: String(t.relation).slice(0, 100),
      target: String(t.target).slice(0, 500),
      source_doc: documentName,
    }));

  if (rows.length > 0) {
    await supabase.from("knowledge_graph").insert(rows);
  }
}

// ─── 6. GRAPH SEARCH ─────────────────────────────────────────
// Find graph nodes related to keywords in the user's query
export async function graphSearch(
  supabase: any,
  companyId: string,
  query: string,
  limit = 20,
): Promise<{ entity: string; relation: string; target: string; source_doc: string }[]> {
  // Extract key words (simple: split, filter stop words, take first 5)
  const stopWords = new Set([
    "what",
    "is",
    "the",
    "a",
    "an",
    "of",
    "for",
    "and",
    "or",
    "how",
    "why",
    "when",
  ]);
  const keywords = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .slice(0, 5);

  if (keywords.length === 0) return [];

  // Build OR filter: entity OR target contains any keyword
  const filters = keywords
    .map((kw) => `entity.ilike.%${kw}%,target.ilike.%${kw}%,relation.ilike.%${kw}%`)
    .join(",");

  const { data, error } = await supabase
    .from("knowledge_graph")
    .select("entity, relation, target, source_doc")
    .eq("company_id", companyId)
    .or(filters)
    .limit(limit);

  if (error) {
    console.error("Graph search error:", error.message);
    return [];
  }

  return data ?? [];
}

// ─── 7. KEYWORD SEARCH (Hybrid RAG) ─────────────────────────
// Full-text keyword search for exact terms
export async function keywordSearch(
  supabase: any,
  companyId: string,
  query: string,
  topK = 5,
): Promise<{ content: string; document_name: string; rank: number }[]> {
  // Clean query for full-text search
  const cleanQuery = query
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .join(" & ");

  if (!cleanQuery) return [];

  const { data, error } = await supabase.rpc("keyword_search_chunks", {
    p_company_id: companyId,
    p_query: cleanQuery,
    p_match_count: topK,
  });

  if (error) {
    console.error("Keyword search error:", error.message);
    return [];
  }

  return data ?? [];
}

// ─── 8. RE-RANKER (Cohere) ────────────────────────────────────
// Re-ranks chunks by actual relevance to query
export async function rerankChunks(
  query: string,
  chunks: Array<{ content: string; document_name?: string; similarity?: number; rank?: number }>,
  topK: number = 8,
): Promise<Array<{ content: string; document_name?: string; relevance_score: number }>> {
  const apiKey = process.env.COHERE_API_KEY;

  // If no Cohere key, fall back to original order
  if (!apiKey || apiKey === "your-cohere-api-key-here") {
    console.warn("[rerank] No Cohere API key, using original order");
    return chunks.slice(0, topK).map((c, i) => ({
      ...c,
      relevance_score: 1 - i * 0.1,
    }));
  }

  // Deduplicate by content (first 100 chars)
  const seen = new Set<string>();
  const uniqueChunks = chunks.filter((c) => {
    const key = c.content.slice(0, 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (uniqueChunks.length === 0) return [];

  try {
    const response = await fetch("https://api.cohere.ai/v1/rerank", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        documents: uniqueChunks.map((c) => c.content),
        top_n: Math.min(topK, uniqueChunks.length),
        model: "rerank-english-v3.0",
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("[rerank] Cohere API error:", response.status, t.slice(0, 200));
      // Fallback: return original order
      return uniqueChunks.slice(0, topK).map((c, i) => ({
        ...c,
        relevance_score: 1 - i * 0.1,
      }));
    }

    const result = await response.json();
    const results = result.results || [];

    return results.map((r: any) => ({
      ...uniqueChunks[r.index],
      relevance_score: r.relevance_score,
    }));
  } catch (e: any) {
    console.error("[rerank] Failed:", e.message);
    // Fallback
    return uniqueChunks.slice(0, topK).map((c, i) => ({
      ...c,
      relevance_score: 1 - i * 0.1,
    }));
  }
}

// ─── 9. QUERY EXPANSION ──────────────────────────────────────
// Expands query with synonyms and related terms
export async function expandQuery(query: string, provider: AIProvider = "nvidia"): Promise<string> {
  try {
    const expanded = await aiChat(
      [
        {
          role: "system",
          content: `Expand this search query with synonyms and related terms.
Return ONLY the expanded query, nothing else.
Include: synonyms, industry terms, related concepts.
Keep it under 50 words.
Example: "revenue" → "revenue income earnings sales turnover financial performance"`,
        },
        { role: "user", content: query },
      ],
      { provider },
    );

    return (expanded || query).slice(0, 200); // Limit length
  } catch {
    return query;
  }
}

// ─── 10. COMBINED RAG PIPELINE ────────────────────────────────
// Full pipeline: expand → retrieve → rerank → select
// Optimized: runs Gemini embedding in parallel with expandQuery
export async function ragPipeline(
  supabase: any,
  companyId: string,
  query: string,
  options: {
    expandQuery?: boolean;
    rerankChunks?: boolean;
    maxChunks?: number;
  } = {},
): Promise<{
  chunks: Array<{ content: string; document_name?: string; relevance_score: number }>;
  graphNodes: any[];
  expandedQuery: string;
}> {
  const {
    expandQuery: shouldExpand = true,
    rerankChunks: shouldRerank = true,
    maxChunks = 8,
  } = options;

  // Step 1: Expand query AND pre-compute embedding in parallel
  // The embedding uses Gemini (fast), expandQuery uses NIM (slow) — run both at once
  const [expandedQuery, queryEmbedding] = await Promise.all([
    shouldExpand ? expandQuery(query) : Promise.resolve(query),
    (async () => {
      try {
        return await embedText(query);
      } catch {
        return null; // fallback: semanticSearch will compute its own embedding
      }
    })(),
  ]);

  // Step 2: Parallel retrieval (semantic uses pre-computed embedding if available)
  const [semanticChunks, keywordChunks, graphNodes] = await Promise.all([
    queryEmbedding
      ? semanticSearchWithEmbedding(supabase, companyId, queryEmbedding, 10)
      : semanticSearch(supabase, companyId, expandedQuery, 10),
    keywordSearch(supabase, companyId, expandedQuery, 10),
    graphSearch(supabase, companyId, expandedQuery, 20),
  ]);

  // Step 3: Merge and deduplicate
  const allChunks = [...semanticChunks, ...keywordChunks];

  // Step 4: Rerank
  const reranked = shouldRerank
    ? await rerankChunks(query, allChunks, maxChunks)
    : allChunks.slice(0, maxChunks).map((c, i) => ({
        ...c,
        relevance_score: 1 - i * 0.1,
      }));

  return {
    chunks: reranked,
    graphNodes,
    expandedQuery,
  };
}

// ─── 10B. SEMANTIC SEARCH WITH PRE-COMPUTED EMBEDDING ─────────
// Skips the Gemini embedding call if we already have the vector
async function semanticSearchWithEmbedding(
  supabase: any,
  companyId: string,
  embedding: number[],
  topK = 5,
): Promise<{ content: string; document_name: string; similarity: number }[]> {
  const { data, error } = await supabase.rpc("match_document_chunks", {
    p_company_id: companyId,
    p_embedding: JSON.stringify(embedding),
    p_match_count: topK,
  });

  if (error) {
    console.error("Semantic search error:", error.message);
    return [];
  }

  return data ?? [];
}
