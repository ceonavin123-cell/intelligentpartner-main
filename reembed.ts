// ============================================================
// FILE: reembed.ts (put in your project ROOT folder)
// Run with: bun reembed.ts
// Re-embeds all documents that have no chunks yet
// ============================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── CHUNK TEXT ──────────────────────────────────────────────
function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
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

// ─── EMBED TEXT ──────────────────────────────────────────────
async function embedText(text: string): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`;
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

// ─── MAIN ────────────────────────────────────────────────────
async function main() {
    console.log("🔍 Finding documents without embeddings...");

    const { data: docs, error } = await supabase
        .from("company_documents")
        .select("id, name, company_id, content")
        .not("content", "is", null);

    if (error) throw new Error(error.message);
    if (!docs || docs.length === 0) {
        console.log("✅ No documents found.");
        return;
    }

    // Filter only docs with no chunks
    const { data: chunked } = await supabase
        .from("document_chunks")
        .select("document_id");

    const chunkedIds = new Set((chunked ?? []).map((c: any) => c.document_id));
    const toEmbed = docs.filter((d: any) => !chunkedIds.has(d.id));

    console.log(`📄 Found ${toEmbed.length} documents to embed.`);

    for (const doc of toEmbed) {
        console.log(`\n⚙️  Processing: ${doc.name}`);
        const chunks = chunkText(doc.content, 500, 50);
        console.log(`   Chunks: ${chunks.length}`);

        for (let idx = 0; idx < chunks.length; idx++) {
            const chunk = chunks[idx];
            try {
                const embedding = await embedText(chunk);
                const { error: insertError } = await supabase.from("document_chunks").insert({
                    company_id: doc.company_id,
                    document_id: doc.id,
                    document_name: doc.name,
                    chunk_index: idx,
                    content: chunk,
                    embedding: JSON.stringify(embedding),
                });
                if (insertError) {
                    console.error(`   ❌ Insert error chunk ${idx}:`, insertError.message);
                } else {
                    console.log(`   ✅ Chunk ${idx + 1}/${chunks.length} done`);
                }
            } catch (e: any) {
                console.error(`   ❌ Embedding failed chunk ${idx}:`, e.message);
            }
        }

        // Also extract knowledge graph
        console.log(`   🕸️  Extracting knowledge graph...`);
        try {
            const snippet = doc.content.slice(0, 8000);
            const url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${GEMINI_API_KEY}` },
                body: JSON.stringify({
                    model: "gemini-2.5-flash",
                    messages: [
                        {
                            role: "system",
                            content: `Extract entities and relationships. Return ONLY a JSON array. No markdown. Example:
[{"entity":"Company ABC","relation":"revenue","target":"$5M in 2023"}]
Extract up to 30 triples. Focus on: people, companies, numbers, dates, products, goals, risks.`,
                        },
                        { role: "user", content: snippet },
                    ],
                }),
            });
            const json = await res.json();
            const raw = json.choices?.[0]?.message?.content ?? "[]";
            const cleaned = raw.replace(/```json|```/g, "").trim();
            const triples = JSON.parse(cleaned);
            if (Array.isArray(triples) && triples.length > 0) {
                const rows = triples
                    .filter((t: any) => t.entity && t.relation && t.target)
                    .map((t: any) => ({
                        company_id: doc.company_id,
                        entity: String(t.entity).slice(0, 200),
                        relation: String(t.relation).slice(0, 100),
                        target: String(t.target).slice(0, 500),
                        source_doc: doc.name,
                    }));
                await supabase.from("knowledge_graph").insert(rows);
                console.log(`   ✅ ${rows.length} graph triples added`);
            }
        } catch (e: any) {
            console.error(`   ❌ Graph extraction failed:`, e.message);
        }
    }

    console.log("\n🎉 All done! Re-embedding complete.");
}

main().catch(console.error);