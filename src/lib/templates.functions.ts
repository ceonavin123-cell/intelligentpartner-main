import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listReportTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId?: string }) =>
    z.object({ companyId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("report_templates")
      .select("id,slug,label,description,brief,report_type,created_at,company_id")
      .order("created_at", { ascending: false });

    // Filter by company if provided — show ONLY company-specific templates
    if (data.companyId) {
      query = query.eq("company_id", data.companyId);
    }

    const { data: templates, error } = await query;
    if (error) throw new Error(error.message);
    return { templates: templates ?? [] };
  });

export const deleteReportTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: tpl, error: fetchErr } = await supabase
      .from("report_templates")
      .select("created_by")
      .eq("id", data.id)
      .single();

    if (fetchErr || !tpl || tpl.created_by !== userId) {
      throw new Error("Template not found or access denied");
    }

    const { error } = await supabase
      .from("report_templates")
      .delete()
      .eq("id", data.id);

    if (error) throw new Error("Failed to delete template");
    return { ok: true };
  });