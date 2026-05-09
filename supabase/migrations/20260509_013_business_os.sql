-- =============================================================================
-- Agency Group — Business Operating System: Phase 1
-- Migration: 20260509_013_business_os.sql
-- Tables: win_loss_events, adoption_events, data_quality_events,
--         nps_responses, performance_scorecards, client_milestones,
--         objection_taxonomy
-- =============================================================================

-- win_loss_events: capture deal outcomes + objection taxonomy
CREATE TABLE IF NOT EXISTS win_loss_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  agent_id TEXT NOT NULL, -- user email
  outcome TEXT NOT NULL CHECK (outcome IN ('won','lost','stalled','withdrawn')),
  reason_category TEXT NOT NULL, -- 'price','competitor','timing','financing','product_fit','relationship','other'
  reason_detail TEXT,
  objection_type TEXT, -- 'price_too_high','wrong_zone','wrong_type','bad_timing','competitor_preferred','financing_rejected','other'
  deal_value NUMERIC(14,2),
  commission_lost NUMERIC(12,2),
  days_in_pipeline INTEGER,
  stage_lost TEXT, -- pipeline stage where deal died
  competitor_name TEXT,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- adoption_events: track feature usage per user
CREATE TABLE IF NOT EXISTS adoption_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_role TEXT,
  feature_name TEXT NOT NULL, -- 'sofia_chat','deal_pack','match_engine','lead_score','calendar','bulk_whatsapp','export','avm','market_intel'
  action TEXT NOT NULL, -- 'viewed','used','completed','skipped'
  session_id TEXT,
  metadata JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- data_quality_events: record quality issues per record
CREATE TABLE IF NOT EXISTS data_quality_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_type TEXT NOT NULL, -- 'contact','deal','property'
  resource_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  issue_type TEXT NOT NULL, -- 'missing','invalid','stale','duplicate','anomaly'
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  current_value TEXT,
  suggested_value TEXT,
  auto_fixed BOOLEAN DEFAULT FALSE,
  fixed_at TIMESTAMPTZ,
  fixed_by TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- nps_responses: client satisfaction tracking
CREATE TABLE IF NOT EXISTS nps_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  agent_email TEXT,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  category TEXT GENERATED ALWAYS AS (
    CASE WHEN score >= 9 THEN 'promoter'
         WHEN score >= 7 THEN 'passive'
         ELSE 'detractor' END
  ) STORED,
  feedback TEXT,
  trigger_event TEXT, -- 'post_visit','post_cpcv','post_escritura','post_proposal'
  channel TEXT DEFAULT 'email', -- 'email','whatsapp','portal'
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- performance_scorecards: agent weekly/monthly performance snapshots
CREATE TABLE IF NOT EXISTS performance_scorecards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_email TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly','monthly','quarterly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  -- Activity metrics
  leads_worked INTEGER DEFAULT 0,
  contacts_created INTEGER DEFAULT 0,
  visits_conducted INTEGER DEFAULT 0,
  proposals_sent INTEGER DEFAULT 0,
  -- Conversion metrics
  deals_won INTEGER DEFAULT 0,
  deals_lost INTEGER DEFAULT 0,
  conversion_rate NUMERIC(5,2),
  -- Financial metrics
  gci_generated NUMERIC(14,2) DEFAULT 0,
  pipeline_value NUMERIC(14,2) DEFAULT 0,
  -- Quality metrics
  data_quality_score NUMERIC(5,2), -- 0-100
  platform_adoption_score NUMERIC(5,2), -- 0-100
  avg_response_time_hours NUMERIC(6,2),
  nps_score NUMERIC(5,2),
  -- Compliance
  sla_violations INTEGER DEFAULT 0,
  followup_compliance_pct NUMERIC(5,2),
  -- Rankings
  rank_this_period INTEGER,
  percentile NUMERIC(5,2),
  -- Score
  composite_score NUMERIC(5,2), -- weighted composite 0-100
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_email, period_type, period_start)
);

