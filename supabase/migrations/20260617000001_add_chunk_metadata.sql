-- ============================================================
-- ADD METADATA FIELDS TO DOCUMENT_CHUNKS
-- Enables structured search by document type, date, agent, etc.
-- ============================================================

-- Add metadata columns to document_chunks
ALTER TABLE document_chunks
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add index for metadata queries
CREATE INDEX IF NOT EXISTS idx_document_chunks_metadata ON document_chunks USING GIN (metadata);

-- Add document type extraction function
CREATE OR REPLACE FUNCTION extract_document_type(doc_name TEXT)
RETURNS TEXT AS $$
BEGIN
  doc_name := LOWER(doc_name);
  
  IF doc_name ~ '\.(pdf)$' THEN RETURN 'pdf';
  ELSIF doc_name ~ '\.(doc|docx)$' THEN RETURN 'word';
  ELSIF doc_name ~ '\.(xls|xlsx|csv)$' THEN RETURN 'spreadsheet';
  ELSIF doc_name ~ '\.(ppt|pptx)$' THEN RETURN 'presentation';
  ELSIF doc_name ~ '\.(txt|md)$' THEN RETURN 'text';
  ELSIF doc_name ~ '\.(jpg|jpeg|png|gif)$' THEN RETURN 'image';
  ELSE RETURN 'other';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add function to extract metadata from document name
CREATE OR REPLACE FUNCTION extract_metadata_from_doc_name(doc_name TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB := '{}';
  doc_type TEXT;
  year_match TEXT[];
  quarter_match TEXT[];
BEGIN
  -- Extract document type
  doc_type := extract_document_type(doc_name);
  result := result || jsonb_build_object('document_type', doc_type);
  
  -- Extract year (e.g., 2024, 2025)
  year_match := regexp_matches(doc_name, '(20[0-9]{2})');
  IF year_match IS NOT NULL AND array_length(year_match, 1) > 0 THEN
    result := result || jsonb_build_object('year', year_match[1]::INTEGER);
  END IF;
  
  -- Extract quarter (e.g., Q1, Q2, Q3, Q4)
  quarter_match := regexp_matches(doc_name, '(Q[1-4])', 'i');
  IF quarter_match IS NOT NULL AND array_length(quarter_match, 1) > 0 THEN
    result := result || jsonb_build_object('quarter', UPPER(quarter_match[1]));
  END IF;
  
  -- Extract report type keywords
  IF doc_name ~ '(financial|finance|revenue|profit|loss|income)' THEN
    result := result || jsonb_build_object('category', 'financial');
  ELSIF doc_name ~ '(marketing|campaign|advertising|social)' THEN
    result := result || jsonb_build_object('category', 'marketing');
  ELSIF doc_name ~ '(strategy|plan|roadmap|vision)' THEN
    result := result || jsonb_build_object('category', 'strategy');
  ELSIF doc_name ~ '(compliance|legal|regulation|policy)' THEN
    result := result || jsonb_build_object('category', 'compliance');
  ELSIF doc_name ~ '(operation|process|workflow|procedure)' THEN
    result := result || jsonb_build_object('category', 'operations');
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing chunks with metadata
UPDATE document_chunks
SET metadata = extract_metadata_from_doc_name(document_name)
WHERE metadata = '{}' OR metadata IS NULL;

-- Add structured search function
CREATE OR REPLACE FUNCTION search_chunks_structured(
  p_company_id UUID,
  p_query TEXT,
  p_document_type TEXT DEFAULT NULL,
  p_year INTEGER DEFAULT NULL,
  p_quarter TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  document_name TEXT,
  document_id UUID,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_embedding FLOAT[];
BEGIN
  -- Get query embedding (simplified - in production use actual embedding)
  -- For now, use keyword matching with metadata filtering
  
  RETURN QUERY
  SELECT
    dc.id,
    dc.content,
    dc.document_name,
    dc.document_id,
    dc.metadata,
    CASE
      WHEN dc.document_name ILIKE '%' || p_query || '%' THEN 1.0
      WHEN dc.content ILIKE '%' || p_query || '%' THEN 0.8
      ELSE 0.5
    END as similarity
  FROM document_chunks dc
  WHERE dc.company_id = p_company_id
    AND (p_document_type IS NULL OR dc.metadata->>'document_type' = p_document_type)
    AND (p_year IS NULL OR (dc.metadata->>'year')::INTEGER = p_year)
    AND (p_quarter IS NULL OR dc.metadata->>'quarter' = p_quarter)
    AND (p_category IS NULL OR dc.metadata->>'category' = p_category)
  ORDER BY similarity DESC
  LIMIT p_match_count;
END;
$$;

-- Add comment
COMMENT ON FUNCTION search_chunks_structured IS 'Search document chunks with metadata filtering';