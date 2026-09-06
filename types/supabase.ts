export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      absolute_ml_reports: {
        Row: {
          blockers: Json
          created_at: string
          drift_significant_count: number
          generated_at: string
          id: number
          leakage_detected_count: number
          ml_truth_grade: string
          ml_truth_hash: string
          models_certified: number
          models_evaluated: number
          overall_score: number
          overfit_detected_count: number
          report_id: string
          report_json: Json
          tenant_id: string
        }
        Insert: {
          blockers?: Json
          created_at?: string
          drift_significant_count?: number
          generated_at?: string
          id?: number
          leakage_detected_count?: number
          ml_truth_grade?: string
          ml_truth_hash: string
          models_certified?: number
          models_evaluated?: number
          overall_score?: number
          overfit_detected_count?: number
          report_id?: string
          report_json?: Json
          tenant_id: string
        }
        Update: {
          blockers?: Json
          created_at?: string
          drift_significant_count?: number
          generated_at?: string
          id?: number
          leakage_detected_count?: number
          ml_truth_grade?: string
          ml_truth_hash?: string
          models_certified?: number
          models_evaluated?: number
          overall_score?: number
          overfit_detected_count?: number
          report_id?: string
          report_json?: Json
          tenant_id?: string
        }
        Relationships: []
      }
      absolute_resilience_reports: {
        Row: {
          blockers: Json
          chaos_env_required: boolean
          created_at: string
          generated_at: string
          id: number
          overall_score: number
          proven_count: number
          report_id: string
          report_json: Json
          resilience_grade: string
          resilience_hash: string
          rpo_compliant_count: number
          rto_compliant_count: number
          tenant_id: string
          total_scenarios: number
        }
        Insert: {
          blockers?: Json
          chaos_env_required?: boolean
          created_at?: string
          generated_at?: string
          id?: number
          overall_score?: number
          proven_count?: number
          report_id?: string
          report_json?: Json
          resilience_grade?: string
          resilience_hash: string
          rpo_compliant_count?: number
          rto_compliant_count?: number
          tenant_id: string
          total_scenarios?: number
        }
        Update: {
          blockers?: Json
          chaos_env_required?: boolean
          created_at?: string
          generated_at?: string
          id?: number
          overall_score?: number
          proven_count?: number
          report_id?: string
          report_json?: Json
          resilience_grade?: string
          resilience_hash?: string
          rpo_compliant_count?: number
          rto_compliant_count?: number
          tenant_id?: string
          total_scenarios?: number
        }
        Relationships: []
      }
      absolute_security_reports: {
        Row: {
          blockers: Json
          created_at: string
          forensic_chain_valid: boolean
          generated_at: string
          id: number
          open_sev1_count: number
          overall_score: number
          owasp_passed: number
          owasp_total: number
          red_team_mitigated: number
          red_team_total: number
          report_id: string
          report_json: Json
          security_grade: string
          security_hash: string
          tenant_id: string
        }
        Insert: {
          blockers?: Json
          created_at?: string
          forensic_chain_valid?: boolean
          generated_at?: string
          id?: number
          open_sev1_count?: number
          overall_score?: number
          owasp_passed?: number
          owasp_total?: number
          red_team_mitigated?: number
          red_team_total?: number
          report_id?: string
          report_json?: Json
          security_grade?: string
          security_hash: string
          tenant_id: string
        }
        Update: {
          blockers?: Json
          created_at?: string
          forensic_chain_valid?: boolean
          generated_at?: string
          id?: number
          open_sev1_count?: number
          overall_score?: number
          owasp_passed?: number
          owasp_total?: number
          red_team_mitigated?: number
          red_team_total?: number
          report_id?: string
          report_json?: Json
          security_grade?: string
          security_hash?: string
          tenant_id?: string
        }
        Relationships: []
      }
      absolute_system_audits: {
        Row: {
          audit_grade: string
          audit_hash: string
          audit_id: string
          blockers: Json
          created_at: string
          critical_findings: number
          dimensions_checked: number
          dimensions_failed: number
          dimensions_passed: number
          generated_at: string
          high_findings: number
          id: number
          overall_score: number
          reality_coverage_pct: number
          report_json: Json
          system_truth_score: number
          tenant_id: string
          total_findings: number
          w51_system_score: number
          warnings: Json
        }
        Insert: {
          audit_grade?: string
          audit_hash: string
          audit_id?: string
          blockers?: Json
          created_at?: string
          critical_findings?: number
          dimensions_checked?: number
          dimensions_failed?: number
          dimensions_passed?: number
          generated_at?: string
          high_findings?: number
          id?: number
          overall_score?: number
          reality_coverage_pct?: number
          report_json?: Json
          system_truth_score?: number
          tenant_id: string
          total_findings?: number
          w51_system_score?: number
          warnings?: Json
        }
        Update: {
          audit_grade?: string
          audit_hash?: string
          audit_id?: string
          blockers?: Json
          created_at?: string
          critical_findings?: number
          dimensions_checked?: number
          dimensions_failed?: number
          dimensions_passed?: number
          generated_at?: string
          high_findings?: number
          id?: number
          overall_score?: number
          reality_coverage_pct?: number
          report_json?: Json
          system_truth_score?: number
          tenant_id?: string
          total_findings?: number
          w51_system_score?: number
          warnings?: Json
        }
        Relationships: []
      }
      acquisition_opportunities: {
        Row: {
          asking_price_eur: number
          asset_type: string
          country: string
          created_at: string
          detected_at: string
          discount_pct: number
          duplicate_flag: boolean
          duplicate_of: string | null
          estimated_market_value_eur: number
          gross_yield_pct: number | null
          id: number
          lead_score: number
          location: string
          notes: string
          opportunity_id: string
          opportunity_score: number
          source_id: string
          source_type: string
          stage: string
          status: string
          tenant_id: string
          title: string
          urgency_score: number
        }
        Insert: {
          asking_price_eur?: number
          asset_type?: string
          country?: string
          created_at?: string
          detected_at?: string
          discount_pct?: number
          duplicate_flag?: boolean
          duplicate_of?: string | null
          estimated_market_value_eur?: number
          gross_yield_pct?: number | null
          id?: number
          lead_score?: number
          location: string
          notes?: string
          opportunity_id?: string
          opportunity_score?: number
          source_id: string
          source_type: string
          stage?: string
          status?: string
          tenant_id: string
          title: string
          urgency_score?: number
        }
        Update: {
          asking_price_eur?: number
          asset_type?: string
          country?: string
          created_at?: string
          detected_at?: string
          discount_pct?: number
          duplicate_flag?: boolean
          duplicate_of?: string | null
          estimated_market_value_eur?: number
          gross_yield_pct?: number | null
          id?: number
          lead_score?: number
          location?: string
          notes?: string
          opportunity_id?: string
          opportunity_score?: number
          source_id?: string
          source_type?: string
          stage?: string
          status?: string
          tenant_id?: string
          title?: string
          urgency_score?: number
        }
        Relationships: []
      }
      acquisition_pipeline_snapshots: {
        Row: {
          avg_opportunity_score: number
          duplicates_detected: number
          generated_at: string
          id: number
          pipeline_hash: string
          pipeline_id: string
          report_json: Json
          tenant_id: string
          total_opportunities: number
        }
        Insert: {
          avg_opportunity_score?: number
          duplicates_detected?: number
          generated_at?: string
          id?: number
          pipeline_hash: string
          pipeline_id?: string
          report_json?: Json
          tenant_id: string
          total_opportunities?: number
        }
        Update: {
          avg_opportunity_score?: number
          duplicates_detected?: number
          generated_at?: string
          id?: number
          pipeline_hash?: string
          pipeline_id?: string
          report_json?: Json
          tenant_id?: string
          total_opportunities?: number
        }
        Relationships: []
      }
      acquisition_sources: {
        Row: {
          contact_email: string | null
          contact_url: string | null
          country: string
          created_at: string
          deal_frequency: string
          id: number
          last_deal_at: string | null
          max_ticket_eur: number
          min_ticket_eur: number
          name: string
          notes: string
          reliability_score: number
          response_time_days: number
          source_id: string
          status: string
          tenant_id: string
          type: string
        }
        Insert: {
          contact_email?: string | null
          contact_url?: string | null
          country?: string
          created_at?: string
          deal_frequency?: string
          id?: number
          last_deal_at?: string | null
          max_ticket_eur?: number
          min_ticket_eur?: number
          name: string
          notes?: string
          reliability_score?: number
          response_time_days?: number
          source_id: string
          status?: string
          tenant_id: string
          type: string
        }
        Update: {
          contact_email?: string | null
          contact_url?: string | null
          country?: string
          created_at?: string
          deal_frequency?: string
          id?: number
          last_deal_at?: string | null
          max_ticket_eur?: number
          min_ticket_eur?: number
          name?: string
          notes?: string
          reliability_score?: number
          response_time_days?: number
          source_id?: string
          status?: string
          tenant_id?: string
          type?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          agent_id: string | null
          body: string | null
          contact_id: number | null
          created_at: string
          deal_id: number | null
          duration: number | null
          id: string
          is_automated: boolean
          metadata: Json | null
          note: string | null
          occurred_at: string
          outcome: string | null
          source_url: string | null
          subject: string | null
          type: string
        }
        Insert: {
          agent_id?: string | null
          body?: string | null
          contact_id?: number | null
          created_at?: string
          deal_id?: number | null
          duration?: number | null
          id?: string
          is_automated?: boolean
          metadata?: Json | null
          note?: string | null
          occurred_at?: string
          outcome?: string | null
          source_url?: string | null
          subject?: string | null
          type: string
        }
        Update: {
          agent_id?: string | null
          body?: string | null
          contact_id?: number | null
          created_at?: string
          deal_id?: number | null
          duration?: number | null
          id?: string
          is_automated?: boolean
          metadata?: Json | null
          note?: string | null
          occurred_at?: string
          outcome?: string | null
          source_url?: string | null
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_match_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_buyer_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memory: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          key: string
          scope: string
          tenant_id: string
          ttl_days: number | null
          updated_at: string
          value: Json
          version: number
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          key: string
          scope: string
          tenant_id: string
          ttl_days?: number | null
          updated_at?: string
          value: Json
          version?: number
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          key?: string
          scope?: string
          tenant_id?: string
          ttl_days?: number | null
          updated_at?: string
          value?: Json
          version?: number
        }
        Relationships: []
      }
      agents: {
        Row: {
          active: boolean
          calls: number
          conversao: number
          created_at: string
          deals_fechados: number
          dias_ciclo: number
          email: string | null
          emails: number
          full_name: string
          gci_mes: number
          gci_ytd: number
          id: string
          phone: string | null
          pipeline: number
          propostas: number
          score: number
          updated_at: string
          visitas: number
        }
        Insert: {
          active?: boolean
          calls?: number
          conversao?: number
          created_at?: string
          deals_fechados?: number
          dias_ciclo?: number
          email?: string | null
          emails?: number
          full_name: string
          gci_mes?: number
          gci_ytd?: number
          id?: string
          phone?: string | null
          pipeline?: number
          propostas?: number
          score?: number
          updated_at?: string
          visitas?: number
        }
        Update: {
          active?: boolean
          calls?: number
          conversao?: number
          created_at?: string
          deals_fechados?: number
          dias_ciclo?: number
          email?: string | null
          emails?: number
          full_name?: string
          gci_mes?: number
          gci_ytd?: number
          id?: string
          phone?: string | null
          pipeline?: number
          propostas?: number
          score?: number
          updated_at?: string
          visitas?: number
        }
        Relationships: []
      }
      ai_audit_log: {
        Row: {
          circuit_name: string
          correlation_id: string
          created_at: string
          error_type: string | null
          fallback_used: boolean
          id: string
          input_tokens: number | null
          latency_ms: number
          model: string
          output_tokens: number | null
          revenue_context: string | null
          success: boolean
        }
        Insert: {
          circuit_name: string
          correlation_id: string
          created_at?: string
          error_type?: string | null
          fallback_used: boolean
          id?: string
          input_tokens?: number | null
          latency_ms: number
          model: string
          output_tokens?: number | null
          revenue_context?: string | null
          success: boolean
        }
        Update: {
          circuit_name?: string
          correlation_id?: string
          created_at?: string
          error_type?: string | null
          fallback_used?: boolean
          id?: string
          input_tokens?: number | null
          latency_ms?: number
          model?: string
          output_tokens?: number | null
          revenue_context?: string | null
          success?: boolean
        }
        Relationships: []
      }
      ai_feedback: {
        Row: {
          agent_id: string
          correlation_id: string
          created_at: string
          decision_summary: string | null
          feedback_source: string
          human_action: string | null
          id: string
          metadata: Json | null
          revenue_outcome: number | null
          success_score: number | null
          tenant_id: string
        }
        Insert: {
          agent_id: string
          correlation_id: string
          created_at?: string
          decision_summary?: string | null
          feedback_source: string
          human_action?: string | null
          id?: string
          metadata?: Json | null
          revenue_outcome?: number | null
          success_score?: number | null
          tenant_id: string
        }
        Update: {
          agent_id?: string
          correlation_id?: string
          created_at?: string
          decision_summary?: string | null
          feedback_source?: string
          human_action?: string | null
          id?: string
          metadata?: Json | null
          revenue_outcome?: number | null
          success_score?: number | null
          tenant_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          contact_id: number | null
          created_at: string | null
          event_type: string
          id: number
          metadata: Json | null
          property_id: string | null
          user_id: string | null
        }
        Insert: {
          contact_id?: number | null
          created_at?: string | null
          event_type: string
          id?: number
          metadata?: Json | null
          property_id?: string | null
          user_id?: string | null
        }
        Update: {
          contact_id?: number | null
          created_at?: string | null
          event_type?: string
          id?: number
          metadata?: Json | null
          property_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      anomaly_baselines: {
        Row: {
          baseline_key: string
          ema_value: number
          last_updated: string
          sample_count: number
        }
        Insert: {
          baseline_key: string
          ema_value?: number
          last_updated?: string
          sample_count?: number
        }
        Update: {
          baseline_key?: string
          ema_value?: number
          last_updated?: string
          sample_count?: number
        }
        Relationships: []
      }
      asel_certifications: {
        Row: {
          capital_safe: boolean
          cert_hash: string
          cert_id: string
          generated_at: string
          id: number
          log_valid: boolean
          overall_status: string
          red_team_score: number
          report_json: Json
          tenant_id: string
          vault_status: string
        }
        Insert: {
          capital_safe?: boolean
          cert_hash: string
          cert_id?: string
          generated_at?: string
          id?: number
          log_valid?: boolean
          overall_status?: string
          red_team_score?: number
          report_json?: Json
          tenant_id: string
          vault_status?: string
        }
        Update: {
          capital_safe?: boolean
          cert_hash?: string
          cert_id?: string
          generated_at?: string
          id?: number
          log_valid?: boolean
          overall_status?: string
          red_team_score?: number
          report_json?: Json
          tenant_id?: string
          vault_status?: string
        }
        Relationships: []
      }
      asel_defense_runs: {
        Row: {
          actions_json: Json
          capital_frozen: boolean
          event_type: string
          id: number
          incident_id: string
          processed_at: string
          risk_level: string
          risk_score: number
          soc_triggered: boolean
          tenant_id: string
        }
        Insert: {
          actions_json?: Json
          capital_frozen?: boolean
          event_type: string
          id?: number
          incident_id?: string
          processed_at?: string
          risk_level?: string
          risk_score?: number
          soc_triggered?: boolean
          tenant_id: string
        }
        Update: {
          actions_json?: Json
          capital_frozen?: boolean
          event_type?: string
          id?: number
          incident_id?: string
          processed_at?: string
          risk_level?: string
          risk_score?: number
          soc_triggered?: boolean
          tenant_id?: string
        }
        Relationships: []
      }
      asel_healing_log: {
        Row: {
          action: string
          anomaly_type: string
          created_at: string
          healed: boolean
          healing_id: string
          id: number
          tenant_id: string
        }
        Insert: {
          action: string
          anomaly_type: string
          created_at?: string
          healed?: boolean
          healing_id?: string
          id?: number
          tenant_id: string
        }
        Update: {
          action?: string
          anomaly_type?: string
          created_at?: string
          healed?: boolean
          healing_id?: string
          id?: number
          tenant_id?: string
        }
        Relationships: []
      }
      asset_opportunities: {
        Row: {
          asset_id: string
          country: string
          created_at: string
          deal_probability: number
          exclusive: boolean
          execution_priority: number
          gross_yield_pct: number | null
          id: number
          liquidity_score: number
          location: string
          net_yield_pct: number | null
          off_market: boolean
          price_eur: number
          risk_score: number
          status: string
          tenant_id: string
          type: string
        }
        Insert: {
          asset_id?: string
          country?: string
          created_at?: string
          deal_probability?: number
          exclusive?: boolean
          execution_priority?: number
          gross_yield_pct?: number | null
          id?: number
          liquidity_score?: number
          location: string
          net_yield_pct?: number | null
          off_market?: boolean
          price_eur?: number
          risk_score?: number
          status?: string
          tenant_id: string
          type?: string
        }
        Update: {
          asset_id?: string
          country?: string
          created_at?: string
          deal_probability?: number
          exclusive?: boolean
          execution_priority?: number
          gross_yield_pct?: number | null
          id?: number
          liquidity_score?: number
          location?: string
          net_yield_pct?: number | null
          off_market?: boolean
          price_eur?: number
          risk_score?: number
          status?: string
          tenant_id?: string
          type?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_type: string
          correlation_id: string | null
          correlation_id_text: string | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          result: string
          risk_level: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_type: string
          correlation_id?: string | null
          correlation_id_text?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          result: string
          risk_level?: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_type?: string
          correlation_id?: string | null
          correlation_id_text?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          result?: string
          risk_level?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      auto_model_updates: {
        Row: {
          completed_at: string | null
          created_at: string
          from_version: string
          id: string
          initiated_at: string
          metrics_snapshot: Json | null
          model_name: string
          status: string
          to_version: string
          trigger_reason: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          from_version: string
          id?: string
          initiated_at?: string
          metrics_snapshot?: Json | null
          model_name: string
          status?: string
          to_version: string
          trigger_reason?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          from_version?: string
          id?: string
          initiated_at?: string
          metrics_snapshot?: Json | null
          model_name?: string
          status?: string
          to_version?: string
          trigger_reason?: string | null
        }
        Relationships: []
      }
      capital_finalization_log: {
        Row: {
          amount_eur_cents: number
          approved_at: string
          id: number
          idempotency_key: string
          settlement_state: string
          tx_id: string
          verdict: string
        }
        Insert: {
          amount_eur_cents?: number
          approved_at?: string
          id?: number
          idempotency_key: string
          settlement_state: string
          tx_id: string
          verdict?: string
        }
        Update: {
          amount_eur_cents?: number
          approved_at?: string
          id?: number
          idempotency_key?: string
          settlement_state?: string
          tx_id?: string
          verdict?: string
        }
        Relationships: []
      }
      capital_freeze_log: {
        Row: {
          auto_resolved: boolean
          freeze_id: string
          frozen_at: string
          id: number
          reason: string
          resolved_at: string | null
          scope: string
        }
        Insert: {
          auto_resolved?: boolean
          freeze_id?: string
          frozen_at?: string
          id?: number
          reason: string
          resolved_at?: string | null
          scope: string
        }
        Update: {
          auto_resolved?: boolean
          freeze_id?: string
          frozen_at?: string
          id?: number
          reason?: string
          resolved_at?: string | null
          scope?: string
        }
        Relationships: []
      }
      capital_matches: {
        Row: {
          asset_id: string
          created_at: string
          deal_probability: number
          execution_priority: number
          grade: string
          id: number
          match_id: string
          match_type: string
          overall_score: number
          profile_id: string
          recommendation: string
          report_id: string | null
          tenant_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          deal_probability?: number
          execution_priority?: number
          grade?: string
          id?: number
          match_id: string
          match_type: string
          overall_score?: number
          profile_id: string
          recommendation?: string
          report_id?: string | null
          tenant_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          deal_probability?: number
          execution_priority?: number
          grade?: string
          id?: number
          match_id?: string
          match_type?: string
          overall_score?: number
          profile_id?: string
          recommendation?: string
          report_id?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      capital_matching_reports: {
        Row: {
          avg_score: number
          coverage_pct: number
          generated_at: string
          id: number
          matching_hash: string
          perfect_matches: number
          report_id: string
          report_json: Json
          tenant_id: string
          total_matches: number
        }
        Insert: {
          avg_score?: number
          coverage_pct?: number
          generated_at?: string
          id?: number
          matching_hash: string
          perfect_matches?: number
          report_id?: string
          report_json?: Json
          tenant_id: string
          total_matches?: number
        }
        Update: {
          avg_score?: number
          coverage_pct?: number
          generated_at?: string
          id?: number
          matching_hash?: string
          perfect_matches?: number
          report_id?: string
          report_json?: Json
          tenant_id?: string
          total_matches?: number
        }
        Relationships: []
      }
      capital_profiles: {
        Row: {
          budget_max_eur: number
          budget_min_eur: number
          buying_power_est: string | null
          capital_score: number | null
          company: string | null
          connector_score: number | null
          consent_status: string | null
          contact_status: string | null
          contactability_score: number | null
          country_iso: string | null
          created_at: string
          crm_pipeline: string | null
          currency: string
          deal_score: number | null
          do_not_contact: boolean | null
          email: string | null
          full_name: string | null
          hot_score: number | null
          id: number
          influence_score: number | null
          investment_horizon_months: number
          kyc_status: string
          lead_id: string | null
          linkedin: string | null
          liquidity_preference: string
          manual_review: boolean | null
          name: string
          newsletter_segment: string | null
          next_action: string | null
          outreach_type: string | null
          owner: string | null
          persona_type: string | null
          preferred_asset_types: Json
          preferred_locations: Json
          priority_level: number | null
          profile_id: string
          risk_tolerance: string
          sofia_sequence: string | null
          target_yield_max_pct: number
          target_yield_min_pct: number
          tenant_id: string
          tier: string | null
          title: string | null
          total_score: number | null
          type: string
          verified: boolean
        }
        Insert: {
          budget_max_eur?: number
          budget_min_eur?: number
          buying_power_est?: string | null
          capital_score?: number | null
          company?: string | null
          connector_score?: number | null
          consent_status?: string | null
          contact_status?: string | null
          contactability_score?: number | null
          country_iso?: string | null
          created_at?: string
          crm_pipeline?: string | null
          currency?: string
          deal_score?: number | null
          do_not_contact?: boolean | null
          email?: string | null
          full_name?: string | null
          hot_score?: number | null
          id?: number
          influence_score?: number | null
          investment_horizon_months?: number
          kyc_status?: string
          lead_id?: string | null
          linkedin?: string | null
          liquidity_preference?: string
          manual_review?: boolean | null
          name?: string
          newsletter_segment?: string | null
          next_action?: string | null
          outreach_type?: string | null
          owner?: string | null
          persona_type?: string | null
          preferred_asset_types?: Json
          preferred_locations?: Json
          priority_level?: number | null
          profile_id?: string
          risk_tolerance?: string
          sofia_sequence?: string | null
          target_yield_max_pct?: number
          target_yield_min_pct?: number
          tenant_id: string
          tier?: string | null
          title?: string | null
          total_score?: number | null
          type?: string
          verified?: boolean
        }
        Update: {
          budget_max_eur?: number
          budget_min_eur?: number
          buying_power_est?: string | null
          capital_score?: number | null
          company?: string | null
          connector_score?: number | null
          consent_status?: string | null
          contact_status?: string | null
          contactability_score?: number | null
          country_iso?: string | null
          created_at?: string
          crm_pipeline?: string | null
          currency?: string
          deal_score?: number | null
          do_not_contact?: boolean | null
          email?: string | null
          full_name?: string | null
          hot_score?: number | null
          id?: number
          influence_score?: number | null
          investment_horizon_months?: number
          kyc_status?: string
          lead_id?: string | null
          linkedin?: string | null
          liquidity_preference?: string
          manual_review?: boolean | null
          name?: string
          newsletter_segment?: string | null
          next_action?: string | null
          outreach_type?: string | null
          owner?: string | null
          persona_type?: string | null
          preferred_asset_types?: Json
          preferred_locations?: Json
          priority_level?: number | null
          profile_id?: string
          risk_tolerance?: string
          sofia_sequence?: string | null
          target_yield_max_pct?: number
          target_yield_min_pct?: number
          tenant_id?: string
          tier?: string | null
          title?: string | null
          total_score?: number | null
          type?: string
          verified?: boolean
        }
        Relationships: []
      }
      causal_trace: {
        Row: {
          action: string | null
          agent_id: string | null
          correlation_id: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          latency_ms: number | null
          metadata: Json | null
          model: string | null
          revenue_delta: number | null
          step_type: string
          success: boolean
          tenant_id: string
        }
        Insert: {
          action?: string | null
          agent_id?: string | null
          correlation_id: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          model?: string | null
          revenue_delta?: number | null
          step_type: string
          success?: boolean
          tenant_id?: string
        }
        Update: {
          action?: string | null
          agent_id?: string | null
          correlation_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          model?: string | null
          revenue_delta?: number | null
          step_type?: string
          success?: boolean
          tenant_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          country: string | null
          created_at: string
          domain: string | null
          domain_source: string | null
          id: string
          linkedin_url: string | null
          market: string | null
          name: string
          name_normalized: string | null
          updated_at: string
          website: string | null
          website_confidence: number | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          domain?: string | null
          domain_source?: string | null
          id?: string
          linkedin_url?: string | null
          market?: string | null
          name: string
          name_normalized?: string | null
          updated_at?: string
          website?: string | null
          website_confidence?: number | null
        }
        Update: {
          country?: string | null
          created_at?: string
          domain?: string | null
          domain_source?: string | null
          id?: string
          linkedin_url?: string | null
          market?: string | null
          name?: string
          name_normalized?: string | null
          updated_at?: string
          website?: string | null
          website_confidence?: number | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          active_status: string | null
          agent_email: string | null
          agent_id: string | null
          assigned_at: string | null
          assigned_to: string | null
          avg_close_days: number | null
          budget_max: number | null
          budget_min: number | null
          buyer_bedrooms: number[] | null
          buyer_budget_max: number | null
          buyer_budget_min: number | null
          buyer_features: string[] | null
          buyer_financing: boolean | null
          buyer_fiscal_address: string | null
          buyer_max_area: number | null
          buyer_min_area: number | null
          buyer_nationality: string | null
          buyer_nif: string | null
          buyer_notes: string | null
          buyer_passport: string | null
          buyer_preapproval: boolean | null
          buyer_purpose: string | null
          buyer_score: number | null
          buyer_score_reason: string | null
          buyer_scored_at: string | null
          buyer_tier: string | null
          buyer_timeline: string | null
          buyer_type: string | null
          buyer_typologies: string[] | null
          created_at: string | null
          deals_closed_count: number | null
          deals_referido_count: number | null
          email: string | null
          email_verified: boolean | null
          financing_type: string | null
          first_response_at: string | null
          full_name: string | null
          id: number
          is_seller: boolean | null
          language: string | null
          last_contact: string | null
          last_contact_at: string | null
          lead_score: number | null
          lead_score_breakdown: Json | null
          lead_scored_at: string | null
          lead_tier: Database["public"]["Enums"]["lead_tier"] | null
          liquidity_profile: string | null
          mandate_expiry: string | null
          mandate_type: string | null
          name: string
          nationality: string | null
          negotiation_style: string | null
          next_followup_at: string | null
          notes: string | null
          origin: string | null
          page_url: string | null
          phone: string | null
          phone_verified: boolean | null
          preferred_contact_time: string | null
          preferred_locations: string[] | null
          proof_of_funds_status: string | null
          reliability_score: number | null
          response_rate: number | null
          role: string | null
          score: number | null
          seller_asking_price: number | null
          seller_notes: string | null
          seller_property_ref: string | null
          seller_property_type: string | null
          seller_stage: string | null
          seller_urgency: string | null
          seller_zona: string | null
          source: string | null
          source_channel: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscribed_at: string | null
          subscription_plan: string | null
          subscription_status: string | null
          target_strategy: string | null
          tasks: Json | null
          ticket_preference: string | null
          timeline: string | null
          tipos: Json | null
          total_interactions: number | null
          typologies_wanted: string[] | null
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_landing: string | null
          utm_medium: string | null
          utm_raw: Json | null
          utm_source: string | null
          utm_term: string | null
          volume_referido: number | null
          whatsapp: string | null
          zonas: Json | null
        }
        Insert: {
          active_status?: string | null
          agent_email?: string | null
          agent_id?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          avg_close_days?: number | null
          budget_max?: number | null
          budget_min?: number | null
          buyer_bedrooms?: number[] | null
          buyer_budget_max?: number | null
          buyer_budget_min?: number | null
          buyer_features?: string[] | null
          buyer_financing?: boolean | null
          buyer_fiscal_address?: string | null
          buyer_max_area?: number | null
          buyer_min_area?: number | null
          buyer_nationality?: string | null
          buyer_nif?: string | null
          buyer_notes?: string | null
          buyer_passport?: string | null
          buyer_preapproval?: boolean | null
          buyer_purpose?: string | null
          buyer_score?: number | null
          buyer_score_reason?: string | null
          buyer_scored_at?: string | null
          buyer_tier?: string | null
          buyer_timeline?: string | null
          buyer_type?: string | null
          buyer_typologies?: string[] | null
          created_at?: string | null
          deals_closed_count?: number | null
          deals_referido_count?: number | null
          email?: string | null
          email_verified?: boolean | null
          financing_type?: string | null
          first_response_at?: string | null
          full_name?: string | null
          id?: number
          is_seller?: boolean | null
          language?: string | null
          last_contact?: string | null
          last_contact_at?: string | null
          lead_score?: number | null
          lead_score_breakdown?: Json | null
          lead_scored_at?: string | null
          lead_tier?: Database["public"]["Enums"]["lead_tier"] | null
          liquidity_profile?: string | null
          mandate_expiry?: string | null
          mandate_type?: string | null
          name: string
          nationality?: string | null
          negotiation_style?: string | null
          next_followup_at?: string | null
          notes?: string | null
          origin?: string | null
          page_url?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          preferred_contact_time?: string | null
          preferred_locations?: string[] | null
          proof_of_funds_status?: string | null
          reliability_score?: number | null
          response_rate?: number | null
          role?: string | null
          score?: number | null
          seller_asking_price?: number | null
          seller_notes?: string | null
          seller_property_ref?: string | null
          seller_property_type?: string | null
          seller_stage?: string | null
          seller_urgency?: string | null
          seller_zona?: string | null
          source?: string | null
          source_channel?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscribed_at?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          target_strategy?: string | null
          tasks?: Json | null
          ticket_preference?: string | null
          timeline?: string | null
          tipos?: Json | null
          total_interactions?: number | null
          typologies_wanted?: string[] | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_landing?: string | null
          utm_medium?: string | null
          utm_raw?: Json | null
          utm_source?: string | null
          utm_term?: string | null
          volume_referido?: number | null
          whatsapp?: string | null
          zonas?: Json | null
        }
        Update: {
          active_status?: string | null
          agent_email?: string | null
          agent_id?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          avg_close_days?: number | null
          budget_max?: number | null
          budget_min?: number | null
          buyer_bedrooms?: number[] | null
          buyer_budget_max?: number | null
          buyer_budget_min?: number | null
          buyer_features?: string[] | null
          buyer_financing?: boolean | null
          buyer_fiscal_address?: string | null
          buyer_max_area?: number | null
          buyer_min_area?: number | null
          buyer_nationality?: string | null
          buyer_nif?: string | null
          buyer_notes?: string | null
          buyer_passport?: string | null
          buyer_preapproval?: boolean | null
          buyer_purpose?: string | null
          buyer_score?: number | null
          buyer_score_reason?: string | null
          buyer_scored_at?: string | null
          buyer_tier?: string | null
          buyer_timeline?: string | null
          buyer_type?: string | null
          buyer_typologies?: string[] | null
          created_at?: string | null
          deals_closed_count?: number | null
          deals_referido_count?: number | null
          email?: string | null
          email_verified?: boolean | null
          financing_type?: string | null
          first_response_at?: string | null
          full_name?: string | null
          id?: number
          is_seller?: boolean | null
          language?: string | null
          last_contact?: string | null
          last_contact_at?: string | null
          lead_score?: number | null
          lead_score_breakdown?: Json | null
          lead_scored_at?: string | null
          lead_tier?: Database["public"]["Enums"]["lead_tier"] | null
          liquidity_profile?: string | null
          mandate_expiry?: string | null
          mandate_type?: string | null
          name?: string
          nationality?: string | null
          negotiation_style?: string | null
          next_followup_at?: string | null
          notes?: string | null
          origin?: string | null
          page_url?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          preferred_contact_time?: string | null
          preferred_locations?: string[] | null
          proof_of_funds_status?: string | null
          reliability_score?: number | null
          response_rate?: number | null
          role?: string | null
          score?: number | null
          seller_asking_price?: number | null
          seller_notes?: string | null
          seller_property_ref?: string | null
          seller_property_type?: string | null
          seller_stage?: string | null
          seller_urgency?: string | null
          seller_zona?: string | null
          source?: string | null
          source_channel?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscribed_at?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          target_strategy?: string | null
          tasks?: Json | null
          ticket_preference?: string | null
          timeline?: string | null
          tipos?: Json | null
          total_interactions?: number | null
          typologies_wanted?: string[] | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_landing?: string | null
          utm_medium?: string | null
          utm_raw?: Json | null
          utm_source?: string | null
          utm_term?: string | null
          volume_referido?: number | null
          whatsapp?: string | null
          zonas?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_model_snapshots: {
        Row: {
          ai_cost_eur: number
          breakdown: Json | null
          computed_at: string
          id: string
          infra_cost_eur: number
          margin_pct: number | null
          period_end: string
          period_start: string
          revenue_eur: number
          storage_cost_eur: number
          tenant_id: string
          total_cost_eur: number
        }
        Insert: {
          ai_cost_eur?: number
          breakdown?: Json | null
          computed_at?: string
          id?: string
          infra_cost_eur?: number
          margin_pct?: number | null
          period_end: string
          period_start: string
          revenue_eur?: number
          storage_cost_eur?: number
          tenant_id: string
          total_cost_eur?: number
        }
        Update: {
          ai_cost_eur?: number
          breakdown?: Json | null
          computed_at?: string
          id?: string
          infra_cost_eur?: number
          margin_pct?: number | null
          period_end?: string
          period_start?: string
          revenue_eur?: number
          storage_cost_eur?: number
          tenant_id?: string
          total_cost_eur?: number
        }
        Relationships: []
      }
      crm_followups: {
        Row: {
          channel: string
          context: string | null
          deal_id: number | null
          generated_at: string | null
          id: string
          language: string | null
          message: string
          sent_at: string | null
          status: string | null
        }
        Insert: {
          channel: string
          context?: string | null
          deal_id?: number | null
          generated_at?: string | null
          id?: string
          language?: string | null
          message: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          channel?: string
          context?: string | null
          deal_id?: number | null
          generated_at?: string | null
          id?: string
          language?: string | null
          message?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_followups_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          deal_id: number | null
          description: string | null
          due_date: string
          id: string
          priority: string | null
          status: string | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: number | null
          description?: string | null
          due_date: string
          id?: string
          priority?: string | null
          status?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: number | null
          description?: string | null
          due_date?: string
          id?: string
          priority?: string | null
          status?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_truth_reports: {
        Row: {
          blockers: Json
          created_at: string
          critical_stale_count: number
          full_coverage_pct: number
          generated_at: string
          id: number
          overall_score: number
          report_id: string
          report_json: Json
          stale_count: number
          tenant_id: string
          total_panels: number
          truth_grade: string
          truth_hash: string
        }
        Insert: {
          blockers?: Json
          created_at?: string
          critical_stale_count?: number
          full_coverage_pct?: number
          generated_at?: string
          id?: number
          overall_score?: number
          report_id?: string
          report_json?: Json
          stale_count?: number
          tenant_id: string
          total_panels?: number
          truth_grade?: string
          truth_hash: string
        }
        Update: {
          blockers?: Json
          created_at?: string
          critical_stale_count?: number
          full_coverage_pct?: number
          generated_at?: string
          id?: number
          overall_score?: number
          report_id?: string
          report_json?: Json
          stale_count?: number
          tenant_id?: string
          total_panels?: number
          truth_grade?: string
          truth_hash?: string
        }
        Relationships: []
      }
      deal_packs: {
        Row: {
          ai_summary: string | null
          created_at: string | null
          created_by: string | null
          deal_id: number | null
          financial_projections: Json | null
          generated_at: string | null
          heygen_script: string | null
          highlights: Json | null
          id: string
          investment_thesis: string | null
          lead_id: number | null
          market_summary: string | null
          match_id: string | null
          metadata: Json | null
          notes: string | null
          opportunity_score: number | null
          pdf_url: string | null
          property_id: string | null
          sent_at: string | null
          sent_to: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          view_count: number | null
          viewed_at: string | null
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: number | null
          financial_projections?: Json | null
          generated_at?: string | null
          heygen_script?: string | null
          highlights?: Json | null
          id?: string
          investment_thesis?: string | null
          lead_id?: number | null
          market_summary?: string | null
          match_id?: string | null
          metadata?: Json | null
          notes?: string | null
          opportunity_score?: number | null
          pdf_url?: string | null
          property_id?: string | null
          sent_at?: string | null
          sent_to?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          view_count?: number | null
          viewed_at?: string | null
        }
        Update: {
          ai_summary?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: number | null
          financial_projections?: Json | null
          generated_at?: string | null
          heygen_script?: string | null
          highlights?: Json | null
          id?: string
          investment_thesis?: string | null
          lead_id?: number | null
          market_summary?: string | null
          match_id?: string | null
          metadata?: Json | null
          notes?: string | null
          opportunity_score?: number | null
          pdf_url?: string | null
          property_id?: string | null
          sent_at?: string | null
          sent_to?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          view_count?: number | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_packs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_packs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "buyer_match_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_packs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_packs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_packs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_packs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "contacts_buyer_audit"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stage_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          deal_id: number | null
          id: string
          reason: string | null
          stage: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          deal_id?: number | null
          id?: string
          reason?: string | null
          stage: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          deal_id?: number | null
          id?: string
          reason?: string | null
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          agent_id: string | null
          checklist: Json | null
          comprador: string | null
          contact_id: number | null
          cpcv_date: string | null
          cpcv_date_text: string | null
          created_at: string | null
          deal_room: Json | null
          escritura_date: string | null
          escritura_date_text: string | null
          expected_fee: number | null
          fase: string
          fee_type: string | null
          id: number
          imovel: string
          last_activity_at: string | null
          lead_score: number | null
          notas: string | null
          partner_fee_pct: number | null
          partner_id: string | null
          property_id: string | null
          realized_fee: number | null
          ref: string
          scored_at: string | null
          updated_at: string | null
          valor: string
          zone: string | null
        }
        Insert: {
          agent_id?: string | null
          checklist?: Json | null
          comprador?: string | null
          contact_id?: number | null
          cpcv_date?: string | null
          cpcv_date_text?: string | null
          created_at?: string | null
          deal_room?: Json | null
          escritura_date?: string | null
          escritura_date_text?: string | null
          expected_fee?: number | null
          fase: string
          fee_type?: string | null
          id?: number
          imovel: string
          last_activity_at?: string | null
          lead_score?: number | null
          notas?: string | null
          partner_fee_pct?: number | null
          partner_id?: string | null
          property_id?: string | null
          realized_fee?: number | null
          ref: string
          scored_at?: string | null
          updated_at?: string | null
          valor: string
          zone?: string | null
        }
        Update: {
          agent_id?: string | null
          checklist?: Json | null
          comprador?: string | null
          contact_id?: number | null
          cpcv_date?: string | null
          cpcv_date_text?: string | null
          created_at?: string | null
          deal_room?: Json | null
          escritura_date?: string | null
          escritura_date_text?: string | null
          expected_fee?: number | null
          fase?: string
          fee_type?: string | null
          id?: number
          imovel?: string
          last_activity_at?: string | null
          lead_score?: number | null
          notas?: string | null
          partner_fee_pct?: number | null
          partner_id?: string | null
          property_id?: string | null
          realized_fee?: number | null
          ref?: string
          scored_at?: string | null
          updated_at?: string | null
          valor?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_match_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_buyer_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "institutional_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_feedback_weights: {
        Row: {
          acceptance_weight: number
          composite_weight: number
          conversion_weight: number
          created_at: string
          outcome_class: string | null
          recipient_email: string
          recommended_action: string | null
          speed_weight: number
          updated_at: string
        }
        Insert: {
          acceptance_weight?: number
          composite_weight?: number
          conversion_weight?: number
          created_at?: string
          outcome_class?: string | null
          recipient_email: string
          recommended_action?: string | null
          speed_weight?: number
          updated_at?: string
        }
        Update: {
          acceptance_weight?: number
          composite_weight?: number
          conversion_weight?: number
          created_at?: string
          outcome_class?: string | null
          recipient_email?: string
          recommended_action?: string | null
          speed_weight?: number
          updated_at?: string
        }
        Relationships: []
      }
      dr_activations: {
        Row: {
          activated_at: string
          activation_id: string
          detail_json: Json
          id: number
          soc_notified: boolean
          tenant_id: string
          trigger_status: string
        }
        Insert: {
          activated_at?: string
          activation_id?: string
          detail_json?: Json
          id?: number
          soc_notified?: boolean
          tenant_id: string
          trigger_status: string
        }
        Update: {
          activated_at?: string
          activation_id?: string
          detail_json?: Json
          id?: number
          soc_notified?: boolean
          tenant_id?: string
          trigger_status?: string
        }
        Relationships: []
      }
      economic_signals: {
        Row: {
          context: Json | null
          entity_id: string
          entity_type: string
          id: string
          ingested_at: string
          noise_score: number | null
          normalized_value: number | null
          org_id: string
          passed_filter: boolean
          raw_value: number
          signal_id: string
          source: string
        }
        Insert: {
          context?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ingested_at?: string
          noise_score?: number | null
          normalized_value?: number | null
          org_id: string
          passed_filter?: boolean
          raw_value: number
          signal_id: string
          source: string
        }
        Update: {
          context?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ingested_at?: string
          noise_score?: number | null
          normalized_value?: number | null
          org_id?: string
          passed_filter?: boolean
          raw_value?: number
          signal_id?: string
          source?: string
        }
        Relationships: []
      }
      economic_truth_events: {
        Row: {
          asset_class: string
          avm_accuracy_score: number
          avm_error_pct: number | null
          created_at: string
          deal_id: string | null
          distribution_event_id: string | null
          id: string
          negotiation_delta_pct: number | null
          negotiation_score: number
          normalized_truth_score: number | null
          price_band: string
          property_id: string
          raw_truth_score: number
          routing_efficiency_score: number
          routing_precision_pct: number | null
          spread_error_pct: number | null
          spread_vs_predicted_score: number
          time_to_close_score: number
          zone_key: string
        }
        Insert: {
          asset_class: string
          avm_accuracy_score: number
          avm_error_pct?: number | null
          created_at?: string
          deal_id?: string | null
          distribution_event_id?: string | null
          id?: string
          negotiation_delta_pct?: number | null
          negotiation_score: number
          normalized_truth_score?: number | null
          price_band: string
          property_id: string
          raw_truth_score: number
          routing_efficiency_score: number
          routing_precision_pct?: number | null
          spread_error_pct?: number | null
          spread_vs_predicted_score: number
          time_to_close_score: number
          zone_key: string
        }
        Update: {
          asset_class?: string
          avm_accuracy_score?: number
          avm_error_pct?: number | null
          created_at?: string
          deal_id?: string | null
          distribution_event_id?: string | null
          id?: string
          negotiation_delta_pct?: number | null
          negotiation_score?: number
          normalized_truth_score?: number | null
          price_band?: string
          property_id?: string
          raw_truth_score?: number
          routing_efficiency_score?: number
          routing_precision_pct?: number | null
          spread_error_pct?: number | null
          spread_vs_predicted_score?: number
          time_to_close_score?: number
          zone_key?: string
        }
        Relationships: []
      }
      enrichment_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          enrichment_type: string
          id: string
          lead_id: string
          provider: string
          raw_response: Json | null
          result_summary: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          enrichment_type: string
          id?: string
          lead_id: string
          provider: string
          raw_response?: Json | null
          result_summary?: string | null
          success: boolean
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          enrichment_type?: string
          id?: string
          lead_id?: string
          provider?: string
          raw_response?: Json | null
          result_summary?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      event_history: {
        Row: {
          correlation_id: string
          created_at: string
          event_id: string
          event_type: string
          id: string
          idempotency_key: string | null
          payload: Json | null
          published_at: string
          source_system: string | null
          tenant_id: string
          version: number
        }
        Insert: {
          correlation_id: string
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          payload?: Json | null
          published_at?: string
          source_system?: string | null
          tenant_id?: string
          version?: number
        }
        Update: {
          correlation_id?: string
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          payload?: Json | null
          published_at?: string
          source_system?: string | null
          tenant_id?: string
          version?: number
        }
        Relationships: []
      }
      exports: {
        Row: {
          created_at: string
          filename: string
          filters_json: Json | null
          id: string
          lead_count: number
          market: string | null
          persona: string | null
        }
        Insert: {
          created_at?: string
          filename: string
          filters_json?: Json | null
          id?: string
          lead_count?: number
          market?: string | null
          persona?: string | null
        }
        Update: {
          created_at?: string
          filename?: string
          filters_json?: Json | null
          id?: string
          lead_count?: number
          market?: string | null
          persona?: string | null
        }
        Relationships: []
      }
      failover_log: {
        Row: {
          duration_ms: number | null
          failover_id: string
          from_region: string
          id: string
          metadata: Json | null
          outcome: string | null
          resolved_at: string | null
          started_at: string
          to_region: string
          trigger: string
        }
        Insert: {
          duration_ms?: number | null
          failover_id: string
          from_region: string
          id?: string
          metadata?: Json | null
          outcome?: string | null
          resolved_at?: string | null
          started_at?: string
          to_region: string
          trigger: string
        }
        Update: {
          duration_ms?: number | null
          failover_id?: string
          from_region?: string
          id?: string
          metadata?: Json | null
          outcome?: string | null
          resolved_at?: string | null
          started_at?: string
          to_region?: string
          trigger?: string
        }
        Relationships: []
      }
      final_production_certifications: {
        Row: {
          blended_score: number
          blockers: Json
          cert_valid_until: string | null
          created_at: string
          final_status: string
          gate_pass_pct: number
          gates_failed: number
          gates_passed: number
          generated_at: string
          go_live_authorized: boolean
          id: number
          production_hash: string
          report_id: string
          report_json: Json
          tenant_id: string
          total_gates: number
          w52_gates_passed: number
        }
        Insert: {
          blended_score?: number
          blockers?: Json
          cert_valid_until?: string | null
          created_at?: string
          final_status?: string
          gate_pass_pct?: number
          gates_failed?: number
          gates_passed?: number
          generated_at?: string
          go_live_authorized?: boolean
          id?: number
          production_hash: string
          report_id?: string
          report_json?: Json
          tenant_id: string
          total_gates?: number
          w52_gates_passed?: number
        }
        Update: {
          blended_score?: number
          blockers?: Json
          cert_valid_until?: string | null
          created_at?: string
          final_status?: string
          gate_pass_pct?: number
          gates_failed?: number
          gates_passed?: number
          generated_at?: string
          go_live_authorized?: boolean
          id?: number
          production_hash?: string
          report_id?: string
          report_json?: Json
          tenant_id?: string
          total_gates?: number
          w52_gates_passed?: number
        }
        Relationships: []
      }
      financial_truth_certifications: {
        Row: {
          balance_rate_pct: number
          blockers: Json
          certification_hash: string
          created_at: string
          fee_accuracy_pct: number
          generated_at: string
          id: number
          idempotency_pct: number
          mismatch_detection_pct: number
          overall_score: number
          reconciliation_certified: boolean
          reconciliation_pct: number
          report_id: string
          report_json: Json
          synthetic_tx_count: number
          tenant_id: string
          truth_grade: string
        }
        Insert: {
          balance_rate_pct?: number
          blockers?: Json
          certification_hash: string
          created_at?: string
          fee_accuracy_pct?: number
          generated_at?: string
          id?: number
          idempotency_pct?: number
          mismatch_detection_pct?: number
          overall_score?: number
          reconciliation_certified?: boolean
          reconciliation_pct?: number
          report_id?: string
          report_json?: Json
          synthetic_tx_count?: number
          tenant_id: string
          truth_grade?: string
        }
        Update: {
          balance_rate_pct?: number
          blockers?: Json
          certification_hash?: string
          created_at?: string
          fee_accuracy_pct?: number
          generated_at?: string
          id?: number
          idempotency_pct?: number
          mismatch_detection_pct?: number
          overall_score?: number
          reconciliation_certified?: boolean
          reconciliation_pct?: number
          report_id?: string
          report_json?: Json
          synthetic_tx_count?: number
          tenant_id?: string
          truth_grade?: string
        }
        Relationships: []
      }
      forensic_audit_log: {
        Row: {
          action: string
          actor: string
          chain_hash: string
          correlation_id: string | null
          created_at: string
          id: number
          log_id: string
          payload_hash: string
          payload_json: Json
          prev_hash: string
          tenant_id: string
        }
        Insert: {
          action: string
          actor: string
          chain_hash: string
          correlation_id?: string | null
          created_at?: string
          id?: number
          log_id?: string
          payload_hash: string
          payload_json?: Json
          prev_hash?: string
          tenant_id: string
        }
        Update: {
          action?: string
          actor?: string
          chain_hash?: string
          correlation_id?: string | null
          created_at?: string
          id?: number
          log_id?: string
          payload_hash?: string
          payload_json?: Json
          prev_hash?: string
          tenant_id?: string
        }
        Relationships: []
      }
      governance_approvals: {
        Row: {
          action_type: string | null
          actor_id: string | null
          approval_id: string | null
          approved_by: string | null
          context: Json
          correlation_id: string | null
          created_at: string
          decided_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          org_id: string
          payload: Json | null
          reason: string | null
          request_type: string
          requested_at: string
          requested_by: string
          resource_id: string | null
          resource_type: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_level: string | null
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          action_type?: string | null
          actor_id?: string | null
          approval_id?: string | null
          approved_by?: string | null
          context?: Json
          correlation_id?: string | null
          created_at?: string
          decided_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
          payload?: Json | null
          reason?: string | null
          request_type: string
          requested_at?: string
          requested_by: string
          resource_id?: string | null
          resource_type?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string | null
          actor_id?: string | null
          approval_id?: string | null
          approved_by?: string | null
          context?: Json
          correlation_id?: string | null
          created_at?: string
          decided_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
          payload?: Json | null
          reason?: string | null
          request_type?: string
          requested_at?: string
          requested_by?: string
          resource_id?: string | null
          resource_type?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      governance_decisions: {
        Row: {
          action_type: string
          approved_at: string | null
          approved_by: string | null
          audit_reason: string | null
          created_at: string
          decision: string
          governance_class: string
          id: string
          triggered_by: string
        }
        Insert: {
          action_type: string
          approved_at?: string | null
          approved_by?: string | null
          audit_reason?: string | null
          created_at?: string
          decision: string
          governance_class: string
          id?: string
          triggered_by: string
        }
        Update: {
          action_type?: string
          approved_at?: string | null
          approved_by?: string | null
          audit_reason?: string | null
          created_at?: string
          decision?: string
          governance_class?: string
          id?: string
          triggered_by?: string
        }
        Relationships: []
      }
      immutable_incident_log: {
        Row: {
          chain_hash: string
          created_at: string
          description: string
          id: number
          incident_id: string
          level: string
          type: string
        }
        Insert: {
          chain_hash: string
          created_at?: string
          description?: string
          id?: number
          incident_id?: string
          level: string
          type: string
        }
        Update: {
          chain_hash?: string
          created_at?: string
          description?: string
          id?: number
          incident_id?: string
          level?: string
          type?: string
        }
        Relationships: []
      }
      incident_governance: {
        Row: {
          approval_id: string
          id: string
          incident_id: string
          linked_at: string
          linked_by: string | null
          notes: string | null
        }
        Insert: {
          approval_id: string
          id?: string
          incident_id: string
          linked_at?: string
          linked_by?: string | null
          notes?: string | null
        }
        Update: {
          approval_id?: string
          id?: string
          incident_id?: string
          linked_at?: string
          linked_by?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_governance_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "governance_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_governance_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["incident_id"]
          },
        ]
      }
      incidents: {
        Row: {
          affected_systems: string[] | null
          assigned_to: string | null
          correlation_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          detected_at: string
          incident_id: string
          metadata: Json | null
          org_id: string
          resolved_at: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          affected_systems?: string[] | null
          assigned_to?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          detected_at?: string
          incident_id?: string
          metadata?: Json | null
          org_id: string
          resolved_at?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          affected_systems?: string[] | null
          assigned_to?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          detected_at?: string
          incident_id?: string
          metadata?: Json | null
          org_id?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      institutional_partners: {
        Row: {
          cidade: string | null
          contact_attempts: number | null
          created_at: string
          deals_referidos: number | null
          email: string | null
          empresa: string | null
          estado: string | null
          id: string
          last_contact_at: string | null
          linkedin_url: string | null
          next_followup_at: string | null
          nivel_prioridade: string | null
          nome: string
          notes: string | null
          origem: string | null
          owner: string | null
          paises_actuacao: string[] | null
          phone: string | null
          segmento: string | null
          tags: string[] | null
          ticket_medio: number | null
          tipo: string
          updated_at: string
          volume_referido: number | null
          website: string | null
        }
        Insert: {
          cidade?: string | null
          contact_attempts?: number | null
          created_at?: string
          deals_referidos?: number | null
          email?: string | null
          empresa?: string | null
          estado?: string | null
          id?: string
          last_contact_at?: string | null
          linkedin_url?: string | null
          next_followup_at?: string | null
          nivel_prioridade?: string | null
          nome: string
          notes?: string | null
          origem?: string | null
          owner?: string | null
          paises_actuacao?: string[] | null
          phone?: string | null
          segmento?: string | null
          tags?: string[] | null
          ticket_medio?: number | null
          tipo: string
          updated_at?: string
          volume_referido?: number | null
          website?: string | null
        }
        Update: {
          cidade?: string | null
          contact_attempts?: number | null
          created_at?: string
          deals_referidos?: number | null
          email?: string | null
          empresa?: string | null
          estado?: string | null
          id?: string
          last_contact_at?: string | null
          linkedin_url?: string | null
          next_followup_at?: string | null
          nivel_prioridade?: string | null
          nome?: string
          notes?: string | null
          origem?: string | null
          owner?: string | null
          paises_actuacao?: string[] | null
          phone?: string | null
          segmento?: string | null
          tags?: string[] | null
          ticket_medio?: number | null
          tipo?: string
          updated_at?: string
          volume_referido?: number | null
          website?: string | null
        }
        Relationships: []
      }
      institutional_readiness_reports: {
        Row: {
          big4_ready: boolean
          blockers: Json
          cert_valid_until: string | null
          created_at: string
          frameworks_compliant: number
          frameworks_total: number
          generated_at: string
          id: number
          overall_score: number
          readiness_grade: string
          readiness_hash: string
          report_id: string
          report_json: Json
          tenant_id: string
          total_evidence_items: number
        }
        Insert: {
          big4_ready?: boolean
          blockers?: Json
          cert_valid_until?: string | null
          created_at?: string
          frameworks_compliant?: number
          frameworks_total?: number
          generated_at?: string
          id?: number
          overall_score?: number
          readiness_grade?: string
          readiness_hash: string
          report_id?: string
          report_json?: Json
          tenant_id: string
          total_evidence_items?: number
        }
        Update: {
          big4_ready?: boolean
          blockers?: Json
          cert_valid_until?: string | null
          created_at?: string
          frameworks_compliant?: number
          frameworks_total?: number
          generated_at?: string
          id?: number
          overall_score?: number
          readiness_grade?: string
          readiness_hash?: string
          report_id?: string
          report_json?: Json
          tenant_id?: string
          total_evidence_items?: number
        }
        Relationships: []
      }
      investidores: {
        Row: {
          capital_max: number | null
          capital_min: number | null
          consultor_id: string | null
          created_at: string | null
          deals_history: number | null
          email: string | null
          flag: string | null
          fonte: string | null
          golden_visa: boolean | null
          horizon_years: number | null
          id: string
          last_contact: string | null
          lingua: string | null
          nacionalidade: string | null
          nhr_interesse: boolean | null
          nome: string
          notes: string | null
          ocupacao: string | null
          pipeline_stage: string | null
          risk_profile: string | null
          status: string | null
          tags: string[] | null
          telefone: string | null
          tipo: string | null
          tipo_imovel: string[] | null
          total_invested: number | null
          updated_at: string | null
          whatsapp: string | null
          yield_target: number | null
          zonas: string[] | null
        }
        Insert: {
          capital_max?: number | null
          capital_min?: number | null
          consultor_id?: string | null
          created_at?: string | null
          deals_history?: number | null
          email?: string | null
          flag?: string | null
          fonte?: string | null
          golden_visa?: boolean | null
          horizon_years?: number | null
          id?: string
          last_contact?: string | null
          lingua?: string | null
          nacionalidade?: string | null
          nhr_interesse?: boolean | null
          nome: string
          notes?: string | null
          ocupacao?: string | null
          pipeline_stage?: string | null
          risk_profile?: string | null
          status?: string | null
          tags?: string[] | null
          telefone?: string | null
          tipo?: string | null
          tipo_imovel?: string[] | null
          total_invested?: number | null
          updated_at?: string | null
          whatsapp?: string | null
          yield_target?: number | null
          zonas?: string[] | null
        }
        Update: {
          capital_max?: number | null
          capital_min?: number | null
          consultor_id?: string | null
          created_at?: string | null
          deals_history?: number | null
          email?: string | null
          flag?: string | null
          fonte?: string | null
          golden_visa?: boolean | null
          horizon_years?: number | null
          id?: string
          last_contact?: string | null
          lingua?: string | null
          nacionalidade?: string | null
          nhr_interesse?: boolean | null
          nome?: string
          notes?: string | null
          ocupacao?: string | null
          pipeline_stage?: string | null
          risk_profile?: string | null
          status?: string | null
          tags?: string[] | null
          telefone?: string | null
          tipo?: string | null
          tipo_imovel?: string[] | null
          total_invested?: number | null
          updated_at?: string | null
          whatsapp?: string | null
          yield_target?: number | null
          zonas?: string[] | null
        }
        Relationships: []
      }
      investment_alerts: {
        Row: {
          active: boolean | null
          contact_id: number | null
          created_at: string | null
          criteria: Json
          id: string
          last_sent: string | null
        }
        Insert: {
          active?: boolean | null
          contact_id?: number | null
          created_at?: string | null
          criteria?: Json
          id?: string
          last_sent?: string | null
        }
        Update: {
          active?: boolean | null
          contact_id?: number | null
          created_at?: string | null
          criteria?: Json
          id?: string
          last_sent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investment_alerts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_match_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_alerts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_alerts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_alerts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_alerts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_buyer_audit"
            referencedColumns: ["id"]
          },
        ]
      }
      ios_runtime_audits: {
        Row: {
          audit_id: string
          blocker_count: number
          created_at: string
          generated_at: string
          health_score: number
          id: number
          in_memory_state_detected: boolean
          reality_score: number
          report_json: Json
          silent_failure_detected: boolean
          system_status: string
          tenant_id: string
        }
        Insert: {
          audit_id?: string
          blocker_count?: number
          created_at?: string
          generated_at?: string
          health_score?: number
          id?: number
          in_memory_state_detected?: boolean
          reality_score?: number
          report_json?: Json
          silent_failure_detected?: boolean
          system_status?: string
          tenant_id: string
        }
        Update: {
          audit_id?: string
          blocker_count?: number
          created_at?: string
          generated_at?: string
          health_score?: number
          id?: number
          in_memory_state_detected?: boolean
          reality_score?: number
          report_json?: Json
          silent_failure_detected?: boolean
          system_status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      ios_self_tests: {
        Row: {
          anomalies_escalated: number
          anomalies_healed: number
          capital_safe: boolean
          certification_hash: string
          final_status: string
          generated_at: string
          health_score: number
          id: number
          reality_score: number
          report_json: Json
          soc_operational: boolean
          tenant_id: string
          test_id: string
        }
        Insert: {
          anomalies_escalated?: number
          anomalies_healed?: number
          capital_safe?: boolean
          certification_hash: string
          final_status?: string
          generated_at?: string
          health_score?: number
          id?: number
          reality_score?: number
          report_json?: Json
          soc_operational?: boolean
          tenant_id: string
          test_id?: string
        }
        Update: {
          anomalies_escalated?: number
          anomalies_healed?: number
          capital_safe?: boolean
          certification_hash?: string
          final_status?: string
          generated_at?: string
          health_score?: number
          id?: number
          reality_score?: number
          report_json?: Json
          soc_operational?: boolean
          tenant_id?: string
          test_id?: string
        }
        Relationships: []
      }
      job_queue: {
        Row: {
          attempt: number
          correlation_id: string | null
          created_at: string
          error: string | null
          id: string
          max_attempts: number
          payload: Json
          processed_at: string | null
          queue: string
          scheduled_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          attempt?: number
          correlation_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          max_attempts?: number
          payload: Json
          processed_at?: string | null
          queue: string
          scheduled_at?: string
          status?: string
          tenant_id?: string
        }
        Update: {
          attempt?: number
          correlation_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          max_attempts?: number
          payload?: Json
          processed_at?: string | null
          queue?: string
          scheduled_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      kpi_snapshots: {
        Row: {
          active_leads: number | null
          active_properties: number | null
          avg_deal_value: number | null
          avg_match_score: number | null
          campaigns_sent: number | null
          created_at: string | null
          deal_packs_generated: number | null
          deal_packs_sent: number | null
          deal_packs_viewed: number | null
          deals_by_stage: Json | null
          emails_delivered: number | null
          exclusive_properties: number | null
          id: string
          interested_matches: number | null
          leads_by_status: Json | null
          matches_today: number | null
          new_leads_today: number | null
          off_market_properties: number | null
          pipeline_value: number | null
          raw_data: Json | null
          snapshot_date: string
          total_deals: number | null
          total_leads: number | null
          total_matches: number | null
          total_properties: number | null
          updated_at: string | null
          vip_leads: number | null
        }
        Insert: {
          active_leads?: number | null
          active_properties?: number | null
          avg_deal_value?: number | null
          avg_match_score?: number | null
          campaigns_sent?: number | null
          created_at?: string | null
          deal_packs_generated?: number | null
          deal_packs_sent?: number | null
          deal_packs_viewed?: number | null
          deals_by_stage?: Json | null
          emails_delivered?: number | null
          exclusive_properties?: number | null
          id?: string
          interested_matches?: number | null
          leads_by_status?: Json | null
          matches_today?: number | null
          new_leads_today?: number | null
          off_market_properties?: number | null
          pipeline_value?: number | null
          raw_data?: Json | null
          snapshot_date: string
          total_deals?: number | null
          total_leads?: number | null
          total_matches?: number | null
          total_properties?: number | null
          updated_at?: string | null
          vip_leads?: number | null
        }
        Update: {
          active_leads?: number | null
          active_properties?: number | null
          avg_deal_value?: number | null
          avg_match_score?: number | null
          campaigns_sent?: number | null
          created_at?: string | null
          deal_packs_generated?: number | null
          deal_packs_sent?: number | null
          deal_packs_viewed?: number | null
          deals_by_stage?: Json | null
          emails_delivered?: number | null
          exclusive_properties?: number | null
          id?: string
          interested_matches?: number | null
          leads_by_status?: Json | null
          matches_today?: number | null
          new_leads_today?: number | null
          off_market_properties?: number | null
          pipeline_value?: number | null
          raw_data?: Json | null
          snapshot_date?: string
          total_deals?: number | null
          total_leads?: number | null
          total_matches?: number | null
          total_properties?: number | null
          updated_at?: string | null
          vip_leads?: number | null
        }
        Relationships: []
      }
      lead_emails: {
        Row: {
          confidence: number | null
          created_at: string
          email: string
          id: string
          is_primary: boolean
          lead_id: string
          provider: string | null
          raw_response: Json | null
          source: string | null
          status: string
          verified_at: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          email: string
          id?: string
          is_primary?: boolean
          lead_id: string
          provider?: string | null
          raw_response?: Json | null
          source?: string | null
          status?: string
          verified_at?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          email?: string
          id?: string
          is_primary?: boolean
          lead_id?: string
          provider?: string | null
          raw_response?: Json | null
          source?: string | null
          status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          city: string | null
          company_domain: string | null
          company_domain_source: string | null
          company_id: string | null
          company_linkedin_url: string | null
          company_name: string | null
          company_region: string | null
          company_type: string | null
          company_website: string | null
          company_website_confidence: number | null
          country: string | null
          created_at: string
          deal_readiness_score: number | null
          dedup_key: string
          email: string | null
          email_confidence: number | null
          email_provider: string | null
          email_source: string | null
          email_status: string
          email_verified_at: string | null
          estimated_ticket_size_eur: string | null
          final_priority_score: number | null
          first_name: string | null
          full_name: string
          full_name_normalized: string | null
          geo_preference: string | null
          id: string
          inferred_investment_capacity: string | null
          ingestion_timestamp: string
          intelligence_score: number | null
          investment_focus: string | null
          is_suppressed: boolean
          language_hint: string | null
          last_name: string | null
          lead_score: number | null
          lead_tier: string | null
          linkedin_url: string | null
          location_raw: string | null
          market: string
          market_group: string
          persona: string
          portugal_affinity_score: number | null
          portugal_priority_rank: number | null
          raw_payload: Json
          region: string | null
          scoring_breakdown_json: Json | null
          scoring_reason: string | null
          segment: string | null
          seniority: string
          source_actor: string
          source_market: string
          source_persona: string
          source_query: string
          title: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          company_domain?: string | null
          company_domain_source?: string | null
          company_id?: string | null
          company_linkedin_url?: string | null
          company_name?: string | null
          company_region?: string | null
          company_type?: string | null
          company_website?: string | null
          company_website_confidence?: number | null
          country?: string | null
          created_at?: string
          deal_readiness_score?: number | null
          dedup_key: string
          email?: string | null
          email_confidence?: number | null
          email_provider?: string | null
          email_source?: string | null
          email_status?: string
          email_verified_at?: string | null
          estimated_ticket_size_eur?: string | null
          final_priority_score?: number | null
          first_name?: string | null
          full_name: string
          full_name_normalized?: string | null
          geo_preference?: string | null
          id?: string
          inferred_investment_capacity?: string | null
          ingestion_timestamp?: string
          intelligence_score?: number | null
          investment_focus?: string | null
          is_suppressed?: boolean
          language_hint?: string | null
          last_name?: string | null
          lead_score?: number | null
          lead_tier?: string | null
          linkedin_url?: string | null
          location_raw?: string | null
          market: string
          market_group: string
          persona: string
          portugal_affinity_score?: number | null
          portugal_priority_rank?: number | null
          raw_payload?: Json
          region?: string | null
          scoring_breakdown_json?: Json | null
          scoring_reason?: string | null
          segment?: string | null
          seniority?: string
          source_actor: string
          source_market: string
          source_persona: string
          source_query: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          company_domain?: string | null
          company_domain_source?: string | null
          company_id?: string | null
          company_linkedin_url?: string | null
          company_name?: string | null
          company_region?: string | null
          company_type?: string | null
          company_website?: string | null
          company_website_confidence?: number | null
          country?: string | null
          created_at?: string
          deal_readiness_score?: number | null
          dedup_key?: string
          email?: string | null
          email_confidence?: number | null
          email_provider?: string | null
          email_source?: string | null
          email_status?: string
          email_verified_at?: string | null
          estimated_ticket_size_eur?: string | null
          final_priority_score?: number | null
          first_name?: string | null
          full_name?: string
          full_name_normalized?: string | null
          geo_preference?: string | null
          id?: string
          inferred_investment_capacity?: string | null
          ingestion_timestamp?: string
          intelligence_score?: number | null
          investment_focus?: string | null
          is_suppressed?: boolean
          language_hint?: string | null
          last_name?: string | null
          lead_score?: number | null
          lead_tier?: string | null
          linkedin_url?: string | null
          location_raw?: string | null
          market?: string
          market_group?: string
          persona?: string
          portugal_affinity_score?: number | null
          portugal_priority_rank?: number | null
          raw_payload?: Json
          region?: string | null
          scoring_breakdown_json?: Json | null
          scoring_reason?: string | null
          segment?: string | null
          seniority?: string
          source_actor?: string
          source_market?: string
          source_persona?: string
          source_query?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_events: {
        Row: {
          agent_email: string | null
          created_at: string | null
          deal_id: number | null
          deal_pack_id: string | null
          event_type: string
          id: string
          lead_id: number | null
          match_id: string | null
          match_score: number | null
          metadata: Json | null
          property_id: string | null
          tenant_id: string | null
        }
        Insert: {
          agent_email?: string | null
          created_at?: string | null
          deal_id?: number | null
          deal_pack_id?: string | null
          event_type: string
          id?: string
          lead_id?: number | null
          match_id?: string | null
          match_score?: number | null
          metadata?: Json | null
          property_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          agent_email?: string | null
          created_at?: string | null
          deal_id?: number | null
          deal_pack_id?: string | null
          event_type?: string
          id?: string
          lead_id?: number | null
          match_id?: string | null
          match_score?: number | null
          metadata?: Json | null
          property_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "buyer_match_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "contacts_buyer_audit"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_snapshots: {
        Row: {
          calibration_err: number | null
          close_rate_lift: number | null
          created_at: string
          false_pos_rate: number | null
          id: string
          match_precision: number | null
          org_id: string
          revenue_per_pred: number | null
          reward_mean: number | null
          reward_std: number | null
          sample_count: number
          snapshot_id: string
          update_applied: boolean
        }
        Insert: {
          calibration_err?: number | null
          close_rate_lift?: number | null
          created_at?: string
          false_pos_rate?: number | null
          id?: string
          match_precision?: number | null
          org_id: string
          revenue_per_pred?: number | null
          reward_mean?: number | null
          reward_std?: number | null
          sample_count?: number
          snapshot_id: string
          update_applied?: boolean
        }
        Update: {
          calibration_err?: number | null
          close_rate_lift?: number | null
          created_at?: string
          false_pos_rate?: number | null
          id?: string
          match_precision?: number | null
          org_id?: string
          revenue_per_pred?: number | null
          reward_mean?: number | null
          reward_std?: number | null
          sample_count?: number
          snapshot_id?: string
          update_applied?: boolean
        }
        Relationships: []
      }
      market_data: {
        Row: {
          cached_at: string | null
          dias_mercado: number | null
          preco_m2: number | null
          yield_bruto: number | null
          yoy_percent: number | null
          zona: string
        }
        Insert: {
          cached_at?: string | null
          dias_mercado?: number | null
          preco_m2?: number | null
          yield_bruto?: number | null
          yoy_percent?: number | null
          zona: string
        }
        Update: {
          cached_at?: string | null
          dias_mercado?: number | null
          preco_m2?: number | null
          yield_bruto?: number | null
          yoy_percent?: number | null
          zona?: string
        }
        Relationships: []
      }
      market_feedback_signals: {
        Row: {
          absorption_rate: number | null
          asset_class: string
          computed_at: string
          created_at: string
          demand_supply_ratio: number | null
          id: string
          listing_velocity_chg: number | null
          market_health_score: number | null
          market_pressure: string | null
          market_regime: string | null
          period_label: string
          price_delta_pct: number | null
          pricing_pressure_idx: number | null
          zone_key: string
        }
        Insert: {
          absorption_rate?: number | null
          asset_class: string
          computed_at?: string
          created_at?: string
          demand_supply_ratio?: number | null
          id?: string
          listing_velocity_chg?: number | null
          market_health_score?: number | null
          market_pressure?: string | null
          market_regime?: string | null
          period_label: string
          price_delta_pct?: number | null
          pricing_pressure_idx?: number | null
          zone_key: string
        }
        Update: {
          absorption_rate?: number | null
          asset_class?: string
          computed_at?: string
          created_at?: string
          demand_supply_ratio?: number | null
          id?: string
          listing_velocity_chg?: number | null
          market_health_score?: number | null
          market_pressure?: string | null
          market_regime?: string | null
          period_label?: string
          price_delta_pct?: number | null
          pricing_pressure_idx?: number | null
          zone_key?: string
        }
        Relationships: []
      }
      market_price_refs: {
        Row: {
          cidade: string
          confidence_level: string
          id: string
          max_price_per_m2: number | null
          median_price_per_m2: number
          min_price_per_m2: number | null
          source: string
          tipo_ativo: string
          updated_at: string
        }
        Insert: {
          cidade: string
          confidence_level?: string
          id?: string
          max_price_per_m2?: number | null
          median_price_per_m2: number
          min_price_per_m2?: number | null
          source?: string
          tipo_ativo: string
          updated_at?: string
        }
        Update: {
          cidade?: string
          confidence_level?: string
          id?: string
          max_price_per_m2?: number | null
          median_price_per_m2?: number
          min_price_per_m2?: number | null
          source?: string
          tipo_ativo?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_snapshots: {
        Row: {
          created_at: string
          dias_mercado: number | null
          id: string
          preco_medio: number | null
          snapshot_date: string
          source: string | null
          transacoes: number | null
          variacao_anual: number | null
          yield_medio: number | null
          zona: string
        }
        Insert: {
          created_at?: string
          dias_mercado?: number | null
          id?: string
          preco_medio?: number | null
          snapshot_date?: string
          source?: string | null
          transacoes?: number | null
          variacao_anual?: number | null
          yield_medio?: number | null
          zona: string
        }
        Update: {
          created_at?: string
          dias_mercado?: number | null
          id?: string
          preco_medio?: number | null
          snapshot_date?: string
          source?: string | null
          transacoes?: number | null
          variacao_anual?: number | null
          yield_medio?: number | null
          zona?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          breakdown: Json | null
          created_at: string | null
          deal_id: number | null
          estimated_yield: number | null
          explanation: string | null
          id: string
          lead_id: number | null
          match_reasons: string[] | null
          match_score: number | null
          match_weaknesses: string[] | null
          matched_by: string | null
          next_action_deadline: string | null
          next_best_action: string | null
          priority_level: string | null
          property_id: string | null
          property_ref: string | null
          property_title: string | null
          similarity: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          breakdown?: Json | null
          created_at?: string | null
          deal_id?: number | null
          estimated_yield?: number | null
          explanation?: string | null
          id?: string
          lead_id?: number | null
          match_reasons?: string[] | null
          match_score?: number | null
          match_weaknesses?: string[] | null
          matched_by?: string | null
          next_action_deadline?: string | null
          next_best_action?: string | null
          priority_level?: string | null
          property_id?: string | null
          property_ref?: string | null
          property_title?: string | null
          similarity?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          breakdown?: Json | null
          created_at?: string | null
          deal_id?: number | null
          estimated_yield?: number | null
          explanation?: string | null
          id?: string
          lead_id?: number | null
          match_reasons?: string[] | null
          match_score?: number | null
          match_weaknesses?: string[] | null
          matched_by?: string | null
          next_action_deadline?: string | null
          next_best_action?: string | null
          priority_level?: string | null
          property_id?: string | null
          property_ref?: string | null
          property_title?: string | null
          similarity?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "buyer_match_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "contacts_buyer_audit"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          agent_id: string | null
          contact_id: number | null
          created_at: string
          deal_id: number | null
          id: string
          link: string | null
          message: string
          priority: string
          read: boolean
          title: string
          type: string
        }
        Insert: {
          agent_id?: string | null
          contact_id?: number | null
          created_at?: string
          deal_id?: number | null
          id?: string
          link?: string | null
          message: string
          priority?: string
          read?: boolean
          title: string
          type: string
        }
        Update: {
          agent_id?: string | null
          contact_id?: number | null
          created_at?: string
          deal_id?: number | null
          id?: string
          link?: string | null
          message?: string
          priority?: string
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_match_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_buyer_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      nurture_log: {
        Row: {
          contact_id: string
          email: string
          id: string
          sent_at: string
          sequence_day: number
        }
        Insert: {
          contact_id: string
          email: string
          id?: string
          sent_at?: string
          sequence_day: number
        }
        Update: {
          contact_id?: string
          email?: string
          id?: string
          sent_at?: string
          sequence_day?: number
        }
        Relationships: []
      }
      offmarket_leads: {
        Row: {
          adjusted_discount_score: number | null
          alert_count: number | null
          ano_construcao: number | null
          area_m2: number | null
          asset_quality_score: number | null
          assigned_to: string | null
          attack_recommendation: string | null
          best_buyer_execution_score: number | null
          best_buyer_match_score: number | null
          buyer_competition_flag: boolean | null
          buyer_execution_reason: string | null
          buyer_match_notes: string | null
          buyer_matched_at: string | null
          buyer_pressure_class: string | null
          buyer_pressure_reason: string | null
          buyer_pressure_score: number | null
          buyer_triad_notes: string | null
          cidade: string | null
          close_window_score: number | null
          comp_confidence_score: number | null
          contact_attempts: number | null
          contact_email_owner: string | null
          contact_phone_owner: string | null
          contacto: string | null
          counter_offer_amount: number | null
          counter_offer_date: string | null
          cpcv_probability: number | null
          cpcv_signed_at: string | null
          cpcv_target_date: string | null
          created_at: string
          data_completeness_score: number | null
          days_without_action_flag: boolean | null
          deal_evaluation_reason: string | null
          deal_evaluation_score: number | null
          deal_evaluation_updated_at: string | null
          deal_kill_flag: boolean | null
          deal_momentum_score: number | null
          deal_next_step: string | null
          deal_next_step_date: string | null
          deal_owner: string | null
          deal_path: string | null
          deal_priority_score: number | null
          deal_readiness_score: number | null
          deal_risk_level: string | null
          deal_risk_reason: string | null
          deal_velocity_score: number | null
          deposit_received: number | null
          docs_pending: string[] | null
          escritura_done_at: string | null
          escritura_target_date: string | null
          estimated_fair_value: number | null
          execution_blocker_reason: string | null
          execution_discipline_score: number | null
          execution_probability: number | null
          execution_reason: string | null
          first_contact_at: string | null
          first_meeting_at: string | null
          friction_penalty: number | null
          gross_discount_pct: number | null
          human_failure_flag: boolean | null
          id: string
          institutional_priority: boolean
          last_action_type: string | null
          last_alert_type: string | null
          last_alerted_at: string | null
          last_attempt_channel: string | null
          last_contact_at: string | null
          last_contact_attempt_at: string | null
          last_score_at: string | null
          legal_status: string | null
          liquidity_reason: string | null
          liquidity_score: number | null
          localizacao: string | null
          master_attack_rank: number | null
          master_attack_reason: string | null
          matched_buyers_count: number | null
          matched_to_buyers: boolean
          money_priority_score: number | null
          negotiation_status: string | null
          next_followup_at: string | null
          nome: string
          notes: string | null
          offer_amount: number | null
          offer_date: string | null
          outreach_ready: boolean
          owner_name: string | null
          owner_type: string | null
          owner_type_detail: string | null
          preclose_candidate: boolean
          preclose_notes: string | null
          price_ask: number | null
          price_ask_per_m2: number | null
          price_estimate: number | null
          price_intel_blocked: boolean | null
          price_intelligence_updated_at: string | null
          price_opportunity_score: number | null
          price_per_m2: number | null
          price_reason: string | null
          primary_buyer_id: number | null
          raw_data: Json | null
          realistic_cpcv_forecast_flag: boolean | null
          revenue_per_lead_estimate: number | null
          revenue_potential_class: string | null
          risk_adjusted_upside_score: number | null
          score: number | null
          score_attempts: number
          score_breakdown: Json | null
          score_reason: string | null
          score_status: string | null
          score_updated_at: string | null
          secondary_buyer_id: number | null
          seller_intent_label: string | null
          seller_intent_score: number | null
          seller_pressure_reason: string | null
          sla_breach: boolean | null
          sla_contacted_at: string | null
          source: string | null
          source_listing_id: string | null
          source_network_contact: string | null
          source_network_type: string | null
          source_quality_score: number | null
          source_url: string | null
          stale_deal_flag: boolean | null
          status: string | null
          tags: string[] | null
          tertiary_buyer_id: number | null
          time_waste_flag: boolean | null
          tipo_ativo: string | null
          updated_at: string
          upside_reason: string | null
          upside_score: number | null
          urgency: string | null
          urgent_followup_flag: boolean | null
        }
        Insert: {
          adjusted_discount_score?: number | null
          alert_count?: number | null
          ano_construcao?: number | null
          area_m2?: number | null
          asset_quality_score?: number | null
          assigned_to?: string | null
          attack_recommendation?: string | null
          best_buyer_execution_score?: number | null
          best_buyer_match_score?: number | null
          buyer_competition_flag?: boolean | null
          buyer_execution_reason?: string | null
          buyer_match_notes?: string | null
          buyer_matched_at?: string | null
          buyer_pressure_class?: string | null
          buyer_pressure_reason?: string | null
          buyer_pressure_score?: number | null
          buyer_triad_notes?: string | null
          cidade?: string | null
          close_window_score?: number | null
          comp_confidence_score?: number | null
          contact_attempts?: number | null
          contact_email_owner?: string | null
          contact_phone_owner?: string | null
          contacto?: string | null
          counter_offer_amount?: number | null
          counter_offer_date?: string | null
          cpcv_probability?: number | null
          cpcv_signed_at?: string | null
          cpcv_target_date?: string | null
          created_at?: string
          data_completeness_score?: number | null
          days_without_action_flag?: boolean | null
          deal_evaluation_reason?: string | null
          deal_evaluation_score?: number | null
          deal_evaluation_updated_at?: string | null
          deal_kill_flag?: boolean | null
          deal_momentum_score?: number | null
          deal_next_step?: string | null
          deal_next_step_date?: string | null
          deal_owner?: string | null
          deal_path?: string | null
          deal_priority_score?: number | null
          deal_readiness_score?: number | null
          deal_risk_level?: string | null
          deal_risk_reason?: string | null
          deal_velocity_score?: number | null
          deposit_received?: number | null
          docs_pending?: string[] | null
          escritura_done_at?: string | null
          escritura_target_date?: string | null
          estimated_fair_value?: number | null
          execution_blocker_reason?: string | null
          execution_discipline_score?: number | null
          execution_probability?: number | null
          execution_reason?: string | null
          first_contact_at?: string | null
          first_meeting_at?: string | null
          friction_penalty?: number | null
          gross_discount_pct?: number | null
          human_failure_flag?: boolean | null
          id?: string
          institutional_priority?: boolean
          last_action_type?: string | null
          last_alert_type?: string | null
          last_alerted_at?: string | null
          last_attempt_channel?: string | null
          last_contact_at?: string | null
          last_contact_attempt_at?: string | null
          last_score_at?: string | null
          legal_status?: string | null
          liquidity_reason?: string | null
          liquidity_score?: number | null
          localizacao?: string | null
          master_attack_rank?: number | null
          master_attack_reason?: string | null
          matched_buyers_count?: number | null
          matched_to_buyers?: boolean
          money_priority_score?: number | null
          negotiation_status?: string | null
          next_followup_at?: string | null
          nome: string
          notes?: string | null
          offer_amount?: number | null
          offer_date?: string | null
          outreach_ready?: boolean
          owner_name?: string | null
          owner_type?: string | null
          owner_type_detail?: string | null
          preclose_candidate?: boolean
          preclose_notes?: string | null
          price_ask?: number | null
          price_ask_per_m2?: number | null
          price_estimate?: number | null
          price_intel_blocked?: boolean | null
          price_intelligence_updated_at?: string | null
          price_opportunity_score?: number | null
          price_per_m2?: number | null
          price_reason?: string | null
          primary_buyer_id?: number | null
          raw_data?: Json | null
          realistic_cpcv_forecast_flag?: boolean | null
          revenue_per_lead_estimate?: number | null
          revenue_potential_class?: string | null
          risk_adjusted_upside_score?: number | null
          score?: number | null
          score_attempts?: number
          score_breakdown?: Json | null
          score_reason?: string | null
          score_status?: string | null
          score_updated_at?: string | null
          secondary_buyer_id?: number | null
          seller_intent_label?: string | null
          seller_intent_score?: number | null
          seller_pressure_reason?: string | null
          sla_breach?: boolean | null
          sla_contacted_at?: string | null
          source?: string | null
          source_listing_id?: string | null
          source_network_contact?: string | null
          source_network_type?: string | null
          source_quality_score?: number | null
          source_url?: string | null
          stale_deal_flag?: boolean | null
          status?: string | null
          tags?: string[] | null
          tertiary_buyer_id?: number | null
          time_waste_flag?: boolean | null
          tipo_ativo?: string | null
          updated_at?: string
          upside_reason?: string | null
          upside_score?: number | null
          urgency?: string | null
          urgent_followup_flag?: boolean | null
        }
        Update: {
          adjusted_discount_score?: number | null
          alert_count?: number | null
          ano_construcao?: number | null
          area_m2?: number | null
          asset_quality_score?: number | null
          assigned_to?: string | null
          attack_recommendation?: string | null
          best_buyer_execution_score?: number | null
          best_buyer_match_score?: number | null
          buyer_competition_flag?: boolean | null
          buyer_execution_reason?: string | null
          buyer_match_notes?: string | null
          buyer_matched_at?: string | null
          buyer_pressure_class?: string | null
          buyer_pressure_reason?: string | null
          buyer_pressure_score?: number | null
          buyer_triad_notes?: string | null
          cidade?: string | null
          close_window_score?: number | null
          comp_confidence_score?: number | null
          contact_attempts?: number | null
          contact_email_owner?: string | null
          contact_phone_owner?: string | null
          contacto?: string | null
          counter_offer_amount?: number | null
          counter_offer_date?: string | null
          cpcv_probability?: number | null
          cpcv_signed_at?: string | null
          cpcv_target_date?: string | null
          created_at?: string
          data_completeness_score?: number | null
          days_without_action_flag?: boolean | null
          deal_evaluation_reason?: string | null
          deal_evaluation_score?: number | null
          deal_evaluation_updated_at?: string | null
          deal_kill_flag?: boolean | null
          deal_momentum_score?: number | null
          deal_next_step?: string | null
          deal_next_step_date?: string | null
          deal_owner?: string | null
          deal_path?: string | null
          deal_priority_score?: number | null
          deal_readiness_score?: number | null
          deal_risk_level?: string | null
          deal_risk_reason?: string | null
          deal_velocity_score?: number | null
          deposit_received?: number | null
          docs_pending?: string[] | null
          escritura_done_at?: string | null
          escritura_target_date?: string | null
          estimated_fair_value?: number | null
          execution_blocker_reason?: string | null
          execution_discipline_score?: number | null
          execution_probability?: number | null
          execution_reason?: string | null
          first_contact_at?: string | null
          first_meeting_at?: string | null
          friction_penalty?: number | null
          gross_discount_pct?: number | null
          human_failure_flag?: boolean | null
          id?: string
          institutional_priority?: boolean
          last_action_type?: string | null
          last_alert_type?: string | null
          last_alerted_at?: string | null
          last_attempt_channel?: string | null
          last_contact_at?: string | null
          last_contact_attempt_at?: string | null
          last_score_at?: string | null
          legal_status?: string | null
          liquidity_reason?: string | null
          liquidity_score?: number | null
          localizacao?: string | null
          master_attack_rank?: number | null
          master_attack_reason?: string | null
          matched_buyers_count?: number | null
          matched_to_buyers?: boolean
          money_priority_score?: number | null
          negotiation_status?: string | null
          next_followup_at?: string | null
          nome?: string
          notes?: string | null
          offer_amount?: number | null
          offer_date?: string | null
          outreach_ready?: boolean
          owner_name?: string | null
          owner_type?: string | null
          owner_type_detail?: string | null
          preclose_candidate?: boolean
          preclose_notes?: string | null
          price_ask?: number | null
          price_ask_per_m2?: number | null
          price_estimate?: number | null
          price_intel_blocked?: boolean | null
          price_intelligence_updated_at?: string | null
          price_opportunity_score?: number | null
          price_per_m2?: number | null
          price_reason?: string | null
          primary_buyer_id?: number | null
          raw_data?: Json | null
          realistic_cpcv_forecast_flag?: boolean | null
          revenue_per_lead_estimate?: number | null
          revenue_potential_class?: string | null
          risk_adjusted_upside_score?: number | null
          score?: number | null
          score_attempts?: number
          score_breakdown?: Json | null
          score_reason?: string | null
          score_status?: string | null
          score_updated_at?: string | null
          secondary_buyer_id?: number | null
          seller_intent_label?: string | null
          seller_intent_score?: number | null
          seller_pressure_reason?: string | null
          sla_breach?: boolean | null
          sla_contacted_at?: string | null
          source?: string | null
          source_listing_id?: string | null
          source_network_contact?: string | null
          source_network_type?: string | null
          source_quality_score?: number | null
          source_url?: string | null
          stale_deal_flag?: boolean | null
          status?: string | null
          tags?: string[] | null
          tertiary_buyer_id?: number | null
          time_waste_flag?: boolean | null
          tipo_ativo?: string | null
          updated_at?: string
          upside_reason?: string | null
          upside_score?: number | null
          urgency?: string | null
          urgent_followup_flag?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "offmarket_leads_primary_buyer_id_fkey"
            columns: ["primary_buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer_match_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offmarket_leads_primary_buyer_id_fkey"
            columns: ["primary_buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offmarket_leads_primary_buyer_id_fkey"
            columns: ["primary_buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offmarket_leads_primary_buyer_id_fkey"
            columns: ["primary_buyer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offmarket_leads_primary_buyer_id_fkey"
            columns: ["primary_buyer_id"]
            isOneToOne: false
            referencedRelation: "contacts_buyer_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offmarket_leads_secondary_buyer_id_fkey"
            columns: ["secondary_buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer_match_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offmarket_leads_secondary_buyer_id_fkey"
            columns: ["secondary_buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offmarket_leads_secondary_buyer_id_fkey"
            columns: ["secondary_buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offmarket_leads_secondary_buyer_id_fkey"
            columns: ["secondary_buyer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offmarket_leads_secondary_buyer_id_fkey"
            columns: ["secondary_buyer_id"]
            isOneToOne: false
            referencedRelation: "contacts_buyer_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offmarket_leads_tertiary_buyer_id_fkey"
            columns: ["tertiary_buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer_match_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offmarket_leads_tertiary_buyer_id_fkey"
            columns: ["tertiary_buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offmarket_leads_tertiary_buyer_id_fkey"
            columns: ["tertiary_buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offmarket_leads_tertiary_buyer_id_fkey"
            columns: ["tertiary_buyer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offmarket_leads_tertiary_buyer_id_fkey"
            columns: ["tertiary_buyer_id"]
            isOneToOne: false
            referencedRelation: "contacts_buyer_audit"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          settings: Json | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          settings?: Json | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          settings?: Json | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      outreach_queue: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          contact_status: string
          created_at: string
          deal_room_priority: number | null
          do_not_contact_reason: string | null
          first_contact_date: string | null
          followup_status: string
          id: string
          last_contact_date: string | null
          lead_id: string
          notes: string | null
          opt_out: boolean
          outreach_intelligence_notes: string | null
          portugal_priority_rank: number | null
          sequence_step: number | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          contact_status?: string
          created_at?: string
          deal_room_priority?: number | null
          do_not_contact_reason?: string | null
          first_contact_date?: string | null
          followup_status?: string
          id?: string
          last_contact_date?: string | null
          lead_id: string
          notes?: string | null
          opt_out?: boolean
          outreach_intelligence_notes?: string | null
          portugal_priority_rank?: number | null
          sequence_step?: number | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          contact_status?: string
          created_at?: string
          deal_room_priority?: number | null
          do_not_contact_reason?: string | null
          first_contact_date?: string | null
          followup_status?: string
          id?: string
          last_contact_date?: string | null
          lead_id?: string
          notes?: string | null
          opt_out?: boolean
          outreach_intelligence_notes?: string | null
          portugal_priority_rank?: number | null
          sequence_step?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      override_events: {
        Row: {
          action_type: string
          created_at: string
          id: string
          outcome: string
          override_id: string
          reason: string | null
          resource_id: string | null
          user_email: string
          user_role: string
          winner: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          outcome: string
          override_id: string
          reason?: string | null
          resource_id?: string | null
          user_email: string
          user_role: string
          winner: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          outcome?: string
          override_id?: string
          reason?: string | null
          resource_id?: string | null
          user_email?: string
          user_role?: string
          winner?: string
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          category: string
          config_key: string
          config_type: string
          created_at: string
          description: string | null
          is_sensitive: boolean
          updated_at: string
          updated_by: string | null
          value_boolean: boolean | null
          value_json: Json | null
          value_numeric: number | null
          value_text: string | null
        }
        Insert: {
          category?: string
          config_key: string
          config_type?: string
          created_at?: string
          description?: string | null
          is_sensitive?: boolean
          updated_at?: string
          updated_by?: string | null
          value_boolean?: boolean | null
          value_json?: Json | null
          value_numeric?: number | null
          value_text?: string | null
        }
        Update: {
          category?: string
          config_key?: string
          config_type?: string
          created_at?: string
          description?: string | null
          is_sensitive?: boolean
          updated_at?: string
          updated_by?: string | null
          value_boolean?: boolean | null
          value_json?: Json | null
          value_numeric?: number | null
          value_text?: string | null
        }
        Relationships: []
      }
      policy_tuning_log: {
        Row: {
          applied_by: string | null
          created_at: string
          id: string
          new_value: number
          old_value: number | null
          parameter: string
          tenant_id: string
        }
        Insert: {
          applied_by?: string | null
          created_at?: string
          id?: string
          new_value: number
          old_value?: number | null
          parameter: string
          tenant_id: string
        }
        Update: {
          applied_by?: string | null
          created_at?: string
          id?: string
          new_value?: number
          old_value?: number | null
          parameter?: string
          tenant_id?: string
        }
        Relationships: []
      }
      priority_items: {
        Row: {
          created_at: string
          deadline: string | null
          entity_id: string
          entity_type: string
          id: string
          next_best_action: string | null
          owner_id: string | null
          priority_score: number
          reason: string
          resolved_at: string | null
          revenue_impact: number | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          entity_id: string
          entity_type: string
          id?: string
          next_best_action?: string | null
          owner_id?: string | null
          priority_score?: number
          reason: string
          resolved_at?: string | null
          revenue_impact?: number | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          next_best_action?: string | null
          owner_id?: string | null
          priority_score?: number
          reason?: string
          resolved_at?: string | null
          revenue_impact?: number | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agency_id: string | null
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          agent_id: string | null
          amenities: Json | null
          area: number
          badge: string | null
          bairro: string | null
          casas_banho: number | null
          created_at: string | null
          descricao: string | null
          embedding: string | null
          energia: string | null
          features: Json | null
          gradient: string | null
          id: string
          images: Json | null
          lat: number | null
          lifestyle_tags: Json | null
          lng: number | null
          matterport_url: string | null
          nome: string
          preco: number
          quartos: number | null
          status: string | null
          tipo: string
          updated_at: string | null
          views: string | null
          youtube_url: string | null
          zona: string
        }
        Insert: {
          agent_id?: string | null
          amenities?: Json | null
          area: number
          badge?: string | null
          bairro?: string | null
          casas_banho?: number | null
          created_at?: string | null
          descricao?: string | null
          embedding?: string | null
          energia?: string | null
          features?: Json | null
          gradient?: string | null
          id: string
          images?: Json | null
          lat?: number | null
          lifestyle_tags?: Json | null
          lng?: number | null
          matterport_url?: string | null
          nome: string
          preco: number
          quartos?: number | null
          status?: string | null
          tipo: string
          updated_at?: string | null
          views?: string | null
          youtube_url?: string | null
          zona: string
        }
        Update: {
          agent_id?: string | null
          amenities?: Json | null
          area?: number
          badge?: string | null
          bairro?: string | null
          casas_banho?: number | null
          created_at?: string | null
          descricao?: string | null
          embedding?: string | null
          energia?: string | null
          features?: Json | null
          gradient?: string | null
          id?: string
          images?: Json | null
          lat?: number | null
          lifestyle_tags?: Json | null
          lng?: number | null
          matterport_url?: string | null
          nome?: string
          preco?: number
          quartos?: number | null
          status?: string | null
          tipo?: string
          updated_at?: string | null
          views?: string | null
          youtube_url?: string | null
          zona?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      property_ai_analysis: {
        Row: {
          analysis_id: string
          analyzed_at: string
          architecture_style: string
          area_sqm: number | null
          bathrooms: number | null
          bedrooms: number | null
          condition: string
          confidence: number
          energy_class: string
          floor: number | null
          has_city_view: boolean
          has_elevator: boolean
          has_garden: boolean
          has_golf_view: boolean
          has_mountain_view: boolean
          has_parking: boolean
          has_pool: boolean
          has_sea_view: boolean
          id: string
          location: Json | null
          luxury_score: number
          org_id: string
          property_type: string | null
          renovation_probability: number
          staging_quality: string
          submission_id: string
          sunlight_score: number
        }
        Insert: {
          analysis_id: string
          analyzed_at?: string
          architecture_style?: string
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          condition?: string
          confidence?: number
          energy_class?: string
          floor?: number | null
          has_city_view?: boolean
          has_elevator?: boolean
          has_garden?: boolean
          has_golf_view?: boolean
          has_mountain_view?: boolean
          has_parking?: boolean
          has_pool?: boolean
          has_sea_view?: boolean
          id?: string
          location?: Json | null
          luxury_score?: number
          org_id: string
          property_type?: string | null
          renovation_probability?: number
          staging_quality?: string
          submission_id: string
          sunlight_score?: number
        }
        Update: {
          analysis_id?: string
          analyzed_at?: string
          architecture_style?: string
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          condition?: string
          confidence?: number
          energy_class?: string
          floor?: number | null
          has_city_view?: boolean
          has_elevator?: boolean
          has_garden?: boolean
          has_golf_view?: boolean
          has_mountain_view?: boolean
          has_parking?: boolean
          has_pool?: boolean
          has_sea_view?: boolean
          id?: string
          location?: Json | null
          luxury_score?: number
          org_id?: string
          property_type?: string | null
          renovation_probability?: number
          staging_quality?: string
          submission_id?: string
          sunlight_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_ai_analysis_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "property_ai_submissions"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      property_ai_copilot: {
        Row: {
          action_items: string[]
          ai_summary: string | null
          audience_profile: Json
          generated_at: string
          id: string
          org_id: string
          pricing_advice: Json
          publishing_strategy: Json
          readiness_report: Json
          submission_id: string
        }
        Insert: {
          action_items?: string[]
          ai_summary?: string | null
          audience_profile?: Json
          generated_at?: string
          id?: string
          org_id: string
          pricing_advice?: Json
          publishing_strategy?: Json
          readiness_report?: Json
          submission_id: string
        }
        Update: {
          action_items?: string[]
          ai_summary?: string | null
          audience_profile?: Json
          generated_at?: string
          id?: string
          org_id?: string
          pricing_advice?: Json
          publishing_strategy?: Json
          readiness_report?: Json
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_ai_copilot_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "property_ai_submissions"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      property_ai_distribution: {
        Row: {
          asset_url: string | null
          channel: string
          created_at: string
          distribution_id: string
          error: string | null
          id: string
          sent_at: string | null
          status: string
          submission_id: string
        }
        Insert: {
          asset_url?: string | null
          channel: string
          created_at?: string
          distribution_id: string
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          submission_id: string
        }
        Update: {
          asset_url?: string | null
          channel?: string
          created_at?: string
          distribution_id?: string
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_ai_distribution_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "property_ai_submissions"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      property_ai_intelligence: {
        Row: {
          computed_at: string
          conversion_probability: number
          demand_score: number
          featured_priority_score: number
          homepage_placement_score: number
          id: string
          intel_id: string
          investor_attractiveness: number
          lead_attractiveness: number
          liquidity_speed_days: number
          listing_readiness_score: number
          luxury_visibility_score: number
          org_id: string
          pricing_competitiveness: number
          submission_id: string
        }
        Insert: {
          computed_at?: string
          conversion_probability?: number
          demand_score?: number
          featured_priority_score?: number
          homepage_placement_score?: number
          id?: string
          intel_id: string
          investor_attractiveness?: number
          lead_attractiveness?: number
          liquidity_speed_days?: number
          listing_readiness_score?: number
          luxury_visibility_score?: number
          org_id: string
          pricing_competitiveness?: number
          submission_id: string
        }
        Update: {
          computed_at?: string
          conversion_probability?: number
          demand_score?: number
          featured_priority_score?: number
          homepage_placement_score?: number
          id?: string
          intel_id?: string
          investor_attractiveness?: number
          lead_attractiveness?: number
          liquidity_speed_days?: number
          listing_readiness_score?: number
          luxury_visibility_score?: number
          org_id?: string
          pricing_competitiveness?: number
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_ai_intelligence_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "property_ai_submissions"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      property_ai_learning_adjustments: {
        Row: {
          adjustment_id: string
          applied_at: string
          feature: string
          id: string
          new_weight: number
          old_weight: number
          org_id: string
          reason: string | null
        }
        Insert: {
          adjustment_id: string
          applied_at?: string
          feature: string
          id?: string
          new_weight: number
          old_weight: number
          org_id: string
          reason?: string | null
        }
        Update: {
          adjustment_id?: string
          applied_at?: string
          feature?: string
          id?: string
          new_weight?: number
          old_weight?: number
          org_id?: string
          reason?: string | null
        }
        Relationships: []
      }
      property_ai_listings: {
        Row: {
          confidence: number
          descriptions: Json
          estimated_price_eur: number | null
          generated_at: string
          id: string
          investor_descriptions: Json
          listing_id: string
          luxury_descriptions: Json
          meta_descriptions: Json
          org_id: string
          price_per_sqm: number | null
          seo_keywords: string[]
          seo_titles: Json
          short_descriptions: Json
          social_captions: Json
          submission_id: string
          titles: Json
        }
        Insert: {
          confidence?: number
          descriptions?: Json
          estimated_price_eur?: number | null
          generated_at?: string
          id?: string
          investor_descriptions?: Json
          listing_id: string
          luxury_descriptions?: Json
          meta_descriptions?: Json
          org_id: string
          price_per_sqm?: number | null
          seo_keywords?: string[]
          seo_titles?: Json
          short_descriptions?: Json
          social_captions?: Json
          submission_id: string
          titles?: Json
        }
        Update: {
          confidence?: number
          descriptions?: Json
          estimated_price_eur?: number | null
          generated_at?: string
          id?: string
          investor_descriptions?: Json
          listing_id?: string
          luxury_descriptions?: Json
          meta_descriptions?: Json
          org_id?: string
          price_per_sqm?: number | null
          seo_keywords?: string[]
          seo_titles?: Json
          short_descriptions?: Json
          social_captions?: Json
          submission_id?: string
          titles?: Json
        }
        Relationships: [
          {
            foreignKeyName: "property_ai_listings_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "property_ai_submissions"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      property_ai_media: {
        Row: {
          aesthetic_score: number
          asset_id: string
          created_at: string
          hero_crop_url: string | null
          id: string
          is_blurry: boolean
          is_cover: boolean
          is_duplicate: boolean
          sequence_order: number
          social_crop_url: string | null
          submission_id: string
          thumbnail_url: string | null
          type: string
          url: string
        }
        Insert: {
          aesthetic_score?: number
          asset_id: string
          created_at?: string
          hero_crop_url?: string | null
          id?: string
          is_blurry?: boolean
          is_cover?: boolean
          is_duplicate?: boolean
          sequence_order?: number
          social_crop_url?: string | null
          submission_id: string
          thumbnail_url?: string | null
          type: string
          url: string
        }
        Update: {
          aesthetic_score?: number
          asset_id?: string
          created_at?: string
          hero_crop_url?: string | null
          id?: string
          is_blurry?: boolean
          is_cover?: boolean
          is_duplicate?: boolean
          sequence_order?: number
          social_crop_url?: string | null
          submission_id?: string
          thumbnail_url?: string | null
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_ai_media_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "property_ai_submissions"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      property_ai_performance_events: {
        Row: {
          channel: string
          event_id: string
          event_type: string
          id: string
          occurred_at: string
          org_id: string
          session_id: string | null
          submission_id: string
        }
        Insert: {
          channel: string
          event_id: string
          event_type: string
          id?: string
          occurred_at?: string
          org_id: string
          session_id?: string | null
          submission_id: string
        }
        Update: {
          channel?: string
          event_id?: string
          event_type?: string
          id?: string
          occurred_at?: string
          org_id?: string
          session_id?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_ai_performance_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "property_ai_submissions"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      property_ai_submissions: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          input_files: Json
          org_id: string
          raw_description: string | null
          raw_url: string | null
          status: string
          submission_id: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          input_files?: Json
          org_id: string
          raw_description?: string | null
          raw_url?: string | null
          status?: string
          submission_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          input_files?: Json
          org_id?: string
          raw_description?: string | null
          raw_url?: string | null
          status?: string
          submission_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      property_alert_sent: {
        Row: {
          contact_id: number | null
          email: string
          id: string
          property_id: string
          sent_at: string
          zona: string | null
        }
        Insert: {
          contact_id?: number | null
          email: string
          id?: string
          property_id: string
          sent_at?: string
          zona?: string | null
        }
        Update: {
          contact_id?: number | null
          email?: string
          id?: string
          property_id?: string
          sent_at?: string
          zona?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_alert_sent_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_match_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_alert_sent_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_alert_sent_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_alert_sent_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_alert_sent_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_buyer_audit"
            referencedColumns: ["id"]
          },
        ]
      }
      property_collections: {
        Row: {
          agent_id: string | null
          ai_profile: string | null
          client_email: string | null
          client_name: string | null
          comments: Json | null
          created_at: string | null
          expires_at: string | null
          id: string
          items: Json | null
          last_viewed_at: string | null
          name: string
          share_token: string
          updated_at: string | null
          views: number | null
        }
        Insert: {
          agent_id?: string | null
          ai_profile?: string | null
          client_email?: string | null
          client_name?: string | null
          comments?: Json | null
          created_at?: string | null
          expires_at?: string | null
          id: string
          items?: Json | null
          last_viewed_at?: string | null
          name?: string
          share_token: string
          updated_at?: string | null
          views?: number | null
        }
        Update: {
          agent_id?: string | null
          ai_profile?: string | null
          client_email?: string | null
          client_name?: string | null
          comments?: Json | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          items?: Json | null
          last_viewed_at?: string | null
          name?: string
          share_token?: string
          updated_at?: string | null
          views?: number | null
        }
        Relationships: []
      }
      provider_reliability_reports: {
        Row: {
          avg_trust_score: number
          blockers: Json
          certification_hash: string
          certified_count: number
          created_at: string
          degraded_count: number
          failed_count: number
          generated_at: string
          id: number
          overall_score: number
          reliability_grade: string
          report_id: string
          report_json: Json
          tenant_id: string
          total_providers: number
          unconfigured_count: number
        }
        Insert: {
          avg_trust_score?: number
          blockers?: Json
          certification_hash: string
          certified_count?: number
          created_at?: string
          degraded_count?: number
          failed_count?: number
          generated_at?: string
          id?: number
          overall_score?: number
          reliability_grade?: string
          report_id?: string
          report_json?: Json
          tenant_id: string
          total_providers?: number
          unconfigured_count?: number
        }
        Update: {
          avg_trust_score?: number
          blockers?: Json
          certification_hash?: string
          certified_count?: number
          created_at?: string
          degraded_count?: number
          failed_count?: number
          generated_at?: string
          id?: number
          overall_score?: number
          reliability_grade?: string
          report_id?: string
          report_json?: Json
          tenant_id?: string
          total_providers?: number
          unconfigured_count?: number
        }
        Relationships: []
      }
      public_saved_searches: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          keyword: string | null
          last_notified_at: string | null
          notify_count: number | null
          piscina: boolean | null
          preco_max: number | null
          preco_min: number | null
          purpose: string | null
          quartos_min: number | null
          source: string | null
          tipo: string | null
          updated_at: string | null
          zona: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          keyword?: string | null
          last_notified_at?: string | null
          notify_count?: number | null
          piscina?: boolean | null
          preco_max?: number | null
          preco_min?: number | null
          purpose?: string | null
          quartos_min?: number | null
          source?: string | null
          tipo?: string | null
          updated_at?: string | null
          zona?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          keyword?: string | null
          last_notified_at?: string | null
          notify_count?: number | null
          piscina?: boolean | null
          preco_max?: number | null
          preco_min?: number | null
          purpose?: string | null
          quartos_min?: number | null
          source?: string | null
          tipo?: string | null
          updated_at?: string | null
          zona?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string | null
          contact_id: number | null
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string | null
        }
        Insert: {
          auth_key?: string | null
          contact_id?: number | null
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh?: string | null
        }
        Update: {
          auth_key?: string | null
          contact_id?: number | null
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_match_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_buyer_audit"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          contact_id: number | null
          created_at: string | null
          id: number
          platform: string | null
          token: string
          user_id: string | null
        }
        Insert: {
          contact_id?: number | null
          created_at?: string | null
          id?: number
          platform?: string | null
          token: string
          user_id?: string | null
        }
        Update: {
          contact_id?: number | null
          created_at?: string | null
          id?: number
          platform?: string | null
          token?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_match_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_tokens_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_tokens_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_tokens_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_tokens_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_buyer_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_poison_quarantine: {
        Row: {
          created_at: string
          failure_count: number
          failure_reason: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          org_id: string
          original_id: string
          payload: Json | null
          queue_name: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          failure_count?: number
          failure_reason?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          org_id?: string
          original_id: string
          payload?: Json | null
          queue_name: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          failure_count?: number
          failure_reason?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          org_id?: string
          original_id?: string
          payload?: Json | null
          queue_name?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reality_monitor_snapshots: {
        Row: {
          blockers: Json
          created_at: string
          fail_count: number
          generated_at: string
          id: number
          monitor_hash: string
          operational_readiness_score: number
          pass_count: number
          reality_score: number
          report_id: string
          report_json: Json
          system_health_score: number
          tenant_id: string
          total_checks: number
          warn_count: number
        }
        Insert: {
          blockers?: Json
          created_at?: string
          fail_count?: number
          generated_at?: string
          id?: number
          monitor_hash: string
          operational_readiness_score?: number
          pass_count?: number
          reality_score?: number
          report_id?: string
          report_json?: Json
          system_health_score?: number
          tenant_id: string
          total_checks?: number
          warn_count?: number
        }
        Update: {
          blockers?: Json
          created_at?: string
          fail_count?: number
          generated_at?: string
          id?: number
          monitor_hash?: string
          operational_readiness_score?: number
          pass_count?: number
          reality_score?: number
          report_id?: string
          report_json?: Json
          system_health_score?: number
          tenant_id?: string
          total_checks?: number
          warn_count?: number
        }
        Relationships: []
      }
      rollback_events: {
        Row: {
          accuracy_drop_pct: number | null
          created_at: string
          from_version: string
          id: string
          model_name: string
          reason: string
          severity: string
          to_version: string
          triggered_at: string
        }
        Insert: {
          accuracy_drop_pct?: number | null
          created_at?: string
          from_version: string
          id?: string
          model_name: string
          reason: string
          severity: string
          to_version: string
          triggered_at?: string
        }
        Update: {
          accuracy_drop_pct?: number | null
          created_at?: string
          from_version?: string
          id?: string
          model_name?: string
          reason?: string
          severity?: string
          to_version?: string
          triggered_at?: string
        }
        Relationships: []
      }
      runtime_events: {
        Row: {
          agent_id: string | null
          agents_completed: string[]
          agents_failed: string[] | null
          agents_triggered: string[] | null
          correlation_id: string | null
          created_at: string
          economic_score: number | null
          event_id: string
          event_timestamp: string
          last_error: string | null
          org_id: string
          payload: Json | null
          priority_weight: number
          processed_at: string | null
          result: Json | null
          retry_count: number
          schema_version: string
          source_system: string | null
          status: string
          trace_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          agents_completed?: string[]
          agents_failed?: string[] | null
          agents_triggered?: string[] | null
          correlation_id?: string | null
          created_at?: string
          economic_score?: number | null
          event_id?: string
          event_timestamp?: string
          last_error?: string | null
          org_id: string
          payload?: Json | null
          priority_weight?: number
          processed_at?: string | null
          result?: Json | null
          retry_count?: number
          schema_version?: string
          source_system?: string | null
          status?: string
          trace_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          agents_completed?: string[]
          agents_failed?: string[] | null
          agents_triggered?: string[] | null
          correlation_id?: string | null
          created_at?: string
          economic_score?: number | null
          event_id?: string
          event_timestamp?: string
          last_error?: string | null
          org_id?: string
          payload?: Json | null
          priority_weight?: number
          processed_at?: string | null
          result?: Json | null
          retry_count?: number
          schema_version?: string
          source_system?: string | null
          status?: string
          trace_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      runtime_state: {
        Row: {
          key: string
          updated_at: string
          value_integer: number | null
          value_text: string | null
          value_timestamp: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value_integer?: number | null
          value_text?: string | null
          value_timestamp?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value_integer?: number | null
          value_text?: string | null
          value_timestamp?: string | null
        }
        Relationships: []
      }
      scoring_logs: {
        Row: {
          breakdown: Json
          id: string
          lead_id: string
          reason: string | null
          score: number
          scored_at: string
          tier: string
        }
        Insert: {
          breakdown: Json
          id?: string
          lead_id: string
          reason?: string | null
          score: number
          scored_at?: string
          tier: string
        }
        Update: {
          breakdown?: Json
          id?: string
          lead_id?: string
          reason?: string | null
          score?: number
          scored_at?: string
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      search_runs: {
        Row: {
          actor: string
          duplicates_skipped: number
          duration_ms: number | null
          errors: Json
          finished_at: string | null
          id: string
          market: string
          persona: string
          query: string
          results_normalized: number
          results_raw: number
          results_stored: number
          search_id: string | null
          started_at: string
          status: string
        }
        Insert: {
          actor: string
          duplicates_skipped?: number
          duration_ms?: number | null
          errors?: Json
          finished_at?: string | null
          id?: string
          market: string
          persona: string
          query: string
          results_normalized?: number
          results_raw?: number
          results_stored?: number
          search_id?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          actor?: string
          duplicates_skipped?: number
          duration_ms?: number | null
          errors?: Json
          finished_at?: string | null
          id?: string
          market?: string
          persona?: string
          query?: string
          results_normalized?: number
          results_raw?: number
          results_stored?: number
          search_id?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_runs_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
        ]
      }
      searches: {
        Row: {
          active: boolean
          actor: string
          created_at: string
          id: string
          language: string | null
          market: string
          persona: string
          priority: number
          query: string
        }
        Insert: {
          active?: boolean
          actor: string
          created_at?: string
          id?: string
          language?: string | null
          market: string
          persona: string
          priority?: number
          query: string
        }
        Update: {
          active?: boolean
          actor?: string
          created_at?: string
          id?: string
          language?: string | null
          market?: string
          persona?: string
          priority?: number
          query?: string
        }
        Relationships: []
      }
      secret_rotation_log: {
        Row: {
          id: string
          notes: string | null
          rotated_at: string
          rotated_by: string | null
          secret_name: string
        }
        Insert: {
          id?: string
          notes?: string | null
          rotated_at?: string
          rotated_by?: string | null
          secret_name: string
        }
        Update: {
          id?: string
          notes?: string | null
          rotated_at?: string
          rotated_by?: string | null
          secret_name?: string
        }
        Relationships: []
      }
      security_defense_runs: {
        Row: {
          any_failure: boolean
          created_at: string
          defense_id: string
          dr_status: string
          escalated: boolean
          id: number
          logs_integrity: boolean
          report_json: Json
          tenant_id: string
          vault_status: string
          waf_status: string
        }
        Insert: {
          any_failure?: boolean
          created_at?: string
          defense_id?: string
          dr_status?: string
          escalated?: boolean
          id?: number
          logs_integrity?: boolean
          report_json?: Json
          tenant_id: string
          vault_status?: string
          waf_status?: string
        }
        Update: {
          any_failure?: boolean
          created_at?: string
          defense_id?: string
          dr_status?: string
          escalated?: boolean
          id?: number
          logs_integrity?: boolean
          report_json?: Json
          tenant_id?: string
          vault_status?: string
          waf_status?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          correlation_id: string | null
          created_at: string
          description: string
          event_type: string
          id: string
          metadata: Json | null
          severity: string
          source: string
          tenant_id: string | null
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          description: string
          event_type: string
          id?: string
          metadata?: Json | null
          severity: string
          source: string
          tenant_id?: string | null
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          severity?: string
          source?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      shard_assignments: {
        Row: {
          assigned_at: string
          id: string
          region: string
          shard_id: number
          worker_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          region: string
          shard_id: number
          worker_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          region?: string
          shard_id?: number
          worker_id?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          agent_id: string | null
          created_at: string
          data: Json | null
          description: string | null
          id: string
          priority: string
          property_id: string | null
          source: string | null
          source_url: string | null
          status: string
          title: string
          type: string
          zone: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          data?: Json | null
          description?: string | null
          id?: string
          priority?: string
          property_id?: string | null
          source?: string | null
          source_url?: string | null
          status?: string
          title: string
          type: string
          zone?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          data?: Json | null
          description?: string | null
          id?: string
          priority?: string
          property_id?: string | null
          source?: string | null
          source_url?: string | null
          status?: string
          title?: string
          type?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      soc_incidents: {
        Row: {
          context_json: Json
          created_at: string
          description: string
          human_ack_at: string | null
          human_ack_required: boolean
          id: number
          incident_id: string
          level: string
          type: string
        }
        Insert: {
          context_json?: Json
          created_at?: string
          description?: string
          human_ack_at?: string | null
          human_ack_required?: boolean
          id?: number
          incident_id?: string
          level?: string
          type: string
        }
        Update: {
          context_json?: Json
          created_at?: string
          description?: string
          human_ack_at?: string | null
          human_ack_required?: boolean
          id?: number
          incident_id?: string
          level?: string
          type?: string
        }
        Relationships: []
      }
      sofia_conversation_turns: {
        Row: {
          channel: string
          contact_id: string
          created_at: string
          entities_json: Json
          escalated: boolean
          id: number
          intent: string
          lead_score: number
          nba: string
          response_text: string
          role: string
          session_id: string
          tenant_id: string
          user_message: string
        }
        Insert: {
          channel?: string
          contact_id: string
          created_at?: string
          entities_json?: Json
          escalated?: boolean
          id?: number
          intent?: string
          lead_score?: number
          nba?: string
          response_text?: string
          role: string
          session_id: string
          tenant_id: string
          user_message: string
        }
        Update: {
          channel?: string
          contact_id?: string
          created_at?: string
          entities_json?: Json
          escalated?: boolean
          id?: number
          intent?: string
          lead_score?: number
          nba?: string
          response_text?: string
          role?: string
          session_id?: string
          tenant_id?: string
          user_message?: string
        }
        Relationships: []
      }
      sofia_conversations: {
        Row: {
          assistant_message: string
          context: Json | null
          created_at: string | null
          id: string
          mode: string | null
          property_ref: string | null
          session_id: string
          user_ip: string | null
          user_message: string
        }
        Insert: {
          assistant_message: string
          context?: Json | null
          created_at?: string | null
          id?: string
          mode?: string | null
          property_ref?: string | null
          session_id: string
          user_ip?: string | null
          user_message: string
        }
        Update: {
          assistant_message?: string
          context?: Json | null
          created_at?: string | null
          id?: string
          mode?: string | null
          property_ref?: string | null
          session_id?: string
          user_ip?: string | null
          user_message?: string
        }
        Relationships: []
      }
      sofia_escalations: {
        Row: {
          acknowledged: boolean
          assigned_to: string | null
          contact_id: string
          context: string
          created_at: string
          escalated_at: string
          escalation_id: string
          id: number
          lead_id: string | null
          reason: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          acknowledged?: boolean
          assigned_to?: string | null
          contact_id: string
          context?: string
          created_at?: string
          escalated_at?: string
          escalation_id?: string
          id?: number
          lead_id?: string | null
          reason: string
          session_id: string
          tenant_id: string
        }
        Update: {
          acknowledged?: boolean
          assigned_to?: string | null
          contact_id?: string
          context?: string
          created_at?: string
          escalated_at?: string
          escalation_id?: string
          id?: number
          lead_id?: string | null
          reason?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      sofia_memory: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          conversation_count: number | null
          created_at: string | null
          id: string
          last_active_at: string | null
          preferences: Json | null
          preferred_types: string[] | null
          preferred_zones: string[] | null
          search_history: Json[] | null
          session_id: string
          user_id: string | null
          viewed_properties: string[] | null
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          conversation_count?: number | null
          created_at?: string | null
          id?: string
          last_active_at?: string | null
          preferences?: Json | null
          preferred_types?: string[] | null
          preferred_zones?: string[] | null
          search_history?: Json[] | null
          session_id: string
          user_id?: string | null
          viewed_properties?: string[] | null
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          conversation_count?: number | null
          created_at?: string | null
          id?: string
          last_active_at?: string | null
          preferences?: Json | null
          preferred_types?: string[] | null
          preferred_zones?: string[] | null
          search_history?: Json[] | null
          session_id?: string
          user_id?: string | null
          viewed_properties?: string[] | null
        }
        Relationships: []
      }
      suppression_list: {
        Row: {
          added_at: string
          added_by: string
          domain: string | null
          email: string | null
          full_name: string | null
          id: string
          linkedin_url: string | null
          reason: string
        }
        Insert: {
          added_at?: string
          added_by?: string
          domain?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          linkedin_url?: string | null
          reason: string
        }
        Update: {
          added_at?: string
          added_by?: string
          domain?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          linkedin_url?: string | null
          reason?: string
        }
        Relationships: []
      }
      system_health_dashboards: {
        Row: {
          alert_score: number
          created_at: string
          dashboard_hash: string
          dashboard_id: string
          degraded_count: number
          down_count: number
          generated_at: string
          health_score: number
          healthy_count: number
          id: number
          overall_health: string
          reality_score: number
          report_json: Json
          service_count: number
          tenant_id: string
        }
        Insert: {
          alert_score?: number
          created_at?: string
          dashboard_hash: string
          dashboard_id?: string
          degraded_count?: number
          down_count?: number
          generated_at?: string
          health_score?: number
          healthy_count?: number
          id?: number
          overall_health?: string
          reality_score?: number
          report_json?: Json
          service_count?: number
          tenant_id: string
        }
        Update: {
          alert_score?: number
          created_at?: string
          dashboard_hash?: string
          dashboard_id?: string
          degraded_count?: number
          down_count?: number
          generated_at?: string
          health_score?: number
          healthy_count?: number
          id?: number
          overall_health?: string
          reality_score?: number
          report_json?: Json
          service_count?: number
          tenant_id?: string
        }
        Relationships: []
      }
      system_isolation_flags: {
        Row: {
          activated_at: string
          deactivated_at: string | null
          flag_id: string
          id: number
          isolated: boolean
          reason: string
          scope: string
          tenant_id: string
        }
        Insert: {
          activated_at?: string
          deactivated_at?: string | null
          flag_id: string
          id?: number
          isolated?: boolean
          reason?: string
          scope: string
          tenant_id: string
        }
        Update: {
          activated_at?: string
          deactivated_at?: string | null
          flag_id?: string
          id?: number
          isolated?: boolean
          reason?: string
          scope?: string
          tenant_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          agent_id: string | null
          contact_id: number | null
          created_at: string
          deal_id: number | null
          description: string | null
          done_at: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          contact_id?: number | null
          created_at?: string
          deal_id?: number | null
          description?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          contact_id?: number | null
          created_at?: string
          deal_id?: number | null
          description?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_match_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_buyer_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_events: {
        Row: {
          correlation_id: string | null
          created_at: string
          critical: boolean
          data_json: Json
          event_id: string
          event_type: string
          id: number
          severity: string
          source: string
          tenant_id: string
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          critical?: boolean
          data_json?: Json
          event_id?: string
          event_type: string
          id?: number
          severity?: string
          source: string
          tenant_id: string
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          critical?: boolean
          data_json?: Json
          event_id?: string
          event_type?: string
          id?: number
          severity?: string
          source?: string
          tenant_id?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          created_at: string
          feature_flags: Json | null
          id: string
          name: string
          org_id: string | null
          owner_email: string
          plan: string
          settings: Json | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_flags?: Json | null
          id?: string
          name: string
          org_id?: string | null
          owner_email: string
          plan?: string
          settings?: Json | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_flags?: Json | null
          id?: string
          name?: string
          org_id?: string | null
          owner_email?: string
          plan?: string
          settings?: Json | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactional_decisions: {
        Row: {
          completed_at: string | null
          created_at: string
          decision_id: string
          inputs_snapshot: Json | null
          opportunity_score: number | null
          property_id: string
          recipient_count: number | null
          result_summary: Json | null
          routing_tier: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          decision_id: string
          inputs_snapshot?: Json | null
          opportunity_score?: number | null
          property_id: string
          recipient_count?: number | null
          result_summary?: Json | null
          routing_tier?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          decision_id?: string
          inputs_snapshot?: Json | null
          opportunity_score?: number | null
          property_id?: string
          recipient_count?: number | null
          result_summary?: Json | null
          routing_tier?: string | null
          status?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          agent_id: string | null
          billed_at: string
          correlation_id: string | null
          event_type: string
          id: string
          metadata: Json | null
          quantity: number
          tenant_id: string
        }
        Insert: {
          agent_id?: string | null
          billed_at?: string
          correlation_id?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          quantity?: number
          tenant_id: string
        }
        Update: {
          agent_id?: string | null
          billed_at?: string
          correlation_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          quantity?: number
          tenant_id?: string
        }
        Relationships: []
      }
      used_magic_tokens: {
        Row: {
          email: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string
        }
        Insert: {
          email: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string
        }
        Update: {
          email?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          ami: string | null
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          password_hash: string | null
          phone: string | null
          role: string | null
          totp_secret: string | null
          totp_secret_pending: string | null
          updated_at: string | null
        }
        Insert: {
          ami?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          name: string
          password_hash?: string | null
          phone?: string | null
          role?: string | null
          totp_secret?: string | null
          totp_secret_pending?: string | null
          updated_at?: string | null
        }
        Update: {
          ami?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          password_hash?: string | null
          phone?: string | null
          role?: string | null
          totp_secret?: string | null
          totp_secret_pending?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vault_events: {
        Row: {
          author: string | null
          correlation_id: string | null
          created_at: string
          id: string
          new_state_hash: string | null
          payload: Json | null
          previous_state_hash: string | null
          reason: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          author?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          new_state_hash?: string | null
          payload?: Json | null
          previous_state_hash?: string | null
          reason?: string | null
          tenant_id?: string
          type: string
        }
        Update: {
          author?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          new_state_hash?: string | null
          payload?: Json | null
          previous_state_hash?: string | null
          reason?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: []
      }
      vault_file_hashes: {
        Row: {
          computed_at: string
          hash: string
          id: string
          path: string
          size: number | null
          tenant_id: string
        }
        Insert: {
          computed_at?: string
          hash: string
          id?: string
          path: string
          size?: number | null
          tenant_id?: string
        }
        Update: {
          computed_at?: string
          hash?: string
          id?: string
          path?: string
          size?: number | null
          tenant_id?: string
        }
        Relationships: []
      }
      vault_integrity_scores: {
        Row: {
          alerts: Json | null
          backup_freshness: number
          computed_at: string
          drift_score: number
          id: string
          overall_score: number
          replay_readiness: number
          tenant_id: string
          vault_completeness: number
        }
        Insert: {
          alerts?: Json | null
          backup_freshness: number
          computed_at?: string
          drift_score: number
          id?: string
          overall_score: number
          replay_readiness: number
          tenant_id?: string
          vault_completeness: number
        }
        Update: {
          alerts?: Json | null
          backup_freshness?: number
          computed_at?: string
          drift_score?: number
          id?: string
          overall_score?: number
          replay_readiness?: number
          tenant_id?: string
          vault_completeness?: number
        }
        Relationships: []
      }
      vault_snapshots: {
        Row: {
          created_at: string
          files_present: number | null
          id: string
          manifest: Json | null
          snapshot_id: string
          tenant_id: string
          vault_file_count: number | null
        }
        Insert: {
          created_at?: string
          files_present?: number | null
          id?: string
          manifest?: Json | null
          snapshot_id: string
          tenant_id?: string
          vault_file_count?: number | null
        }
        Update: {
          created_at?: string
          files_present?: number | null
          id?: string
          manifest?: Json | null
          snapshot_id?: string
          tenant_id?: string
          vault_file_count?: number | null
        }
        Relationships: []
      }
      visitas: {
        Row: {
          agent_id: string | null
          ai_suggestion: string | null
          contact_id: number | null
          contact_name: string | null
          created_at: string
          date: string
          feedback: string | null
          id: string
          interest_score: number | null
          notes: string | null
          property_id: string | null
          property_name: string | null
          status: string
          time: string | null
          updated_at: string
          visit_type: string
        }
        Insert: {
          agent_id?: string | null
          ai_suggestion?: string | null
          contact_id?: number | null
          contact_name?: string | null
          created_at?: string
          date: string
          feedback?: string | null
          id?: string
          interest_score?: number | null
          notes?: string | null
          property_id?: string | null
          property_name?: string | null
          status?: string
          time?: string | null
          updated_at?: string
          visit_type?: string
        }
        Update: {
          agent_id?: string | null
          ai_suggestion?: string | null
          contact_id?: number | null
          contact_name?: string | null
          created_at?: string
          date?: string
          feedback?: string | null
          id?: string
          interest_score?: number | null
          notes?: string | null
          property_id?: string | null
          property_name?: string | null
          status?: string
          time?: string | null
          updated_at?: string
          visit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitas_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_match_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_buyer_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          agent_id: string | null
          contact_id: number | null
          created_at: string
          deal_id: number | null
          feedback: string | null
          id: string
          interest_score: number | null
          notes: string | null
          property_id: string | null
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          contact_id?: number | null
          created_at?: string
          deal_id?: number | null
          feedback?: string | null
          id?: string
          interest_score?: number | null
          notes?: string | null
          property_id?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          contact_id?: number | null
          created_at?: string
          deal_id?: number | null
          feedback?: string | null
          id?: string
          interest_score?: number | null
          notes?: string | null
          property_id?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_match_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "buyer_pool_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_buyer_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_registrations: {
        Row: {
          error_rate: number
          id: string
          is_healthy: boolean
          last_heartbeat: string
          metadata: Json | null
          partition_count: number
          region: string
          registered_at: string
          worker_id: string
        }
        Insert: {
          error_rate?: number
          id?: string
          is_healthy?: boolean
          last_heartbeat?: string
          metadata?: Json | null
          partition_count?: number
          region: string
          registered_at?: string
          worker_id: string
        }
        Update: {
          error_rate?: number
          id?: string
          is_healthy?: boolean
          last_heartbeat?: string
          metadata?: Json | null
          partition_count?: number
          region?: string
          registered_at?: string
          worker_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      buyer_match_candidates: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          budget_tier_label: string | null
          email: string | null
          financing_type: string | null
          full_name: string | null
          id: number | null
          last_contact_at: string | null
          lead_score: number | null
          lead_tier: Database["public"]["Enums"]["lead_tier"] | null
          next_followup_at: string | null
          phone: string | null
          preferred_locations: string[] | null
          status: string | null
          timeline: string | null
          typologies_wanted: string[] | null
          whatsapp: string | null
          zone_count: number | null
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          budget_tier_label?: never
          email?: string | null
          financing_type?: string | null
          full_name?: string | null
          id?: number | null
          last_contact_at?: string | null
          lead_score?: number | null
          lead_tier?: Database["public"]["Enums"]["lead_tier"] | null
          next_followup_at?: string | null
          phone?: string | null
          preferred_locations?: string[] | null
          status?: string | null
          timeline?: string | null
          typologies_wanted?: string[] | null
          whatsapp?: string | null
          zone_count?: never
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          budget_tier_label?: never
          email?: string | null
          financing_type?: string | null
          full_name?: string | null
          id?: number | null
          last_contact_at?: string | null
          lead_score?: number | null
          lead_tier?: Database["public"]["Enums"]["lead_tier"] | null
          next_followup_at?: string | null
          phone?: string | null
          preferred_locations?: string[] | null
          status?: string | null
          timeline?: string | null
          typologies_wanted?: string[] | null
          whatsapp?: string | null
          zone_count?: never
        }
        Relationships: []
      }
      buyer_pool: {
        Row: {
          active_status: string | null
          avg_close_days: number | null
          budget_max: number | null
          budget_min: number | null
          budget_tier_label: string | null
          buyer_score: number | null
          buyer_score_reason: string | null
          buyer_scored_at: string | null
          buyer_type: string | null
          created_at: string | null
          days_since_contact: number | null
          deals_closed_count: number | null
          email: string | null
          engagement_temperature: string | null
          full_name: string | null
          id: number | null
          last_contact_at: string | null
          lead_score: number | null
          lead_tier: Database["public"]["Enums"]["lead_tier"] | null
          liquidity_profile: string | null
          negotiation_style: string | null
          next_followup_at: string | null
          phone: string | null
          preferred_locations: string[] | null
          proof_of_funds_status: string | null
          reliability_score: number | null
          response_rate: number | null
          target_strategy: string | null
          total_interactions: number | null
          typologies_wanted: string[] | null
          whatsapp: string | null
        }
        Insert: {
          active_status?: string | null
          avg_close_days?: number | null
          budget_max?: number | null
          budget_min?: number | null
          budget_tier_label?: never
          buyer_score?: number | null
          buyer_score_reason?: string | null
          buyer_scored_at?: string | null
          buyer_type?: string | null
          created_at?: string | null
          days_since_contact?: never
          deals_closed_count?: number | null
          email?: string | null
          engagement_temperature?: never
          full_name?: string | null
          id?: number | null
          last_contact_at?: string | null
          lead_score?: number | null
          lead_tier?: Database["public"]["Enums"]["lead_tier"] | null
          liquidity_profile?: string | null
          negotiation_style?: string | null
          next_followup_at?: string | null
          phone?: string | null
          preferred_locations?: string[] | null
          proof_of_funds_status?: string | null
          reliability_score?: number | null
          response_rate?: number | null
          target_strategy?: string | null
          total_interactions?: number | null
          typologies_wanted?: string[] | null
          whatsapp?: string | null
        }
        Update: {
          active_status?: string | null
          avg_close_days?: number | null
          budget_max?: number | null
          budget_min?: number | null
          budget_tier_label?: never
          buyer_score?: number | null
          buyer_score_reason?: string | null
          buyer_scored_at?: string | null
          buyer_type?: string | null
          created_at?: string | null
          days_since_contact?: never
          deals_closed_count?: number | null
          email?: string | null
          engagement_temperature?: never
          full_name?: string | null
          id?: number | null
          last_contact_at?: string | null
          lead_score?: number | null
          lead_tier?: Database["public"]["Enums"]["lead_tier"] | null
          liquidity_profile?: string | null
          negotiation_style?: string | null
          next_followup_at?: string | null
          phone?: string | null
          preferred_locations?: string[] | null
          proof_of_funds_status?: string | null
          reliability_score?: number | null
          response_rate?: number | null
          target_strategy?: string | null
          total_interactions?: number | null
          typologies_wanted?: string[] | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      buyer_pool_audit: {
        Row: {
          active_status: string | null
          buyer_readiness_score: number | null
          buyer_score: number | null
          buyer_scored_at: string | null
          email: string | null
          full_name: string | null
          id: number | null
          last_contact_at: string | null
          lead_tier: Database["public"]["Enums"]["lead_tier"] | null
          missing_budget: boolean | null
          missing_liquidity: boolean | null
          missing_types: boolean | null
          missing_zones: boolean | null
          no_deal_history: boolean | null
          phone: string | null
          status: string | null
        }
        Insert: {
          active_status?: string | null
          buyer_readiness_score?: never
          buyer_score?: number | null
          buyer_scored_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: number | null
          last_contact_at?: string | null
          lead_tier?: Database["public"]["Enums"]["lead_tier"] | null
          missing_budget?: never
          missing_liquidity?: never
          missing_types?: never
          missing_zones?: never
          no_deal_history?: never
          phone?: string | null
          status?: string | null
        }
        Update: {
          active_status?: string | null
          buyer_readiness_score?: never
          buyer_score?: number | null
          buyer_scored_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: number | null
          last_contact_at?: string | null
          lead_tier?: Database["public"]["Enums"]["lead_tier"] | null
          missing_budget?: never
          missing_liquidity?: never
          missing_types?: never
          missing_zones?: never
          no_deal_history?: never
          phone?: string | null
          status?: string | null
        }
        Relationships: []
      }
      contacts_buyer_audit: {
        Row: {
          buyer_readiness_score: number | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: number | null
          last_contact_at: string | null
          lead_score: number | null
          lead_tier: Database["public"]["Enums"]["lead_tier"] | null
          missing_budget: boolean | null
          missing_tier: boolean | null
          missing_tipos: boolean | null
          missing_zones: boolean | null
          phone: string | null
          status: string | null
        }
        Insert: {
          buyer_readiness_score?: never
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: number | null
          last_contact_at?: string | null
          lead_score?: number | null
          lead_tier?: Database["public"]["Enums"]["lead_tier"] | null
          missing_budget?: never
          missing_tier?: never
          missing_tipos?: never
          missing_zones?: never
          phone?: string | null
          status?: string | null
        }
        Update: {
          buyer_readiness_score?: never
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: number | null
          last_contact_at?: string | null
          lead_score?: number | null
          lead_tier?: Database["public"]["Enums"]["lead_tier"] | null
          missing_budget?: never
          missing_tier?: never
          missing_tipos?: never
          missing_zones?: never
          phone?: string | null
          status?: string | null
        }
        Relationships: []
      }
      mv_agent_revenue: {
        Row: {
          agent_id: string | null
          avg_revenue: number | null
          deal_count: number | null
          last_activity: string | null
          success_rate: number | null
          tenant_id: string | null
          total_revenue: number | null
        }
        Relationships: []
      }
      mv_deal_flow_paths: {
        Row: {
          completed_at: string | null
          correlation_id: string | null
          duration_seconds: number | null
          flow_path: string | null
          fully_successful: boolean | null
          started_at: string | null
          step_count: number | null
          tenant_id: string | null
          total_revenue: number | null
        }
        Relationships: []
      }
      mv_tenant_graph_stats: {
        Row: {
          active_agents: number | null
          avg_deal_revenue: number | null
          last_activity: string | null
          overall_success_rate: number | null
          tenant_id: string | null
          total_deals: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      offmarket_risk_flags: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          deal_risk_level: string | null
          id: string | null
          last_contact_at: string | null
          next_followup_at: string | null
          nome: string | null
          risk_flags: string[] | null
          score: number | null
          sla_breach: boolean | null
          status: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          deal_risk_level?: string | null
          id?: string | null
          last_contact_at?: string | null
          next_followup_at?: string | null
          nome?: string | null
          risk_flags?: never
          score?: number | null
          sla_breach?: boolean | null
          status?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          deal_risk_level?: string | null
          id?: string | null
          last_contact_at?: string | null
          next_followup_at?: string | null
          nome?: string | null
          risk_flags?: never
          score?: number | null
          sla_breach?: boolean | null
          status?: string | null
        }
        Relationships: []
      }
      v_economic_truth_summary: {
        Row: {
          asset_class: string | null
          avg_avm_error_pct: number | null
          avg_negotiation_delta_pct: number | null
          avg_normalized_score: number | null
          avg_raw_truth_score: number | null
          avg_routing_precision_pct: number | null
          event_count: number | null
          last_updated: string | null
          max_score: number | null
          min_score: number | null
          zone_key: string | null
        }
        Relationships: []
      }
      v_governance_activity: {
        Row: {
          action_type: string | null
          approved_by: string | null
          created_at: string | null
          decision: string | null
          governance_class: string | null
          id: string | null
          override_by: string | null
          override_outcome: string | null
          triggered_by: string | null
        }
        Relationships: []
      }
      v_learning_system_health: {
        Row: {
          active_updates: number | null
          critical_rollbacks_7d: number | null
          last_rollback: string | null
          promoted_updates: number | null
          rollbacks_30d: number | null
          rolled_back_updates: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_expired_magic_tokens: { Args: never; Returns: undefined }
      cleanup_old_conversations: { Args: never; Returns: undefined }
      compute_buyer_score: {
        Args: {
          p_avg_close_days: number
          p_closed_count: number
          p_last_contact: string
          p_liquidity: string
          p_reliability: number
        }
        Returns: number
      }
      dequeue_runtime_events: {
        Args: { p_count?: number; p_org_id: string }
        Returns: {
          agent_id: string | null
          agents_completed: string[]
          agents_failed: string[] | null
          agents_triggered: string[] | null
          correlation_id: string | null
          created_at: string
          economic_score: number | null
          event_id: string
          event_timestamp: string
          last_error: string | null
          org_id: string
          payload: Json | null
          priority_weight: number
          processed_at: string | null
          result: Json | null
          retry_count: number
          schema_version: string
          source_system: string | null
          status: string
          trace_id: string | null
          type: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "runtime_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_buyer_score_reason: {
        Args: {
          p_close_days: number
          p_closed_count: number
          p_liquidity: string
          p_reliability: number
          p_score: number
          p_tier: string
        }
        Returns: string
      }
      get_causal_chain: {
        Args: {
          p_correlation_id: string
          p_max_depth?: number
          p_tenant_id: string
        }
        Returns: {
          action: string
          agent_id: string
          created_at: string
          depth: number
          parent_id: string
          revenue_delta: number
          step_id: string
          step_type: string
          success: boolean
        }[]
      }
      get_revenue_attribution: {
        Args: { p_from_date?: string; p_tenant_id: string; p_to_date?: string }
        Returns: {
          agent_id: string
          avg_revenue_per_deal: number
          deal_count: number
          success_rate: number
          total_revenue: number
        }[]
      }
      ingest_commercial_lead_v1: {
        Args: {
          p_activity_body: string
          p_activity_metadata: Json
          p_activity_source_url: string
          p_activity_subject: string
          p_activity_type: string
          p_email: string
          p_intent: string
          p_name: string
          p_next_followup_at: string
          p_notes: string
          p_page_url: string
          p_phone: string
          p_preferred_locations: string[]
          p_source: string
          p_submission_id: string
          p_timeline: string
        }
        Returns: Json
      }
      refresh_graph_views: { Args: never; Returns: Json }
      search_properties_semantic: {
        Args: {
          filter_preco_max?: number
          filter_preco_min?: number
          filter_quartos?: number
          filter_zona?: string
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          area: number
          descricao: string
          fotos: string[]
          id: string
          nome: string
          preco: number
          quartos: number
          similarity: number
          tipo: string
          zona: string
        }[]
      }
      set_tenant_id: { Args: { t_id: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      activity_type: "property_enquiry" | "contact_form" | "sofia_handoff"
      lead_tier: "A" | "B" | "C"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: ["property_enquiry", "contact_form", "sofia_handoff"],
      lead_tier: ["A", "B", "C"],
    },
  },
} as const

