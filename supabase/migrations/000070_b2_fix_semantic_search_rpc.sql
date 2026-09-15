-- Migration 070: B2 — Fix search_properties_semantic RPC
-- Phase 2C.B2 | 2026-09-15
--
-- PROBLEMS FIXED:
--   1. Referenced non-existent column p.fotos (column is p.images jsonb)
--   2. Return type id was uuid, must be text (property ids are text in schema)
--   3. Return types quartos/area/preco were integer, must be numeric (schema types)
--   4. Missing is_off_market=false filter — service-role client bypasses RLS,
--      so the filter MUST live inside the function body
--   5. SECURITY INVOKER ensures callers cannot escalate via this function
--
-- DROP + CREATE required: return types changed (fotos→images type differs, id type differs)
-- PostgreSQL rejects CREATE OR REPLACE when the return type signature changes.

BEGIN;

DROP FUNCTION IF EXISTS public.search_properties_semantic(
  vector, double precision, integer, text, integer, integer, integer
);

CREATE FUNCTION public.search_properties_semantic(
  query_embedding    vector,
  similarity_threshold double precision DEFAULT 0.7,
  match_count        integer           DEFAULT 15,
  filter_zona        text              DEFAULT NULL,
  filter_preco_min   integer           DEFAULT NULL,
  filter_preco_max   integer           DEFAULT NULL,
  filter_quartos     integer           DEFAULT NULL
)
RETURNS TABLE(
  id           text,
  nome         text,
  zona         text,
  preco        numeric,
  quartos      numeric,
  area         numeric,
  tipo         text,
  descricao    text,
  images       jsonb,
  similarity   double precision
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.nome,
    p.zona,
    p.preco,
    p.quartos,
    p.area,
    p.tipo,
    p.descricao,
    p.images,
    (1 - (p.embedding <=> query_embedding))::double precision AS similarity
  FROM public.properties p
  WHERE p.status = 'active'
    AND p.is_off_market = false
    AND p.embedding IS NOT NULL
    AND (1 - (p.embedding <=> query_embedding)) > similarity_threshold
    AND (filter_zona     IS NULL OR p.zona    ILIKE '%' || filter_zona || '%')
    AND (filter_preco_min IS NULL OR p.preco  >= filter_preco_min)
    AND (filter_preco_max IS NULL OR p.preco  <= filter_preco_max)
    AND (filter_quartos  IS NULL OR p.quartos >= filter_quartos)
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMIT;
