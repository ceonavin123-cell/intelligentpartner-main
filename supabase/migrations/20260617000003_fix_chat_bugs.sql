-- ============================================================
-- FIX CHAT BUGS — Schema changes + dev seed data
-- ============================================================

-- Schema: Add missing columns to companies (needed for all environments)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS token_limit INT DEFAULT 100000;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS token_used INT DEFAULT 0;

-- Schema: Fix FK constraint (needed for all environments)
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_owner_id_fkey;
ALTER TABLE public.companies ADD CONSTRAINT companies_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================
-- DEV ONLY: Seed data below — DO NOT run in production
-- Guard: only inserts if the dev user doesn't already exist
-- ============================================================

DO $$
BEGIN
  -- Only create dev user if it doesn't exist (safe to run multiple times)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000000') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, 
      email_confirmed_at, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'dev@example.com', crypt('dev-password', gen_salt('bf')),
      now(), now(), now()
    );
  END IF;

  -- Create profile if not exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000000') THEN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES ('00000000-0000-0000-0000-000000000000', 'dev@example.com', 'Dev User');
  END IF;

  -- Create demo company if not exists
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = '11111111-1111-1111-1111-111111111111') THEN
    INSERT INTO public.companies (id, owner_id, name, industry, description, status, token_limit, token_used)
    VALUES (
      '11111111-1111-1111-1111-111111111111',
      '00000000-0000-0000-0000-000000000000',
      'Demo Company',
      'Technology',
      'A demo company for testing the AI consulting platform.',
      'ready',
      100000,
      0
    );
  END IF;

  -- Create welcome chat thread if not exists
  IF NOT EXISTS (SELECT 1 FROM public.chat_threads WHERE id = '22222222-2222-2222-2222-222222222222') THEN
    INSERT INTO public.chat_threads (id, company_id, title)
    VALUES (
      '22222222-2222-2222-2222-222222222222',
      '11111111-1111-1111-1111-111111111111',
      'Welcome Chat'
    );
  END IF;
END $$;
