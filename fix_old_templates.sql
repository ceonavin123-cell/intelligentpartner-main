-- Update old templates (company_id = NULL) to have correct company_id
-- This matches templates to companies based on the report they're linked to

-- For templates created from chat auto-save, they should already have company_id
-- The issue is templates created via the old ReportGenerator that saved with NULL company_id

-- Option 1: Delete NULL company_id templates (they're duplicates anyway)
-- DELETE FROM public.report_templates WHERE company_id IS NULL;

-- Option 2: Set them to a default company (not ideal)
-- This is safer - just hide them via the policy (already done above)

SELECT id, slug, label, company_id FROM public.report_templates;
