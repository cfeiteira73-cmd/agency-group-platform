-- ============================================================
-- DIAGNOSTICO: O que existe vs o que falta
-- ============================================================

-- 1. Tabelas criticas
SELECT table_name, 'EXISTS' as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'offmarket_leads','contacts','market_price_refs',
  'buyer_match_results','agent_daily_discipline',
  'sofia_memory','alert_log','offmarket_lead_alerts'
)
ORDER BY table_name;

-- 2. Colunas criticas em offmarket_leads
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'offmarket_leads'
AND column_name IN (
  'score','master_attack_rank','deal_readiness_score',
  'cpcv_probability','buyer_pressure_class',
  'seller_intent_label','matched_buyers_count',
  'best_buyer_match_score','money_priority_score',
  'last_call_at','first_contact_at','first_meeting_at',
  'contact_attempts_count','call_done_today',
  'proposal_sent_at','last_action_type',
  'gross_discount_pct','price_per_m2_ref',
  'data_quality_score','execution_blocker_reason'
)
ORDER BY column_name;

-- 3. Contagem market_price_refs
SELECT COUNT(*) as market_price_refs_count FROM market_price_refs;

-- 4. Triggers activos
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY trigger_name;
