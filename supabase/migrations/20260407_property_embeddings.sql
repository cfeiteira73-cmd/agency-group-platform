-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create IVFFlat index for fast ANN search
CREATE INDEX IF NOT EXISTS properties_embedding_idx
  ON properties USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Function: semantic search — returns top-k most similar properties
CREATE OR REPLACE FUNCTION search_properties_semantic(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.7,
  match_count int DEFAULT 15,
  filter_zona text DEFAULT NULL,
  filter_preco_min int DEFAULT NULL,
  filter_preco_max int DEFAULT NULL,
  filter_quartos int DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  nome text,
  zona text,
  preco int,
  quartos int,
  area int,
  tipo text,
  descricao text,
  fotos text[],
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.nome, p.zona, p.preco, p.quartos, p.area, p.tipo, p.descricao, p.fotos,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM properties p
  WHERE
    p.status = 'active'
    AND p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) > similarity_threshold
    AND (filter_zona IS NULL OR p.zona ILIKE '%' || filter_zona || '%')
    AND (filter_preco_min IS NULL OR p.preco >= filter_preco_min)
    AND (filter_preco_max IS NULL OR p.preco <= filter_preco_max)
    AND (filter_quartos IS NULL OR p.quartos >= filter_quartos)
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function: generate and store property embedding (called after upsert)
CREATE OR REPLACE FUNCTION properties_needs_embedding()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Mark that embedding needs refresh by nulling it on description change
  IF (TG_OP = 'UPDATE' AND OLD.descricao IS DISTINCT FROM NEW.descricao) THEN
    NEW.embedding := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER properties_embedding_trigger
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION properties_needs_embedding();
