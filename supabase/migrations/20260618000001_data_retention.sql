-- ============================================================
-- DATA RETENTION POLICY — Auto-delete old data
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Delete chat messages older than 90 days
-- (Keep thread structure, remove message content)
DELETE FROM public.chat_messages
WHERE created_at < now() - interval '90 days';

-- 2. Delete old audit/temporal snapshots older than 30 days
-- (If temporal_snapshots table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'temporal_snapshots') THEN
    DELETE FROM public.temporal_snapshots
    WHERE created_at < now() - interval '30 days';
  END IF;
END $$;

-- 3. Decay old memories (reduce weight over time)
-- Memories not accessed in 60 days get weight reduced
UPDATE public.semantic_memories
SET current_weight = current_weight * 0.5
WHERE last_accessed < now() - interval '60 days'
  AND current_weight > 0.1;

-- 4. Archive old reports older than 1 year
-- (Move to archive table or mark as archived)
-- Uncomment when archive table is created:
-- INSERT INTO public.reports_archive SELECT * FROM public.reports
-- WHERE created_at < now() - interval '1 year';
-- DELETE FROM public.reports WHERE created_at < now() - interval '1 year';

-- 5. Log retention stats
SELECT
  'chat_messages' as table_name,
  count(*) as remaining_rows,
  min(created_at) as oldest_row,
  max(created_at) as newest_row
FROM public.chat_messages
UNION ALL
SELECT
  'semantic_memories',
  count(*),
  min(created_at),
  max(created_at)
FROM public.semantic_memories
UNION ALL
SELECT
  'reports',
  count(*),
  min(created_at),
  max(created_at)
FROM public.reports;
