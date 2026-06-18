-- Add company_id to report_templates to scope templates per company
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- Update RLS policies to scope by company
DROP POLICY IF EXISTS "auth read templates" ON public.report_templates;
CREATE POLICY "auth read templates" ON public.report_templates
  FOR SELECT TO authenticated
  USING (
    company_id IS NULL
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
  );

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_report_templates_company ON public.report_templates(company_id);
