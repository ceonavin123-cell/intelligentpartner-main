
-- ============================================================
-- GEOMETRIC MEMORY SYSTEM
-- Layer 1: Episodic (existing agent_memory)
-- Layer 2: Semantic (new — extracted insights)
-- Layer 3: Procedural (new — learned patterns)
-- ============================================================

-- Layer 2: Semantic Memories (extracted insights from conversations)
CREATE TABLE IF NOT EXISTS public.semantic_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent text NOT NULL DEFAULT 'orchestrator',
  category text NOT NULL DEFAULT 'fact',
  content text NOT NULL,
  source text NOT NULL DEFAULT 'chat',
  confidence numeric NOT NULL DEFAULT 0.7,
  decay_rate numeric NOT NULL DEFAULT 0.02,
  current_weight numeric NOT NULL NULL DEFAULT 1.0,
  embedding text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz NOT NULL DEFAULT now(),
  access_count integer NOT NULL DEFAULT 0
);

CREATE INDEX semantic_memories_company_idx ON public.semantic_memories(company_id);
CREATE INDEX semantic_memories_category_idx ON public.semantic_memories(company_id, category);
CREATE INDEX semantic_memories_weight_idx ON public.semantic_memories(current_weight DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.semantic_memories TO authenticated;
GRANT ALL ON public.semantic_memories TO service_role;
ALTER TABLE public.semantic_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage semantic memories" ON public.semantic_memories
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));

-- Layer 3: Procedural Memories (learned patterns)
CREATE TABLE IF NOT EXISTS public.procedural_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pattern_type text NOT NULL DEFAULT 'trend',
  pattern_text text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric NOT NULL NULL DEFAULT 0.5,
  times_observed integer NOT NULL NULL DEFAULT 1,
  first_observed_at timestamptz NOT NULL NULL DEFAULT now(),
  last_observed_at timestamptz NOT NULL NULL DEFAULT now(),
  is_active boolean NOT NULL NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX procedural_memories_company_idx ON public.procedural_memories(company_id);
CREATE INDEX procedural_memories_type_idx ON public.procedural_memories(company_id, pattern_type);
CREATE INDEX procedural_memories_active_idx ON public.procedural_memories(company_id, is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedural_memories TO authenticated;
GRANT ALL ON public.procedural_memories TO service_role;
ALTER TABLE public.procedural_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage procedural memories" ON public.procedural_memories
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));

-- Memory Connections (links between memories)
CREATE TABLE IF NOT EXISTS public.memory_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_memory_id uuid NOT NULL,
  source_memory_type text NOT NULL,
  target_memory_id uuid NOT NULL,
  target_memory_type text NOT NULL,
  connection_type text NOT NULL NULL DEFAULT 'related',
  strength numeric NOT NULL NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX memory_connections_company_idx ON public.memory_connections(company_id);
CREATE INDEX memory_connections_source_idx ON public.memory_connections(source_memory_id, source_memory_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_connections TO authenticated;
GRANT ALL ON public.memory_connections TO service_role;
ALTER TABLE public.memory_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage memory connections" ON public.memory_connections
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));

-- Intelligence Score (tracks company intelligence over time)
CREATE TABLE IF NOT EXISTS public.intelligence_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  total_memories integer NOT NULL NULL DEFAULT 0,
  semantic_count integer NOT NULL NULL DEFAULT 0,
  procedural_count integer NOT NULL NULL DEFAULT 0,
  connection_count integer NOT NULL NULL DEFAULT 0,
  avg_confidence numeric NOT NULL NULL DEFAULT 0,
  intelligence_score numeric NOT NULL NULL DEFAULT 0,
  predictions_made integer NOT NULL NULL DEFAULT 0,
  risks_flagged integer NOT NULL NULL DEFAULT 0,
  calculated_at timestamptz NOT NULL NULL DEFAULT now()
);

CREATE INDEX intelligence_scores_company_idx ON public.intelligence_scores(company_id, calculated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intelligence_scores TO authenticated;
GRANT ALL ON public.intelligence_scores TO service_role;
ALTER TABLE public.intelligence_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage intelligence scores" ON public.intelligence_scores
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));

-- Add triggers for updated_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_semantic_memories_updated') THEN
    CREATE TRIGGER trg_semantic_memories_updated BEFORE UPDATE ON public.semantic_memories
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_procedural_memories_updated') THEN
    CREATE TRIGGER trg_procedural_memories_updated BEFORE UPDATE ON public.procedural_memories
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
