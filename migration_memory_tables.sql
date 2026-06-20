-- ============================================================
-- GEOMETRIC MEMORY TABLES
-- These tables support the intelligence score and memory system
-- ============================================================

-- Semantic memories (insights extracted from conversations)
CREATE TABLE IF NOT EXISTS public.semantic_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent TEXT NOT NULL DEFAULT 'orchestrator',
  category TEXT NOT NULL DEFAULT 'fact',
  content TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  source TEXT NOT NULL DEFAULT 'chat',
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS semantic_memories_company_idx ON public.semantic_memories(company_id);
CREATE INDEX IF NOT EXISTS semantic_memories_category_idx ON public.semantic_memories(company_id, category);
CREATE INDEX IF NOT EXISTS semantic_memories_created_idx ON public.semantic_memories(company_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.semantic_memories TO authenticated;
GRANT ALL ON public.semantic_memories TO service_role;
ALTER TABLE public.semantic_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage semantic memories" ON public.semantic_memories FOR ALL
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));

-- Memory connections (links between related memories)
CREATE TABLE IF NOT EXISTS public.memory_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_memory_id UUID NOT NULL REFERENCES public.semantic_memories(id) ON DELETE CASCADE,
  target_memory_id UUID NOT NULL REFERENCES public.semantic_memories(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'related',
  strength REAL NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_connections_company_idx ON public.memory_connections(company_id);
CREATE INDEX IF NOT EXISTS memory_connections_source_idx ON public.memory_connections(source_memory_id);
CREATE INDEX IF NOT EXISTS memory_connections_target_idx ON public.memory_connections(target_memory_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_connections TO authenticated;
GRANT ALL ON public.memory_connections TO service_role;
ALTER TABLE public.memory_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage memory connections" ON public.memory_connections FOR ALL
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));

-- Procedural memories (patterns and procedures learned)
CREATE TABLE IF NOT EXISTS public.procedural_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pattern_text TEXT NOT NULL,
  pattern_type TEXT NOT NULL DEFAULT 'general',
  confidence REAL NOT NULL DEFAULT 0.5,
  times_observed INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS procedural_memories_company_idx ON public.procedural_memories(company_id);
CREATE INDEX IF NOT EXISTS procedural_memories_active_idx ON public.procedural_memories(company_id, is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedural_memories TO authenticated;
GRANT ALL ON public.procedural_memories TO service_role;
ALTER TABLE public.procedural_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage procedural memories" ON public.procedural_memories FOR ALL
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));

-- Intelligence score tracking
CREATE TABLE IF NOT EXISTS public.intelligence_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0,
  memories INT NOT NULL DEFAULT 0,
  connections INT NOT NULL DEFAULT 0,
  patterns INT NOT NULL DEFAULT 0,
  avg_confidence REAL NOT NULL DEFAULT 0,
  days_active INT NOT NULL DEFAULT 1,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intelligence_scores_company_idx ON public.intelligence_scores(company_id, calculated_at DESC);

GRANT SELECT, INSERT ON public.intelligence_scores TO authenticated;
GRANT ALL ON public.intelligence_scores TO service_role;
ALTER TABLE public.intelligence_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read intelligence scores" ON public.intelligence_scores FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));

CREATE POLICY "service manage intelligence scores" ON public.intelligence_scores FOR ALL
  USING (auth.role() = 'service_role');
