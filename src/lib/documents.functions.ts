// ============================================================
// FILE: src/lib/documents.functions.ts  (REPLACE YOUR EXISTING FILE)
// Added: embedAndStoreDocument + extractAndStoreGraph calls
// after document upload succeeds
// ============================================================

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { embedAndStoreDocument, extractAndStoreGraph } from "@/lib/rag.server"; // ← NEW

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_TEXT_CHARS = 60_000;

async function extractPdfText(filename: string, base64: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Extract ALL readable text and table data from this document as clean markdown. Preserve headings, lists and tables. Do not summarize.`,
            },
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64,
              },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PDF extract ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export const uploadCompanyDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { companyId: string; name: string; mime: string; base64?: string; text?: string }) =>
      z
        .object({
          companyId: z.string().uuid(),
          name: z.string().min(1).max(255),
          mime: z.string().min(1).max(200),
          base64: z.string().optional(),
          text: z.string().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let content = "";
    let sizeBytes = 0;

    if (data.text) {
      content = data.text;
      sizeBytes = new TextEncoder().encode(content).length;
    } else if (data.base64) {
      const buf = Buffer.from(data.base64, "base64");
      sizeBytes = buf.length;
      if (sizeBytes > MAX_BYTES) throw new Error("File exceeds 8MB limit");

      if (data.mime === "application/pdf") {
        content = await extractPdfText(data.name, data.base64);
      } else if (data.mime.startsWith("text/") || data.mime === "application/json") {
        content = buf.toString("utf8");
      } else {
        throw new Error(`Unsupported file type: ${data.mime}. Use PDF or plain text.`);
      }
    } else {
      throw new Error("No file content provided");
    }

    content = content.slice(0, MAX_TEXT_CHARS);
    if (!content.trim()) throw new Error("Could not extract any text from the file");

    const { data: row, error } = await supabase
      .from("company_documents")
      .insert({
        company_id: data.companyId,
        name: data.name,
        mime: data.mime,
        size_bytes: sizeBytes,
        content,
      })
      .select("id,name,mime,size_bytes,created_at")
      .single();
    if (error) throw new Error(error.message);

    // ── RAG: embed chunks in background (don't await — keeps upload fast) ──
    try {
      await embedAndStoreDocument(supabase, data.companyId, row.id, data.name, content);
      console.log("RAG embedding SUCCESS");
    } catch (e) {
      console.error("RAG embedding FAILED:", e);
    }

    // ── GraphRAG: extract knowledge graph triples in background ─────────────
    extractAndStoreGraph(supabase, data.companyId, data.name, content).catch((e) =>
      console.error("GraphRAG extraction failed:", e),
    );

    return { document: row };
  });

export const deleteCompanyDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Also delete chunks and graph nodes for this document
    await Promise.all([
      supabase.from("document_chunks").delete().eq("document_id", data.id),
      // Note: knowledge_graph rows are kept (no document_id FK) — they remain useful
    ]);

    const { error } = await supabase.from("company_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });