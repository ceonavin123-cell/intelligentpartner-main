-- Fix: Only show templates with matching company_id (exclude NULL)
DROP POLICY IF EXISTS "auth read templates" ON public.report_templates;
CREATE POLICY "auth read templates" ON public.report_templates
  FOR SELECT TO authenticated
  USING (
    company_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
  );

-- Also: Update the reports query to filter by company_id
-- The reports table already has company_id, so that should work
