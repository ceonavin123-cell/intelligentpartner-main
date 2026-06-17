-- ============================================================
-- SEED DATA: Dev mode mock data
-- WARNING: This is for development only — do not run in production
-- ============================================================

-- Insert mock user profile
INSERT INTO public.profiles (id, email, full_name)
VALUES ('00000000-0000-0000-0000-000000000000', 'dev@example.com', 'Dev User')
ON CONFLICT (id) DO NOTHING;

-- Insert default company for mock user
INSERT INTO public.companies (id, owner_id, name, industry, description, status)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'Demo Company',
  'Technology',
  'A demo company for testing the AI consulting platform.',
  'ready'
)
ON CONFLICT (id) DO NOTHING;

-- Insert default chat thread
INSERT INTO public.chat_threads (id, company_id, title)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Welcome Chat'
)
ON CONFLICT (id) DO NOTHING;