-- client_milestones: track key journey milestones for client transparency
CREATE TABLE IF NOT EXISTS client_milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  milestone_type TEXT NOT NULL, -- 'search_started','matches_sent','visit_scheduled','visit_done','proposal_sent','negotiation_started','cpcv_signed','escritura_done'
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  notified_client BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- objection_taxonomy: centralized objection register
CREATE TABLE IF NOT EXISTS objection_taxonomy (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL, -- 'price','timing','competitor','product','financing','relationship'
  objection TEXT NOT NULL,
  frequency INTEGER DEFAULT 0,
  best_response TEXT,
  script_en TEXT,
  script_pt TEXT,
  win_rate_when_encountered NUMERIC(5,2), -- % of deals won despite this objection
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE win_loss_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE adoption_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE objection_taxonomy ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all (service role bypasses RLS)
CREATE POLICY "Auth read win_loss" ON win_loss_events FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Auth read adoption" ON adoption_events FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Auth read data_quality" ON data_quality_events FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Auth read nps" ON nps_responses FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Auth read scorecards" ON performance_scorecards FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Auth read milestones" ON client_milestones FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Auth read objections" ON objection_taxonomy FOR SELECT TO authenticated USING (TRUE);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_wl_agent ON win_loss_events(agent_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_wl_outcome ON win_loss_events(outcome, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_adoption_user ON adoption_events(user_email, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_adoption_feature ON adoption_events(feature_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_dq_resource ON data_quality_events(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_dq_severity ON data_quality_events(severity, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_nps_agent ON nps_responses(agent_email, responded_at DESC);
CREATE INDEX IF NOT EXISTS idx_scorecard_agent ON performance_scorecards(agent_email, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_milestone_deal ON client_milestones(deal_id);

-- =============================================================================
-- SEED: Top 10 real estate objections (Portuguese)
-- =============================================================================

INSERT INTO objection_taxonomy (category, objection, best_response, script_pt, win_rate_when_encountered) VALUES
('price','O preço está acima do meu orçamento','Enquadrar no valor/m² vs mercado + opções de financiamento','Compreendo. Vamos analisar o valor por m²: este imóvel está a €X/m² vs €Y/m² de média na zona — está dentro do mercado. Existe também possibilidade de negociação de 3-5%. Posso ajudá-lo a explorar financiamento?', 35),
('timing','Não é o momento certo para comprar','Custo de espera: +17.6% YoY + euribor a baixar','O mercado subiu 17.6% em 2025. Cada mês de espera custa X em valorização perdida. Com euribor a descer, o custo de financiamento está a melhorar. O timing ideal é quando encontra o imóvel certo.',42),
('competitor','Encontrei algo semelhante mais barato','Análise comparativa detalhada + diferenciais exclusivos','Ótimo, comparemos os dois lado a lado. Posso fazer uma análise AVM completa dos dois imóveis em 24h — localização exata, estado, condomínio, e projeção de valorização a 3 anos.', 51),
('financing','Não consigo financiamento suficiente','Parceiros bancários + estruturas alternativas','Trabalho com 4 bancos parceiros que têm condições preferenciais para este ticket. Posso apresentá-los esta semana. Existem também estruturas CPCV diferido que podem ajudar.',38),
('product_fit','Não tem as características que procuro','Inventário off-market + configurações alternativas','Tenho acesso a imóveis off-market não listados publicamente. O que é inegociável para si? Muitas vezes consigo apresentar alternativas que batem as especificações em 2-3 semanas.',45),
('relationship','Prefiro trabalhar diretamente com o proprietário','AMI + proteção legal + valor da mediação','Trabalhar diretamente não é protegido legalmente. Como AMI 22506, garanto: escritura sem riscos, due diligence completa, e economiza em média 6% em negociação. O meu custo paga-se.',29),
('timing','Vou esperar que os preços caiam','Projeções de mercado + dados históricos PT','Portugal teve correção de preços em 2012-2015 — durou 4 anos. Desde 2019 temos crescimento contínuo. Com o NHR a atrair compradores internacionais e stock limitado, a probabilidade de queda significativa é baixa.',33),
('price','O condomínio/IMI é muito alto','ROI vs custo total de posse calculado','Vamos calcular o custo total de posse: IMI + condomínio vs rendimento estimado de AL ou valorização. Nesta zona o yield bruto é X%. O retorno supera os custos em Y meses.',44),
('other','Preciso de pensar','Urgência + custo de oportunidade específico','Claro. Para o ajudar a decidir: qual é a sua principal dúvida? Existe outro comprador interessado — posso reservar por 48h com sinal simbólico enquanto decide.',37),
('product_fit','Não gosto da zona','Educação da zona + dados de valorização + lifestyle','Esta zona valorizou X% nos últimos 3 anos vs Y% da zona preferida. Tem estas infra-estruturas: [lista]. Posso organizar uma visita à zona antes da visita ao imóvel?', 41)
ON CONFLICT DO NOTHING;
