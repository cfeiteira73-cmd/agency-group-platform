// =============================================================================
// AGENCY GROUP — Database Types v2.0
// Auto-typed from supabase/migrations/001_initial_schema.sql
// AMI: 22506 | Portugal + Espanha + Madeira + Açores
// =============================================================================

// ---------------------------------------------------------------------------
// ENUM TYPES
// ---------------------------------------------------------------------------

export type PropertyStatus =
  | 'active'
  | 'under_offer'
  | 'cpcv'
  | 'sold'
  | 'withdrawn'
  | 'rented'
  | 'off_market'

export type PropertyType =
  | 'apartment'
  | 'villa'
  | 'townhouse'
  | 'penthouse'
  | 'land'
  | 'commercial'
  | 'office'
  | 'warehouse'
  | 'hotel'
  | 'development_plot'

export type ContactStatus =
  | 'lead'
  | 'prospect'
  | 'qualified'
  | 'active'
  | 'negotiating'
  | 'client'
  | 'vip'
  | 'dormant'
  | 'lost'
  | 'referrer'

export type ContactRole =
  | 'buyer'
  | 'seller'
  | 'investor'
  | 'tenant'
  | 'landlord'
  | 'referrer'
  | 'developer'
  | 'solicitor'
  | 'notary'
  | 'other'

export type DealStage =
  | 'lead'
  | 'qualification'
  | 'visit_scheduled'
  | 'visit_done'
  | 'proposal'
  | 'negotiation'
  | 'cpcv'
  | 'escritura'
  | 'post_sale'
  | 'prospecting'
  | 'valuation'
  | 'mandate'
  | 'active_listing'
  | 'offer_received'
  | 'cpcv_sell'
  | 'escritura_sell'

export type DealType = 'buy_side' | 'sell_side' | 'dual_agency' | 'rental' | 'investment'

export type ActivityType =
  | 'call_outbound'
  | 'call_inbound'
  | 'email_sent'
  | 'email_received'
  | 'whatsapp_sent'
  | 'whatsapp_received'
  | 'meeting'
  | 'visit'
  | 'note'
  | 'document_sent'
  | 'offer_made'
  | 'offer_received'
  | 'task_completed'
  | 'system_event'

export type SignalType =
  | 'inheritance'
  | 'insolvency'
  | 'divorce'
  | 'relocation'
  | 'multi_property'
  | 'price_reduction'
  | 'stagnated_listing'
  | 'new_below_avm'
  | 'listing_removed'
  | 'hot_zone_new'

export type SignalStatus = 'new' | 'in_progress' | 'contacted' | 'converted' | 'dismissed'

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'deferred'

export type NotificationChannel = 'email' | 'whatsapp' | 'push' | 'sms' | 'in_app'

export type LeadTier = 'A' | 'B' | 'C'

export type DealPackStatus = 'draft' | 'ready' | 'sent' | 'viewed' | 'archived'

export type MatchStatus = 'pending' | 'viewed' | 'interested' | 'visit_scheduled' | 'rejected'

export type CampanhaType = 'email' | 'whatsapp' | 'sms' | 'push' | 'mixed'

export type CampanhaStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled' | 'failed'

export type SellerUrgency = 'low' | 'medium' | 'high' | 'urgent'

export type MandateType = 'exclusive' | 'shared' | 'open'

// ---------------------------------------------------------------------------
// DATABASE GENERIC TYPE
// ---------------------------------------------------------------------------

export type Database = {
  public: {
    Tables: {
      // -----------------------------------------------------------------------
      // profiles
      // -----------------------------------------------------------------------
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          phone: string | null
          role: 'admin' | 'manager' | 'consultant' | 'assistant'
          ami_number: string | null
          avatar_url: string | null
          whatsapp_number: string | null
          is_active: boolean
          monthly_target: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email: string
          phone?: string | null
          role?: 'admin' | 'manager' | 'consultant' | 'assistant'
          ami_number?: string | null
          avatar_url?: string | null
          whatsapp_number?: string | null
          is_active?: boolean
          monthly_target?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          phone?: string | null
          role?: 'admin' | 'manager' | 'consultant' | 'assistant'
          ami_number?: string | null
          avatar_url?: string | null
          whatsapp_number?: string | null
          is_active?: boolean
          monthly_target?: number | null
          updated_at?: string
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // contacts
      // -----------------------------------------------------------------------
      contacts: {
        Row: {
          id: string
          full_name: string
          email: string | null
          phone: string | null
          whatsapp: string | null
          nationality: string | null
          language: string | null
          role: ContactRole
          status: ContactStatus
          lead_tier: LeadTier | null
          lead_score: number | null
          lead_score_breakdown: Record<string, number> | null
          source: string | null
          source_detail: string | null
          referrer_id: string | null
          assigned_to: string | null
          budget_min: number | null
          budget_max: number | null
          preferred_locations: string[] | null
          typologies_wanted: string[] | null
          bedrooms_min: number | null
          bedrooms_max: number | null
          features_required: string[] | null
          use_type: string | null
          timeline: string | null
          financing_type: string | null
          property_to_sell_id: string | null
          asking_price: number | null
          motivation_score: number | null
          last_contact_at: string | null
          next_followup_at: string | null
          total_interactions: number | null
          opt_out_marketing: boolean
          opt_out_whatsapp: boolean
          gdpr_consent: boolean
          gdpr_consent_at: string | null
          enriched_at: string | null
          clearbit_data: Record<string, unknown> | null
          apollo_data: Record<string, unknown> | null
          linkedin_url: string | null
          company: string | null
          job_title: string | null
          qualified_at: string | null
          qualification_notes: string | null
          ai_summary: string | null
          ai_suggested_action: string | null
          detected_intent: string | null
          tags: string[] | null
          notes: string | null
          // Agent ownership
          agent_email: string | null
          // Lead scoring (extended)
          lead_scored_at: string | null
          // Seller fields (migration 20260424_003)
          is_seller: boolean | null
          seller_property_ref: string | null
          seller_asking_price: number | null
          seller_property_type: string | null
          seller_zona: string | null
          seller_urgency: SellerUrgency | null
          seller_stage: string | null
          mandate_type: MandateType | null
          mandate_expiry: string | null
          seller_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          email?: string | null
          phone?: string | null
          whatsapp?: string | null
          nationality?: string | null
          language?: string | null
          role?: ContactRole
          status?: ContactStatus
          lead_tier?: LeadTier | null
          lead_score?: number | null
          lead_score_breakdown?: Record<string, number> | null
          source?: string | null
          source_detail?: string | null
          referrer_id?: string | null
          assigned_to?: string | null
          budget_min?: number | null
          budget_max?: number | null
          preferred_locations?: string[] | null
          typologies_wanted?: string[] | null
          bedrooms_min?: number | null
          bedrooms_max?: number | null
          features_required?: string[] | null
          use_type?: string | null
          timeline?: string | null
          financing_type?: string | null
          property_to_sell_id?: string | null
          asking_price?: number | null
          motivation_score?: number | null
          last_contact_at?: string | null
          next_followup_at?: string | null
          total_interactions?: number | null
          opt_out_marketing?: boolean
          opt_out_whatsapp?: boolean
          gdpr_consent?: boolean
          gdpr_consent_at?: string | null
          enriched_at?: string | null
          clearbit_data?: Record<string, unknown> | null
          apollo_data?: Record<string, unknown> | null
          linkedin_url?: string | null
          company?: string | null
          job_title?: string | null
          qualified_at?: string | null
          qualification_notes?: string | null
          ai_summary?: string | null
          ai_suggested_action?: string | null
          detected_intent?: string | null
          tags?: string[] | null
          notes?: string | null
          agent_email?: string | null
          lead_scored_at?: string | null
          is_seller?: boolean | null
          seller_property_ref?: string | null
          seller_asking_price?: number | null
          seller_property_type?: string | null
          seller_zona?: string | null
          seller_urgency?: SellerUrgency | null
          seller_stage?: string | null
          mandate_type?: MandateType | null
          mandate_expiry?: string | null
          seller_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string | null
          phone?: string | null
          whatsapp?: string | null
          nationality?: string | null
          language?: string | null
          role?: ContactRole
          status?: ContactStatus
          lead_tier?: LeadTier | null
          lead_score?: number | null
          lead_score_breakdown?: Record<string, number> | null
          source?: string | null
          source_detail?: string | null
          referrer_id?: string | null
          assigned_to?: string | null
          budget_min?: number | null
          budget_max?: number | null
          preferred_locations?: string[] | null
          typologies_wanted?: string[] | null
          bedrooms_min?: number | null
          bedrooms_max?: number | null
          features_required?: string[] | null
          use_type?: string | null
          timeline?: string | null
          financing_type?: string | null
          property_to_sell_id?: string | null
          asking_price?: number | null
          motivation_score?: number | null
          last_contact_at?: string | null
          next_followup_at?: string | null
          total_interactions?: number | null
          opt_out_marketing?: boolean
          opt_out_whatsapp?: boolean
          gdpr_consent?: boolean
          gdpr_consent_at?: string | null
          enriched_at?: string | null
          clearbit_data?: Record<string, unknown> | null
          apollo_data?: Record<string, unknown> | null
          linkedin_url?: string | null
          company?: string | null
          job_title?: string | null
          qualified_at?: string | null
          qualification_notes?: string | null
          ai_summary?: string | null
          ai_suggested_action?: string | null
          detected_intent?: string | null
          tags?: string[] | null
          notes?: string | null
          agent_email?: string | null
          lead_scored_at?: string | null
          is_seller?: boolean | null
          seller_property_ref?: string | null
          seller_asking_price?: number | null
          seller_property_type?: string | null
          seller_zona?: string | null
          seller_urgency?: SellerUrgency | null
          seller_stage?: string | null
          mandate_type?: MandateType | null
          mandate_expiry?: string | null
          seller_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // properties
      // -----------------------------------------------------------------------
      properties: {
        Row: {
          id: string
          title: string
          description: string | null
          description_en: string | null
          description_fr: string | null
          status: PropertyStatus
          type: PropertyType
          price: number
          price_previous: number | null
          price_reduced_at: string | null
          price_per_sqm: number | null
          address: string | null
          street: string | null
          city: string | null
          concelho: string | null
          distrito: string | null
          parish: string | null
          postcode: string | null
          country: string
          latitude: number | null
          longitude: number | null
          zone: string | null
          area_m2: number | null
          area_plot_m2: number | null
          area_terraco_m2: number | null
          bedrooms: number | null
          bathrooms: number | null
          parking_spaces: number | null
          floor: number | null
          total_floors: number | null
          year_built: number | null
          energy_certificate: string | null
          condition: string | null
          features: string[] | null
          orientation: string | null
          furnished: boolean | null
          is_exclusive: boolean
          mandate_signed_at: string | null
          mandate_expires_at: string | null
          owner_contact_id: string | null
          assigned_consultant: string | null
          idealista_id: string | null
          imovirtual_id: string | null
          casasapo_id: string | null
          olx_id: string | null
          avm_estimate: number | null
          avm_confidence: number | null
          avm_updated_at: string | null
          opportunity_score: number | null
          investor_suitable: boolean
          estimated_rental_yield: number | null
          estimated_cap_rate: number | null
          estimated_irr: number | null
          photos: string[] | null
          virtual_tour_url: string | null
          floor_plan_url: string | null
          embedding: number[] | null
          source: string | null
          is_off_market: boolean
          portal_published: boolean
          portal_published_at: string | null
          views_total: number | null
          inquiries_total: number | null
          visits_total: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          description_en?: string | null
          description_fr?: string | null
          status?: PropertyStatus
          type: PropertyType
          price: number
          price_previous?: number | null
          price_reduced_at?: string | null
          price_per_sqm?: number | null
          address?: string | null
          street?: string | null
          city?: string | null
          concelho?: string | null
          distrito?: string | null
          parish?: string | null
          postcode?: string | null
          country?: string
          latitude?: number | null
          longitude?: number | null
          zone?: string | null
          area_m2?: number | null
          area_plot_m2?: number | null
          area_terraco_m2?: number | null
          bedrooms?: number | null
          bathrooms?: number | null
          parking_spaces?: number | null
          floor?: number | null
          total_floors?: number | null
          year_built?: number | null
          energy_certificate?: string | null
          condition?: string | null
          features?: string[] | null
          orientation?: string | null
          furnished?: boolean | null
          is_exclusive?: boolean
          mandate_signed_at?: string | null
          mandate_expires_at?: string | null
          owner_contact_id?: string | null
          assigned_consultant?: string | null
          idealista_id?: string | null
          imovirtual_id?: string | null
          casasapo_id?: string | null
          olx_id?: string | null
          avm_estimate?: number | null
          avm_confidence?: number | null
          avm_updated_at?: string | null
          opportunity_score?: number | null
          investor_suitable?: boolean
          estimated_rental_yield?: number | null
          estimated_cap_rate?: number | null
          estimated_irr?: number | null
          photos?: string[] | null
          virtual_tour_url?: string | null
          floor_plan_url?: string | null
          embedding?: number[] | null
          source?: string | null
          is_off_market?: boolean
          portal_published?: boolean
          portal_published_at?: string | null
          views_total?: number | null
          inquiries_total?: number | null
          visits_total?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          description_en?: string | null
          description_fr?: string | null
          status?: PropertyStatus
          type?: PropertyType
          price?: number
          price_previous?: number | null
          price_reduced_at?: string | null
          price_per_sqm?: number | null
          address?: string | null
          street?: string | null
          city?: string | null
          concelho?: string | null
          distrito?: string | null
          parish?: string | null
          postcode?: string | null
          country?: string
          latitude?: number | null
          longitude?: number | null
          zone?: string | null
          area_m2?: number | null
          area_plot_m2?: number | null
          area_terraco_m2?: number | null
          bedrooms?: number | null
          bathrooms?: number | null
          parking_spaces?: number | null
          floor?: number | null
          total_floors?: number | null
          year_built?: number | null
          energy_certificate?: string | null
          condition?: string | null
          features?: string[] | null
          orientation?: string | null
          furnished?: boolean | null
          is_exclusive?: boolean
          mandate_signed_at?: string | null
          mandate_expires_at?: string | null
          owner_contact_id?: string | null
          assigned_consultant?: string | null
          idealista_id?: string | null
          imovirtual_id?: string | null
          casasapo_id?: string | null
          olx_id?: string | null
          avm_estimate?: number | null
          avm_confidence?: number | null
          avm_updated_at?: string | null
          opportunity_score?: number | null
          investor_suitable?: boolean
          estimated_rental_yield?: number | null
          estimated_cap_rate?: number | null
          estimated_irr?: number | null
          photos?: string[] | null
          virtual_tour_url?: string | null
          floor_plan_url?: string | null
          embedding?: number[] | null
          source?: string | null
          is_off_market?: boolean
          portal_published?: boolean
          portal_published_at?: string | null
          views_total?: number | null
          inquiries_total?: number | null
          visits_total?: number | null
          updated_at?: string
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // deals
      // -----------------------------------------------------------------------
      deals: {
        Row: {
          id: string
          title: string
          reference: string | null
          contact_id: string
          property_id: string | null
          assigned_consultant: string | null
          type: DealType
          stage: DealStage
          probability: number | null
          deal_value: number | null
          commission_rate: number | null
          gci_net: number | null
          cpcv_date: string | null
          escritura_date: string | null
          expected_close_date: string | null
          actual_close_date: string | null
          cpcv_deposit: number | null
          cpcv_deposit_pct: number | null
          notario_id: string | null
          advogado_id: string | null
          initial_offer: number | null
          accepted_offer: number | null
          negotiation_notes: string | null
          lost_at: string | null
          lost_reason: string | null
          lost_to_agency: string | null
          nps_score: number | null
          nps_comment: string | null
          google_review_requested: boolean | null
          google_review_at: string | null
          ai_deal_memo: string | null
          ai_risk_factors: Record<string, unknown> | null
          source: string | null
          tags: string[] | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          reference?: string | null
          contact_id: string
          property_id?: string | null
          assigned_consultant?: string | null
          type?: DealType
          stage?: DealStage
          probability?: number | null
          deal_value?: number | null
          commission_rate?: number | null
          gci_net?: number | null
          cpcv_date?: string | null
          escritura_date?: string | null
          expected_close_date?: string | null
          actual_close_date?: string | null
          cpcv_deposit?: number | null
          cpcv_deposit_pct?: number | null
          notario_id?: string | null
          advogado_id?: string | null
          initial_offer?: number | null
          accepted_offer?: number | null
          negotiation_notes?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          lost_to_agency?: string | null
          nps_score?: number | null
          nps_comment?: string | null
          google_review_requested?: boolean | null
          google_review_at?: string | null
          ai_deal_memo?: string | null
          ai_risk_factors?: Record<string, unknown> | null
          source?: string | null
          tags?: string[] | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          reference?: string | null
          contact_id?: string
          property_id?: string | null
          assigned_consultant?: string | null
          type?: DealType
          stage?: DealStage
          probability?: number | null
          deal_value?: number | null
          commission_rate?: number | null
          gci_net?: number | null
          cpcv_date?: string | null
          escritura_date?: string | null
          expected_close_date?: string | null
          actual_close_date?: string | null
          cpcv_deposit?: number | null
          cpcv_deposit_pct?: number | null
          notario_id?: string | null
          advogado_id?: string | null
          initial_offer?: number | null
          accepted_offer?: number | null
          negotiation_notes?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          lost_to_agency?: string | null
          nps_score?: number | null
          nps_comment?: string | null
          google_review_requested?: boolean | null
          google_review_at?: string | null
          ai_deal_memo?: string | null
          ai_risk_factors?: Record<string, unknown> | null
          source?: string | null
          tags?: string[] | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // activities
      // -----------------------------------------------------------------------
      activities: {
        Row: {
          id: string
          contact_id: string | null
          deal_id: string | null
          property_id: string | null
          performed_by: string | null
          type: ActivityType
          subject: string | null
          body: string | null
          duration_min: number | null
          outcome: string | null
          sentiment: string | null
          sentiment_score: number | null
          ai_summary: string | null
          is_automated: boolean
          automation_id: string | null
          occurred_at: string
          created_at: string
        }
        Insert: {
          id?: string
          contact_id?: string | null
          deal_id?: string | null
          property_id?: string | null
          performed_by?: string | null
          type: ActivityType
          subject?: string | null
          body?: string | null
          duration_min?: number | null
          outcome?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          ai_summary?: string | null
          is_automated?: boolean
          automation_id?: string | null
          occurred_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          contact_id?: string | null
          deal_id?: string | null
          property_id?: string | null
          performed_by?: string | null
          type?: ActivityType
          subject?: string | null
          body?: string | null
          duration_min?: number | null
          outcome?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          ai_summary?: string | null
          is_automated?: boolean
          automation_id?: string | null
          occurred_at?: string
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // tasks
      // -----------------------------------------------------------------------
      tasks: {
        Row: {
          id: string
          contact_id: string | null
          deal_id: string | null
          property_id: string | null
          assigned_to: string | null
          created_by: string | null
          title: string
          description: string | null
          type: string | null
          status: TaskStatus
          priority: number | null
          due_at: string | null
          completed_at: string | null
          is_recurring: boolean
          recurrence_rule: string | null
          is_automated: boolean
          automation_sequence: string | null
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contact_id?: string | null
          deal_id?: string | null
          property_id?: string | null
          assigned_to?: string | null
          created_by?: string | null
          title: string
          description?: string | null
          type?: string | null
          status?: TaskStatus
          priority?: number | null
          due_at?: string | null
          completed_at?: string | null
          is_recurring?: boolean
          recurrence_rule?: string | null
          is_automated?: boolean
          automation_sequence?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contact_id?: string | null
          deal_id?: string | null
          property_id?: string | null
          assigned_to?: string | null
          created_by?: string | null
          title?: string
          description?: string | null
          type?: string | null
          status?: TaskStatus
          priority?: number | null
          due_at?: string | null
          completed_at?: string | null
          is_recurring?: boolean
          recurrence_rule?: string | null
          is_automated?: boolean
          automation_sequence?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // signals
      // -----------------------------------------------------------------------
      signals: {
        Row: {
          id: string
          type: SignalType
          status: SignalStatus
          priority: number
          probability_score: number | null
          property_id: string | null
          property_address: string | null
          property_zone: string | null
          estimated_value: number | null
          owner_name: string | null
          owner_contact_id: string | null
          signal_date: string
          source: string | null
          source_url: string | null
          source_reference: string | null
          raw_data: Record<string, unknown> | null
          recommended_action: string | null
          action_deadline: string | null
          assigned_to: string | null
          notified_agents: string[] | null
          acted_on: boolean
          acted_on_at: string | null
          converted_deal_id: string | null
          ai_analysis: string | null
          score_breakdown: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type: SignalType
          status?: SignalStatus
          priority?: number
          probability_score?: number | null
          property_id?: string | null
          property_address?: string | null
          property_zone?: string | null
          estimated_value?: number | null
          owner_name?: string | null
          owner_contact_id?: string | null
          signal_date?: string
          source?: string | null
          source_url?: string | null
          source_reference?: string | null
          raw_data?: Record<string, unknown> | null
          recommended_action?: string | null
          action_deadline?: string | null
          assigned_to?: string | null
          notified_agents?: string[] | null
          acted_on?: boolean
          acted_on_at?: string | null
          converted_deal_id?: string | null
          ai_analysis?: string | null
          score_breakdown?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: SignalType
          status?: SignalStatus
          priority?: number
          probability_score?: number | null
          property_id?: string | null
          property_address?: string | null
          property_zone?: string | null
          estimated_value?: number | null
          owner_name?: string | null
          owner_contact_id?: string | null
          signal_date?: string
          source?: string | null
          source_url?: string | null
          source_reference?: string | null
          raw_data?: Record<string, unknown> | null
          recommended_action?: string | null
          action_deadline?: string | null
          assigned_to?: string | null
          notified_agents?: string[] | null
          acted_on?: boolean
          acted_on_at?: string | null
          converted_deal_id?: string | null
          ai_analysis?: string | null
          score_breakdown?: Record<string, unknown> | null
          updated_at?: string
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // visits
      // -----------------------------------------------------------------------
      visits: {
        Row: {
          id: string
          property_id: string
          contact_id: string
          deal_id: string | null
          consultant_id: string | null
          scheduled_at: string
          duration_min: number | null
          location_notes: string | null
          status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
          confirmed_at: string | null
          completed_at: string | null
          cancelled_at: string | null
          cancellation_reason: string | null
          feedback_score: number | null
          feedback_comment: string | null
          feedback_received_at: string | null
          probability_before: number | null
          probability_after: number | null
          confirmation_sent: boolean | null
          reminder_24h_sent: boolean | null
          reminder_2h_sent: boolean | null
          feedback_requested: boolean | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          property_id: string
          contact_id: string
          deal_id?: string | null
          consultant_id?: string | null
          scheduled_at: string
          duration_min?: number | null
          location_notes?: string | null
          status?: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
          confirmed_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
          cancellation_reason?: string | null
          feedback_score?: number | null
          feedback_comment?: string | null
          feedback_received_at?: string | null
          probability_before?: number | null
          probability_after?: number | null
          confirmation_sent?: boolean | null
          reminder_24h_sent?: boolean | null
          reminder_2h_sent?: boolean | null
          feedback_requested?: boolean | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          contact_id?: string
          deal_id?: string | null
          consultant_id?: string | null
          scheduled_at?: string
          duration_min?: number | null
          location_notes?: string | null
          status?: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
          confirmed_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
          cancellation_reason?: string | null
          feedback_score?: number | null
          feedback_comment?: string | null
          feedback_received_at?: string | null
          probability_before?: number | null
          probability_after?: number | null
          confirmation_sent?: boolean | null
          reminder_24h_sent?: boolean | null
          reminder_2h_sent?: boolean | null
          feedback_requested?: boolean | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // notifications
      // -----------------------------------------------------------------------
      notifications: {
        Row: {
          id: string
          user_id: string | null
          contact_id: string | null
          channel: NotificationChannel
          subject: string | null
          body: string
          template_id: string | null
          template_vars: Record<string, unknown> | null
          status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'opened'
          sent_at: string | null
          delivered_at: string | null
          opened_at: string | null
          failed_at: string | null
          failure_reason: string | null
          retry_count: number | null
          deal_id: string | null
          property_id: string | null
          signal_id: string | null
          is_automated: boolean
          automation_id: string | null
          external_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          contact_id?: string | null
          channel: NotificationChannel
          subject?: string | null
          body: string
          template_id?: string | null
          template_vars?: Record<string, unknown> | null
          status?: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'opened'
          sent_at?: string | null
          delivered_at?: string | null
          opened_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          retry_count?: number | null
          deal_id?: string | null
          property_id?: string | null
          signal_id?: string | null
          is_automated?: boolean
          automation_id?: string | null
          external_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          contact_id?: string | null
          channel?: NotificationChannel
          subject?: string | null
          body?: string
          template_id?: string | null
          template_vars?: Record<string, unknown> | null
          status?: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'opened'
          sent_at?: string | null
          delivered_at?: string | null
          opened_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          retry_count?: number | null
          deal_id?: string | null
          property_id?: string | null
          signal_id?: string | null
          is_automated?: boolean
          automation_id?: string | null
          external_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // deal_packs (migration 20260424_001)
      // -----------------------------------------------------------------------
      deal_packs: {
        Row: {
          id: string
          deal_id: string | null
          property_id: string | null
          lead_id: string | null
          title: string
          status: DealPackStatus
          investment_thesis: string | null
          market_summary: string | null
          opportunity_score: number | null
          financial_projections: {
            purchase_price?: number
            estimated_yield?: number
            estimated_irr?: number
            renovation_estimate?: number
            total_investment?: number
            annual_income?: number
            exit_value_5y?: number
          } | null
          highlights: string[] | null
          generated_at: string | null
          sent_at: string | null
          viewed_at: string | null
          view_count: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          deal_id?: string | null
          property_id?: string | null
          lead_id?: string | null
          title: string
          status?: DealPackStatus
          investment_thesis?: string | null
          market_summary?: string | null
          opportunity_score?: number | null
          financial_projections?: Record<string, unknown> | null
          highlights?: string[] | null
          generated_at?: string | null
          sent_at?: string | null
          viewed_at?: string | null
          view_count?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          deal_id?: string | null
          property_id?: string | null
          lead_id?: string | null
          title?: string
          status?: DealPackStatus
          investment_thesis?: string | null
          market_summary?: string | null
          opportunity_score?: number | null
          financial_projections?: Record<string, unknown> | null
          highlights?: string[] | null
          generated_at?: string | null
          sent_at?: string | null
          viewed_at?: string | null
          view_count?: number
          created_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // matches (migration 20260424_001)
      // -----------------------------------------------------------------------
      matches: {
        Row: {
          id: string
          lead_id: string | null
          property_id: string | null
          property_ref: string | null
          property_title: string | null
          match_score: number
          breakdown: {
            budget?: number
            zone?: number
            typology?: number
            features?: number
            timeline?: number
            similarity?: number
          } | null
          match_reasons: string[] | null
          explanation: string | null
          similarity: number | null
          estimated_yield: number | null
          status: MatchStatus
          matched_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id?: string | null
          property_id?: string | null
          property_ref?: string | null
          property_title?: string | null
          match_score: number
          breakdown?: Record<string, number> | null
          match_reasons?: string[] | null
          explanation?: string | null
          similarity?: number | null
          estimated_yield?: number | null
          status?: MatchStatus
          matched_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string | null
          property_id?: string | null
          property_ref?: string | null
          property_title?: string | null
          match_score?: number
          breakdown?: Record<string, number> | null
          match_reasons?: string[] | null
          explanation?: string | null
          similarity?: number | null
          estimated_yield?: number | null
          status?: MatchStatus
          matched_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // kpi_snapshots (migration 20260424_002)
      // -----------------------------------------------------------------------
      kpi_snapshots: {
        Row: {
          id: string
          snapshot_date: string
          leads_total: number | null
          leads_new: number | null
          leads_qualified: number | null
          leads_active: number | null
          leads_vip: number | null
          leads_dormant: number | null
          leads_lost: number | null
          deals_total: number | null
          deals_active: number | null
          deals_cpcv: number | null
          deals_escritura: number | null
          deals_won: number | null
          pipeline_value: number | null
          avg_deal_value: number | null
          properties_total: number | null
          properties_active: number | null
          properties_exclusive: number | null
          properties_off_market: number | null
          matches_total: number | null
          matches_new: number | null
          matches_interested: number | null
          campanhas_total: number | null
          campanhas_sent: number | null
          deal_packs_total: number | null
          deal_packs_sent: number | null
          deal_packs_viewed: number | null
          raw_data: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          snapshot_date: string
          leads_total?: number | null
          leads_new?: number | null
          leads_qualified?: number | null
          leads_active?: number | null
          leads_vip?: number | null
          leads_dormant?: number | null
          leads_lost?: number | null
          deals_total?: number | null
          deals_active?: number | null
          deals_cpcv?: number | null
          deals_escritura?: number | null
          deals_won?: number | null
          pipeline_value?: number | null
          avg_deal_value?: number | null
          properties_total?: number | null
          properties_active?: number | null
          properties_exclusive?: number | null
          properties_off_market?: number | null
          matches_total?: number | null
          matches_new?: number | null
          matches_interested?: number | null
          campanhas_total?: number | null
          campanhas_sent?: number | null
          deal_packs_total?: number | null
          deal_packs_sent?: number | null
          deal_packs_viewed?: number | null
          raw_data?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          snapshot_date?: string
          leads_total?: number | null
          leads_new?: number | null
          leads_qualified?: number | null
          leads_active?: number | null
          leads_vip?: number | null
          leads_dormant?: number | null
          leads_lost?: number | null
          deals_total?: number | null
          deals_active?: number | null
          deals_cpcv?: number | null
          deals_escritura?: number | null
          deals_won?: number | null
          pipeline_value?: number | null
          avg_deal_value?: number | null
          properties_total?: number | null
          properties_active?: number | null
          properties_exclusive?: number | null
          properties_off_market?: number | null
          matches_total?: number | null
          matches_new?: number | null
          matches_interested?: number | null
          campanhas_total?: number | null
          campanhas_sent?: number | null
          deal_packs_total?: number | null
          deal_packs_sent?: number | null
          deal_packs_viewed?: number | null
          raw_data?: Record<string, unknown> | null
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // campanhas (migration 20260424_004)
      // -----------------------------------------------------------------------
      campanhas: {
        Row: {
          id: string
          name: string
          type: CampanhaType
          status: CampanhaStatus
          subject: string | null
          html: string | null
          recipient_list: string[] | null
          recipient_count: number
          sent_count: number
          delivered_count: number
          opened_count: number
          clicked_count: number
          scheduled_at: string | null
          sent_at: string | null
          metadata: Record<string, unknown> | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type?: CampanhaType
          status?: CampanhaStatus
          subject?: string | null
          html?: string | null
          recipient_list?: string[] | null
          recipient_count?: number
          sent_count?: number
          delivered_count?: number
          opened_count?: number
          clicked_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          metadata?: Record<string, unknown> | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: CampanhaType
          status?: CampanhaStatus
          subject?: string | null
          html?: string | null
          recipient_list?: string[] | null
          recipient_count?: number
          sent_count?: number
          delivered_count?: number
          opened_count?: number
          clicked_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          metadata?: Record<string, unknown> | null
          created_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // market_snapshots
      // -----------------------------------------------------------------------
      market_snapshots: {
        Row: {
          id: string
          snapshot_date: string
          concelho: string
          zone: string | null
          typologia: string | null
          median_price_sqm: number | null
          avg_price_sqm: number | null
          median_total_price: number | null
          active_listings: number | null
          new_listings_7d: number | null
          sold_last_30d: number | null
          avg_days_on_market: number | null
          price_change_pct_30d: number | null
          price_change_pct_yoy: number | null
          avg_discount_pct: number | null
          supply_demand_ratio: number | null
          hot_score: number | null
          source: string | null
          created_at: string
        }
        Insert: {
          id?: string
          snapshot_date?: string
          concelho: string
          zone?: string | null
          typologia?: string | null
          median_price_sqm?: number | null
          avg_price_sqm?: number | null
          median_total_price?: number | null
          active_listings?: number | null
          new_listings_7d?: number | null
          sold_last_30d?: number | null
          avg_days_on_market?: number | null
          price_change_pct_30d?: number | null
          price_change_pct_yoy?: number | null
          avg_discount_pct?: number | null
          supply_demand_ratio?: number | null
          hot_score?: number | null
          source?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          snapshot_date?: string
          concelho?: string
          zone?: string | null
          typologia?: string | null
          median_price_sqm?: number | null
          avg_price_sqm?: number | null
          median_total_price?: number | null
          active_listings?: number | null
          new_listings_7d?: number | null
          sold_last_30d?: number | null
          avg_days_on_market?: number | null
          price_change_pct_30d?: number | null
          price_change_pct_yoy?: number | null
          avg_discount_pct?: number | null
          supply_demand_ratio?: number | null
          hot_score?: number | null
          source?: string | null
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // learning_events — event bus (migrations 001 + 20260429_001)
      // -----------------------------------------------------------------------
      learning_events: {
        Row: {
          id: string
          event_type: string
          lead_id: string | null
          deal_id: string | null
          property_id: string | null
          match_id: string | null
          deal_pack_id: string | null
          agent_email: string | null
          match_score: number | null
          correlation_id: string | null
          session_id: string | null
          source_system: 'api' | 'n8n' | 'cron' | 'engine' | null
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          event_type: string
          lead_id?: string | null
          deal_id?: string | null
          property_id?: string | null
          match_id?: string | null
          deal_pack_id?: string | null
          agent_email?: string | null
          match_score?: number | null
          correlation_id?: string | null
          session_id?: string | null
          source_system?: 'api' | 'n8n' | 'cron' | 'engine' | null
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          event_type?: string
          metadata?: Record<string, unknown> | null
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // audit_log — immutable append-only audit trail (migration 20260502_004)
      // -----------------------------------------------------------------------
      audit_log: {
        Row: {
          id: string
          actor_email: string | null
          actor_role: string | null
          action_type: string
          resource_type: string | null
          resource_id: string | null
          old_value: Record<string, unknown> | null
          new_value: Record<string, unknown> | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_email?: string | null
          actor_role?: string | null
          action_type: string
          resource_type?: string | null
          resource_id?: string | null
          old_value?: Record<string, unknown> | null
          new_value?: Record<string, unknown> | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // automations_log — n8n / cron execution log (migration 001)
      // -----------------------------------------------------------------------
      automations_log: {
        Row: {
          id: string
          workflow_name: string
          execution_id: string | null
          trigger_type: string | null
          trigger_payload: Record<string, unknown> | null
          contact_id: string | null
          deal_id: string | null
          property_id: string | null
          status: 'running' | 'success' | 'error' | 'partial'
          started_at: string
          completed_at: string | null
          duration_ms: number | null
          outcome: Record<string, unknown> | null
          error_message: string | null
          retry_count: number | null
          tokens_used: number | null
          estimated_cost_eur: number | null
          created_at: string
        }
        Insert: {
          id?: string
          workflow_name: string
          execution_id?: string | null
          trigger_type?: string | null
          trigger_payload?: Record<string, unknown> | null
          contact_id?: string | null
          deal_id?: string | null
          property_id?: string | null
          status?: 'running' | 'success' | 'error' | 'partial'
          started_at?: string
          completed_at?: string | null
          duration_ms?: number | null
          outcome?: Record<string, unknown> | null
          error_message?: string | null
          retry_count?: number | null
          tokens_used?: number | null
          estimated_cost_eur?: number | null
          created_at?: string
        }
        Update: {
          status?: 'running' | 'success' | 'error' | 'partial'
          completed_at?: string | null
          duration_ms?: number | null
          outcome?: Record<string, unknown> | null
          error_message?: string | null
          retry_count?: number | null
          tokens_used?: number | null
          estimated_cost_eur?: number | null
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // platform_config — DB-backed config (migration 20260503_008)
      // -----------------------------------------------------------------------
      platform_config: {
        Row: {
          config_key: string
          value_numeric: number | null
          value_text: string | null
          value_boolean: boolean | null
          value_json: Record<string, unknown> | null
          config_type: 'numeric' | 'text' | 'boolean' | 'json'
          description: string | null
          category: string
          is_sensitive: boolean
          updated_by: string | null
          updated_at: string
          created_at: string
        }
        Insert: {
          config_key: string
          value_numeric?: number | null
          value_text?: string | null
          value_boolean?: boolean | null
          value_json?: Record<string, unknown> | null
          config_type?: 'numeric' | 'text' | 'boolean' | 'json'
          description?: string | null
          category?: string
          is_sensitive?: boolean
          updated_by?: string | null
          updated_at?: string
          created_at?: string
        }
        Update: {
          value_numeric?: number | null
          value_text?: string | null
          value_boolean?: boolean | null
          value_json?: Record<string, unknown> | null
          config_type?: 'numeric' | 'text' | 'boolean' | 'json'
          description?: string | null
          category?: string
          is_sensitive?: boolean
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // investidores — investor CRM (migration 20260407_001)
      // -----------------------------------------------------------------------
      investidores: {
        Row: {
          id: string
          nome: string
          email: string | null
          telefone: string | null
          whatsapp: string | null
          nacionalidade: string | null
          flag: string | null
          tipo: 'family_office' | 'hnwi' | 'institucional' | 'privado' | 'fundo' | null
          capital_min: number | null
          capital_max: number | null
          yield_target: number | null
          horizon_years: number | null
          risk_profile: string | null
          zonas: string[] | null
          tipo_imovel: string[] | null
          ocupacao: string | null
          status: string | null
          last_contact: string | null
          total_invested: number | null
          deals_history: number | null
          notes: string | null
          phone: string | null
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          email?: string | null
          telefone?: string | null
          whatsapp?: string | null
          nacionalidade?: string | null
          flag?: string | null
          tipo?: 'family_office' | 'hnwi' | 'institucional' | 'privado' | 'fundo' | null
          capital_min?: number | null
          capital_max?: number | null
          yield_target?: number | null
          horizon_years?: number | null
          risk_profile?: string | null
          zonas?: string[] | null
          tipo_imovel?: string[] | null
          ocupacao?: string | null
          status?: string | null
          last_contact?: string | null
          total_invested?: number | null
          deals_history?: number | null
          notes?: string | null
          phone?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          nome?: string
          email?: string | null
          telefone?: string | null
          status?: string | null
          notes?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // premarket_properties — pre-market exclusives (migration 20260406)
      // -----------------------------------------------------------------------
      premarket_properties: {
        Row: {
          id: string
          title: string
          zone: string
          type: string
          price_min: number | null
          price_max: number | null
          area: number | null
          bedrooms: number | null
          description: string | null
          features: string[] | null
          available_from: string | null
          exclusive_until: string | null
          access_level: 'registered' | 'premium' | 'vip'
          images: string[] | null
          agent_name: string | null
          agent_phone: string | null
          is_active: boolean
          views_count: number
          alerts_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          zone: string
          type: string
          price_min?: number | null
          price_max?: number | null
          area?: number | null
          bedrooms?: number | null
          description?: string | null
          features?: string[] | null
          available_from?: string | null
          exclusive_until?: string | null
          access_level?: 'registered' | 'premium' | 'vip'
          images?: string[] | null
          agent_name?: string | null
          agent_phone?: string | null
          is_active?: boolean
          views_count?: number
          alerts_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          is_active?: boolean
          views_count?: number
          alerts_count?: number
          updated_at?: string
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // premarket_interest — user interest registrations (migration 20260406)
      // -----------------------------------------------------------------------
      premarket_interest: {
        Row: {
          id: string
          user_id: string
          property_id: string
          message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          property_id: string
          message?: string | null
          created_at?: string
        }
        Update: {
          message?: string | null
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // sofia_conversations — AI agent conversation history (migration 20260407_003)
      // -----------------------------------------------------------------------
      sofia_conversations: {
        Row: {
          id: string
          session_id: string | null
          user_id: string | null
          contact_id: string | null
          role: 'user' | 'assistant' | 'system'
          content: string
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id?: string | null
          user_id?: string | null
          contact_id?: string | null
          role: 'user' | 'assistant' | 'system'
          content: string
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          metadata?: Record<string, unknown> | null
        }
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // used_magic_tokens — one-time auth tokens (migration 20260408_001)
      // -----------------------------------------------------------------------
      used_magic_tokens: {
        Row: {
          id: string
          token_hash: string
          email: string
          used_at: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          token_hash: string
          email: string
          used_at?: string
          expires_at: string
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }

      // -----------------------------------------------------------------------
      // system_alerts — platform alert registry (migration 20260502_004)
      // -----------------------------------------------------------------------
      system_alerts: {
        Row: {
          id: string
          alert_type: string
          severity: 'P0' | 'P1' | 'P2' | 'P3'
          title: string
          description: string | null
          resource_type: string | null
          resource_id: string | null
          status: 'open' | 'acknowledged' | 'resolved'
          acknowledged_by: string | null
          acknowledged_at: string | null
          resolved_by: string | null
          resolved_at: string | null
          metadata: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          alert_type: string
          severity: 'P0' | 'P1' | 'P2' | 'P3'
          title: string
          description?: string | null
          resource_type?: string | null
          resource_id?: string | null
          status?: 'open' | 'acknowledged' | 'resolved'
          acknowledged_by?: string | null
          acknowledged_at?: string | null
          resolved_by?: string | null
          resolved_at?: string | null
          metadata?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'open' | 'acknowledged' | 'resolved'
          acknowledged_by?: string | null
          acknowledged_at?: string | null
          resolved_by?: string | null
          resolved_at?: string | null
          metadata?: Record<string, unknown> | null
          updated_at?: string
        }
        Relationships: []
      }
      win_loss_events: {
        Row: {
          id: string; deal_id: string | null; contact_id: string | null
          agent_id: string; outcome: 'won' | 'lost' | 'stalled' | 'withdrawn'
          reason_category: string; reason_detail: string | null
          objection_type: string | null; deal_value: number | null
          commission_lost: number | null; days_in_pipeline: number | null
          stage_lost: string | null; competitor_name: string | null; notes: string | null
          recorded_at: string; created_at: string
        }
        Insert: {
          deal_id?: string | null; contact_id?: string | null; agent_id: string
          outcome: 'won' | 'lost' | 'stalled' | 'withdrawn'; reason_category: string
          reason_detail?: string | null; objection_type?: string | null
          deal_value?: number | null; commission_lost?: number | null
          days_in_pipeline?: number | null; stage_lost?: string | null
          competitor_name?: string | null; notes?: string | null
        }
        Update: { notes?: string | null }
        Relationships: []
      }
      adoption_events: {
        Row: {
          id: string; user_email: string; user_role: string | null
          feature_name: string; action: string; session_id: string | null
          metadata: Record<string, unknown> | null; occurred_at: string; created_at: string
        }
        Insert: {
          user_email: string; user_role?: string | null; feature_name: string
          action: string; session_id?: string | null
          metadata?: Record<string, unknown> | null; occurred_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      data_quality_events: {
        Row: {
          id: string; resource_type: string; resource_id: string
          field_name: string; issue_type: string
          severity: 'low' | 'medium' | 'high' | 'critical'
          current_value: string | null; suggested_value: string | null
          auto_fixed: boolean; fixed_at: string | null; fixed_by: string | null
          detected_at: string; created_at: string
        }
        Insert: {
          resource_type: string; resource_id: string; field_name: string
          issue_type: string; severity?: 'low' | 'medium' | 'high' | 'critical'
          current_value?: string | null; suggested_value?: string | null
          auto_fixed?: boolean
        }
        Update: { auto_fixed?: boolean; fixed_at?: string | null; fixed_by?: string | null }
        Relationships: []
      }
      nps_responses: {
        Row: {
          id: string; contact_id: string | null; deal_id: string | null
          agent_email: string | null; score: number; category: string
          feedback: string | null; trigger_event: string | null
          channel: string; responded_at: string; created_at: string
        }
        Insert: {
          contact_id?: string | null; deal_id?: string | null
          agent_email?: string | null; score: number
          feedback?: string | null; trigger_event?: string | null; channel?: string
        }
        Update: { feedback?: string | null }
        Relationships: []
      }
      performance_scorecards: {
        Row: {
          id: string; agent_email: string
          period_type: 'weekly' | 'monthly' | 'quarterly'
          period_start: string; period_end: string
          leads_worked: number; contacts_created: number; visits_conducted: number
          proposals_sent: number; deals_won: number; deals_lost: number
          conversion_rate: number | null; gci_generated: number; pipeline_value: number
          data_quality_score: number | null; platform_adoption_score: number | null
          avg_response_time_hours: number | null; nps_score: number | null
          sla_violations: number; followup_compliance_pct: number | null
          rank_this_period: number | null; percentile: number | null
          composite_score: number | null; computed_at: string; created_at: string
        }
        Insert: {
          agent_email: string; period_type: 'weekly' | 'monthly' | 'quarterly'
          period_start: string; period_end: string
          leads_worked?: number; contacts_created?: number; visits_conducted?: number
          proposals_sent?: number; deals_won?: number; deals_lost?: number
          conversion_rate?: number | null; gci_generated?: number; pipeline_value?: number
          data_quality_score?: number | null; platform_adoption_score?: number | null
          composite_score?: number | null
        }
        Update: {
          rank_this_period?: number | null; percentile?: number | null
          composite_score?: number | null; computed_at?: string
        }
        Relationships: []
      }
      client_milestones: {
        Row: {
          id: string; deal_id: string | null; contact_id: string | null
          milestone_type: string; title: string; description: string | null
          completed: boolean; completed_at: string | null
          notified_client: boolean; notified_at: string | null
          scheduled_for: string | null; created_at: string
        }
        Insert: {
          deal_id?: string | null; contact_id?: string | null
          milestone_type: string; title: string; description?: string | null
          scheduled_for?: string | null
        }
        Update: {
          completed?: boolean; completed_at?: string | null
          notified_client?: boolean; notified_at?: string | null
        }
        Relationships: []
      }
      objection_taxonomy: {
        Row: {
          id: string; category: string; objection: string; frequency: number
          best_response: string | null; script_en: string | null; script_pt: string | null
          win_rate_when_encountered: number | null; last_updated: string; created_at: string
        }
        Insert: {
          category: string; objection: string; frequency?: number
          best_response?: string | null; script_pt?: string | null
          win_rate_when_encountered?: number | null
        }
        Update: {
          frequency?: number; best_response?: string | null
          script_pt?: string | null; win_rate_when_encountered?: number | null; last_updated?: string
        }
        Relationships: []
      }

      // ─── offmarket_leads ──────────────────────────────────────────────────
      offmarket_leads: {
        Row: {
          id: string; nome: string; tipo_ativo: string | null; localizacao: string | null
          cidade: string | null; area_m2: number | null; ano_construcao: number | null
          price_ask: number | null; price_estimate: number | null; price_per_m2: number | null
          score: number | null; score_breakdown: Record<string,unknown> | null; score_updated_at: string | null
          contacto: string | null; owner_type: string | null
          urgency: 'high' | 'medium' | 'low' | 'unknown' | null
          source: string | null; source_url: string | null; source_listing_id: string | null
          status: 'new' | 'contacted' | 'interested' | 'meeting_scheduled' | 'valuation_done' | 'captation_active' | 'not_interested' | 'closed_won' | 'closed_lost'
          assigned_to: string | null; next_followup_at: string | null; last_contact_at: string | null
          contact_attempts: number | null; notes: string | null; tags: string[] | null
          raw_data: Record<string,unknown> | null; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; nome: string; tipo_ativo?: string | null; localizacao?: string | null
          cidade?: string | null; area_m2?: number | null; ano_construcao?: number | null
          price_ask?: number | null; price_estimate?: number | null; score?: number | null
          score_breakdown?: Record<string,unknown> | null; contacto?: string | null
          owner_type?: string | null; urgency?: string | null; source?: string | null
          source_url?: string | null; source_listing_id?: string | null; status?: string
          assigned_to?: string | null; next_followup_at?: string | null
          last_contact_at?: string | null; contact_attempts?: number | null
          notes?: string | null; tags?: string[] | null; raw_data?: Record<string,unknown> | null
          created_at?: string; updated_at?: string
        }
        Update: {
          nome?: string; tipo_ativo?: string | null; localizacao?: string | null
          cidade?: string | null; area_m2?: number | null; price_ask?: number | null
          price_estimate?: number | null; score?: number | null
          score_breakdown?: Record<string,unknown> | null; contacto?: string | null
          owner_type?: string | null; urgency?: string | null; source?: string | null
          source_listing_id?: string | null; status?: string; assigned_to?: string | null
          next_followup_at?: string | null; last_contact_at?: string | null
          contact_attempts?: number | null; notes?: string | null; tags?: string[] | null
          raw_data?: Record<string,unknown> | null; updated_at?: string
        }
        Relationships: []
      }

      // ─── institutional_partners ───────────────────────────────────────────
      institutional_partners: {
        Row: {
          id: string; nome: string; empresa: string | null
          tipo: 'advogado' | 'notario' | 'contabilista' | 'gestor_patrimonio' | 'family_office' | 'banco' | 'fundo_investimento' | 'mediador_parceiro' | 'promotor' | 'outro'
          email: string | null; phone: string | null; linkedin_url: string | null; website: string | null
          cidade: string | null; paises_actuacao: string[] | null; segmento: string | null
          ticket_medio: number | null; origem: string | null
          estado: 'prospect' | 'contactado' | 'reuniao_feita' | 'parceiro_activo' | 'dormente' | 'inactivo'
          nivel_prioridade: 'A' | 'B' | 'C'; last_contact_at: string | null
          next_followup_at: string | null; contact_attempts: number | null
          deals_referidos: number | null; volume_referido: number | null
          owner: string | null; notes: string | null; tags: string[] | null
          created_at: string; updated_at: string
        }
        Insert: {
          id?: string; nome: string; empresa?: string | null; tipo: string
          email?: string | null; phone?: string | null; linkedin_url?: string | null
          website?: string | null; cidade?: string | null; paises_actuacao?: string[] | null
          segmento?: string | null; ticket_medio?: number | null; origem?: string | null
          estado?: string; nivel_prioridade?: string; last_contact_at?: string | null
          next_followup_at?: string | null; contact_attempts?: number | null
          deals_referidos?: number | null; volume_referido?: number | null
          owner?: string | null; notes?: string | null; tags?: string[] | null
          created_at?: string; updated_at?: string
        }
        Update: {
          nome?: string; empresa?: string | null; tipo?: string; email?: string | null
          phone?: string | null; cidade?: string | null; estado?: string
          nivel_prioridade?: string; last_contact_at?: string | null
          next_followup_at?: string | null; contact_attempts?: number | null
          deals_referidos?: number | null; volume_referido?: number | null
          owner?: string | null; notes?: string | null; tags?: string[] | null; updated_at?: string
        }
        Relationships: []
      }

      // ─── visitas ──────────────────────────────────────────────────────────
      visitas: {
        Row: {
          id: string; property_id: number | null; property_name: string | null
          contact_id: number | null; contact_name: string | null
          date: string; time: string | null
          status: 'agendada' | 'realizada' | 'cancelada' | 'reagendada'
          notes: string | null; interest_score: number | null; feedback: string | null
          ai_suggestion: string | null
          visit_type: 'presencial' | 'virtual' | 'videochamada'
          agent_id: string | null; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; property_id?: number | null; property_name?: string | null
          contact_id?: number | null; contact_name?: string | null
          date: string; time?: string | null; status?: string
          notes?: string | null; interest_score?: number | null; feedback?: string | null
          ai_suggestion?: string | null; visit_type?: string; agent_id?: string | null
          created_at?: string; updated_at?: string
        }
        Update: {
          date?: string; time?: string | null; status?: string; notes?: string | null
          interest_score?: number | null; feedback?: string | null
          ai_suggestion?: string | null; visit_type?: string; updated_at?: string
        }
        Relationships: []
      }

      // ─── property_collections ─────────────────────────────────────────────
      property_collections: {
        Row: {
          id: string; created_at: string | null; updated_at: string | null
          expires_at: string | null; agent_id: string | null
          client_name: string | null; client_email: string | null
          name: string; share_token: string
          items: unknown[] | null; comments: unknown[] | null
          ai_profile: string | null; views: number | null; last_viewed_at: string | null
        }
        Insert: {
          id: string; created_at?: string | null; updated_at?: string | null
          expires_at?: string | null; agent_id?: string | null
          client_name?: string | null; client_email?: string | null
          name?: string; share_token: string
          items?: unknown[] | null; comments?: unknown[] | null
          ai_profile?: string | null; views?: number | null; last_viewed_at?: string | null
        }
        Update: {
          expires_at?: string | null; agent_id?: string | null
          client_name?: string | null; client_email?: string | null
          name?: string; share_token?: string; items?: unknown[] | null
          comments?: unknown[] | null; ai_profile?: string | null
          views?: number | null; last_viewed_at?: string | null; updated_at?: string | null
        }
        Relationships: []
      }

      // ─── users ────────────────────────────────────────────────────────────
      users: {
        Row: {
          id: string; email: string; phone: string | null
          totp_secret: string | null; two_factor_enabled: boolean
          reset_token: string | null; reset_token_expires: string | null
          onboarding_complete: boolean; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; email: string; phone?: string | null
          totp_secret?: string | null; two_factor_enabled?: boolean
          reset_token?: string | null; reset_token_expires?: string | null
          onboarding_complete?: boolean; created_at?: string; updated_at?: string
        }
        Update: {
          email?: string; phone?: string | null; totp_secret?: string | null
          two_factor_enabled?: boolean; reset_token?: string | null
          reset_token_expires?: string | null; onboarding_complete?: boolean; updated_at?: string
        }
        Relationships: []
      }

      // ─── push_tokens ──────────────────────────────────────────────────────
      push_tokens: {
        Row: {
          id: string; user_id: string | null; endpoint: string
          p256dh: string; auth: string; user_agent: string | null
          created_at: string; updated_at: string
        }
        Insert: {
          id?: string; user_id?: string | null; endpoint: string
          p256dh: string; auth: string; user_agent?: string | null
          created_at?: string; updated_at?: string
        }
        Update: {
          user_id?: string | null; endpoint?: string; p256dh?: string
          auth?: string; user_agent?: string | null; updated_at?: string
        }
        Relationships: []
      }

      // ─── deal_review_queue ────────────────────────────────────────────────
      deal_review_queue: {
        Row: {
          id: string; property_id: string; opportunity_score: number | null
          opportunity_grade: string | null; distribution_tier: string | null
          routing_decision: Record<string,unknown> | null
          status: string; queued_reason: string | null; auto_queued: boolean
          reviewer_email: string | null; reviewed_at: string | null
          override_score: number | null; override_routing: Record<string,unknown> | null
          review_notes: string | null; queued_at: string; created_at: string
        }
        Insert: {
          id?: string; property_id: string; opportunity_score?: number | null
          opportunity_grade?: string | null; distribution_tier?: string | null
          routing_decision?: Record<string,unknown> | null; status?: string
          queued_reason?: string | null; auto_queued?: boolean
          reviewer_email?: string | null; reviewed_at?: string | null
          override_score?: number | null; override_routing?: Record<string,unknown> | null
          review_notes?: string | null; queued_at?: string; created_at?: string
        }
        Update: {
          status?: string; reviewer_email?: string | null; reviewed_at?: string | null
          override_score?: number | null; override_routing?: Record<string,unknown> | null
          review_notes?: string | null; routing_decision?: Record<string,unknown> | null
        }
        Relationships: []
      }

      // ─── transaction_outcomes ─────────────────────────────────────────────
      transaction_outcomes: {
        Row: {
          id: string; property_id: string; distribution_event_id: string | null
          agent_email: string | null; investor_id: string | null
          asking_price: number | null; final_sale_price: number | null
          avm_value_at_time: number | null; negotiation_delta_pct: number | null
          avm_error_pct: number | null; negotiation_duration_days: number | null
          outcome_type: 'won' | 'lost' | 'withdrawn'; closing_friction: string | null
          score_at_time: number | null; grade_at_time: string | null
          distribution_rank_at_time: number | null; distribution_tier_at_time: string | null
          closed_at: string | null; recorded_at: string; recorded_by: string | null; notes: string | null
        }
        Insert: {
          id?: string; property_id: string; distribution_event_id?: string | null
          agent_email?: string | null; investor_id?: string | null
          asking_price?: number | null; final_sale_price?: number | null
          avm_value_at_time?: number | null; negotiation_delta_pct?: number | null
          avm_error_pct?: number | null; negotiation_duration_days?: number | null
          outcome_type: string; closing_friction?: string | null
          score_at_time?: number | null; grade_at_time?: string | null
          distribution_rank_at_time?: number | null; distribution_tier_at_time?: string | null
          closed_at?: string | null; recorded_at?: string; recorded_by?: string | null; notes?: string | null
        }
        Update: {
          final_sale_price?: number | null; avm_value_at_time?: number | null
          negotiation_delta_pct?: number | null; avm_error_pct?: number | null
          negotiation_duration_days?: number | null; outcome_type?: string
          closing_friction?: string | null; closed_at?: string | null
          recorded_by?: string | null; notes?: string | null
        }
        Relationships: []
      }

      // ─── distribution_outcomes ────────────────────────────────────────────
      distribution_outcomes: {
        Row: {
          id: string; distribution_event_id: string; property_id: string
          recipient_email: string; recipient_type: 'agent' | 'investor'
          recipient_tier: string | null; distribution_rank: number | null
          opened_at: string | null; replied_at: string | null
          meeting_booked_at: string | null; offer_submitted_at: string | null; closed_at: string | null
          outcome: 'no_response' | 'opened' | 'replied' | 'meeting' | 'offer' | 'won' | 'lost' | null
          rejection_reason: string | null
          time_to_reply_hours: number | null; time_to_close_days: number | null
          created_at: string
        }
        Insert: {
          id?: string; distribution_event_id: string; property_id: string
          recipient_email: string; recipient_type: string
          recipient_tier?: string | null; distribution_rank?: number | null
          opened_at?: string | null; replied_at?: string | null
          meeting_booked_at?: string | null; offer_submitted_at?: string | null
          closed_at?: string | null; outcome?: string | null
          rejection_reason?: string | null
          time_to_reply_hours?: number | null; time_to_close_days?: number | null
          created_at?: string
        }
        Update: {
          opened_at?: string | null; replied_at?: string | null
          meeting_booked_at?: string | null; offer_submitted_at?: string | null
          closed_at?: string | null; outcome?: string | null
          rejection_reason?: string | null
          time_to_reply_hours?: number | null; time_to_close_days?: number | null
        }
        Relationships: []
      }

      // ─── recipient_performance_profiles ──────────────────────────────────
      recipient_performance_profiles: {
        Row: {
          recipient_email: string; recipient_type: 'agent' | 'investor'
          current_tier: string | null
          total_distributions: number; total_opens: number; total_replies: number
          total_meetings: number; total_offers: number; total_won: number
          open_rate: number | null; reply_rate: number | null; meeting_rate: number | null
          offer_rate: number | null; close_rate: number | null
          avg_commission: number | null; total_commission: number | null; roi_score: number | null
          distributions_last_7d: number; distributions_last_30d: number
          last_distributed_at: string | null; fatigue_score: number
          is_fatigued: boolean; cooldown_until: string | null
          last_computed_at: string; created_at: string
        }
        Insert: {
          recipient_email: string; recipient_type: string; current_tier?: string | null
          total_distributions?: number; total_opens?: number; total_replies?: number
          total_meetings?: number; total_offers?: number; total_won?: number
          open_rate?: number | null; reply_rate?: number | null; meeting_rate?: number | null
          offer_rate?: number | null; close_rate?: number | null
          avg_commission?: number | null; total_commission?: number | null
          roi_score?: number | null; distributions_last_7d?: number
          distributions_last_30d?: number; last_distributed_at?: string | null
          fatigue_score?: number; is_fatigued?: boolean; cooldown_until?: string | null
          last_computed_at?: string; created_at?: string
        }
        Update: {
          current_tier?: string | null; total_distributions?: number; total_opens?: number
          total_replies?: number; total_meetings?: number; total_offers?: number
          total_won?: number; open_rate?: number | null; reply_rate?: number | null
          meeting_rate?: number | null; offer_rate?: number | null; close_rate?: number | null
          avg_commission?: number | null; total_commission?: number | null
          roi_score?: number | null; distributions_last_7d?: number
          distributions_last_30d?: number; last_distributed_at?: string | null
          fatigue_score?: number; is_fatigued?: boolean; cooldown_until?: string | null
          last_computed_at?: string
        }
        Relationships: []
      }

      // ─── partner_tiers ────────────────────────────────────────────────────
      partner_tiers: {
        Row: {
          partner_email: string; partner_type: string
          tier: 'ELITE' | 'PRIORITY' | 'STANDARD' | 'WATCHLIST'
          tier_score: number | null; tier_computed_at: string
          criteria: Record<string,unknown>; previous_tier: string | null
          tier_changed_at: string | null; created_at: string; updated_at: string
        }
        Insert: {
          partner_email: string; partner_type: string; tier?: string
          tier_score?: number | null; tier_computed_at?: string
          criteria?: Record<string,unknown>; previous_tier?: string | null
          tier_changed_at?: string | null; created_at?: string; updated_at?: string
        }
        Update: {
          partner_type?: string; tier?: string; tier_score?: number | null
          tier_computed_at?: string; criteria?: Record<string,unknown>
          previous_tier?: string | null; tier_changed_at?: string | null; updated_at?: string
        }
        Relationships: []
      }

      // ─── calibration_recommendations ──────────────────────────────────────
      calibration_recommendations: {
        Row: {
          id: string; report_date: string
          priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
          dimension: string; observation: string; suggestion: string
          evidence: string | null
          status: 'pending' | 'applied' | 'dismissed' | 'deferred'
          reviewed_by: string | null; reviewed_at: string | null
          notes: string | null; created_at: string
        }
        Insert: {
          id?: string; report_date?: string; priority: string
          dimension: string; observation: string; suggestion: string
          evidence?: string | null; status?: string
          reviewed_by?: string | null; reviewed_at?: string | null
          notes?: string | null; created_at?: string
        }
        Update: {
          priority?: string; observation?: string; suggestion?: string
          evidence?: string | null; status?: string
          reviewed_by?: string | null; reviewed_at?: string | null; notes?: string | null
        }
        Relationships: []
      }

      // ─── revenue_attribution ──────────────────────────────────────────────
      revenue_attribution: {
        Row: {
          id: string; property_id: string; distribution_event_id: string | null
          agent_email: string | null; investor_id: string | null
          close_status: string | null; sale_price: number | null
          commission_total: number | null; commission_rate: number | null
          attributed_source: string | null; attributed_score_grade: string | null
          attributed_tier: string | null; distribution_rank: number | null
          closed_at: string | null; created_at: string
        }
        Insert: {
          id?: string; property_id: string; distribution_event_id?: string | null
          agent_email?: string | null; investor_id?: string | null
          close_status?: string | null; sale_price?: number | null
          commission_total?: number | null; commission_rate?: number | null
          attributed_source?: string | null; attributed_score_grade?: string | null
          attributed_tier?: string | null; distribution_rank?: number | null
          closed_at?: string | null; created_at?: string
        }
        Update: {
          close_status?: string | null; sale_price?: number | null
          commission_total?: number | null; closed_at?: string | null
        }
        Relationships: []
      }

      // ─── job_queue ────────────────────────────────────────────────────────
      job_queue: {
        Row: {
          id: string; job_type: string; payload: Record<string,unknown>
          status: 'pending' | 'running' | 'completed' | 'failed' | 'dead'
          attempts: number; max_attempts: number; next_retry_at: string | null
          last_error: string | null; completed_at: string | null
          result: Record<string,unknown> | null; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; job_type: string; payload?: Record<string,unknown>
          status?: string; attempts?: number; max_attempts?: number
          next_retry_at?: string | null; last_error?: string | null
          completed_at?: string | null; result?: Record<string,unknown> | null
          created_at?: string; updated_at?: string
        }
        Update: {
          status?: string; attempts?: number; next_retry_at?: string | null
          last_error?: string | null; completed_at?: string | null
          result?: Record<string,unknown> | null; updated_at?: string
        }
        Relationships: []
      }

      // ─── data_quality_flags ───────────────────────────────────────────────
      data_quality_flags: {
        Row: {
          id: string; property_id: string | null; provider_listing_id: string | null
          source_provider: string | null
          flag_type: 'price_anomaly' | 'malformed' | 'impossible_avm' | 'score_outlier' | 'duplicate_risk' | 'stale_data'
          severity: 'info' | 'warning' | 'critical'
          details: Record<string,unknown>
          status: 'open' | 'reviewed' | 'resolved' | 'false_positive'
          reviewed_by: string | null; reviewed_at: string | null
          resolution_notes: string | null; created_at: string
        }
        Insert: {
          id?: string; property_id?: string | null; provider_listing_id?: string | null
          source_provider?: string | null; flag_type: string; severity?: string
          details?: Record<string,unknown>; status?: string
          reviewed_by?: string | null; reviewed_at?: string | null
          resolution_notes?: string | null; created_at?: string
        }
        Update: {
          status?: string; reviewed_by?: string | null; reviewed_at?: string | null
          resolution_notes?: string | null; severity?: string
        }
        Relationships: []
      }

      // ─── price_history ────────────────────────────────────────────────────
      price_history: {
        Row: {
          id: string; property_id: string; price_old: number; price_new: number
          price_delta: number | null; pct_change: number | null
          change_type: 'reduction' | 'increase' | 'correction'
          source: string; agent_email: string | null; notes: string | null; created_at: string
        }
        Insert: {
          id?: string; property_id: string; price_old: number; price_new: number
          change_type: string; source?: string
          agent_email?: string | null; notes?: string | null; created_at?: string
        }
        Update: { notes?: string | null }
        Relationships: []
      }

      // ─── market_segment_trends ────────────────────────────────────────────
      market_segment_trends: {
        Row: {
          id: string; zone_key: string; property_type: string
          price_band: 'under_200k' | '200k_500k' | '500k_1m' | '1m_3m' | 'over_3m' | 'all'
          period_label: '7d' | '30d' | '90d'; snapshot_date: string
          avg_price_per_sqm: number | null; median_price_per_sqm: number | null
          price_confidence_low: number | null; price_confidence_high: number | null
          price_trend: 'rising' | 'stable' | 'falling' | 'unknown' | null
          avg_negotiation_delta: number | null; median_negotiation_delta: number | null
          pct_sold_above_ask: number | null; avg_sale_to_ask_ratio: number | null
          avg_days_to_close: number | null; median_days_to_close: number | null
          deal_count: number; avg_avm_error_pct: number | null; avm_mae: number | null
          investor_deal_pct: number | null; agent_deal_pct: number | null
          confidence_score: number | null; sample_size: number | null
          regime_shift_detected: boolean; regime_shift_metric: string | null
          regime_shift_magnitude: number | null; computed_at: string
        }
        Insert: {
          id?: string; zone_key: string; property_type: string; price_band?: string
          period_label: string; snapshot_date?: string
          avg_price_per_sqm?: number | null; median_price_per_sqm?: number | null
          price_trend?: string | null; avg_negotiation_delta?: number | null
          avg_days_to_close?: number | null; deal_count?: number
          confidence_score?: number | null; sample_size?: number | null
          regime_shift_detected?: boolean; regime_shift_metric?: string | null
          regime_shift_magnitude?: number | null; computed_at?: string
        }
        Update: {
          avg_price_per_sqm?: number | null; median_price_per_sqm?: number | null
          price_trend?: string | null; avg_negotiation_delta?: number | null
          avg_days_to_close?: number | null; deal_count?: number
          confidence_score?: number | null; regime_shift_detected?: boolean
          regime_shift_metric?: string | null; regime_shift_magnitude?: number | null
          computed_at?: string
        }
        Relationships: []
      }

      // ─── market_feedback_signals ──────────────────────────────────────────
      market_feedback_signals: {
        Row: {
          id: string; zone_key: string; asset_class: string; period_label: string
          absorption_rate: number | null; listing_velocity_chg: number | null
          price_delta_pct: number | null; demand_supply_ratio: number | null
          market_pressure: string | null; market_regime: string | null
          market_health_score: number | null; pricing_pressure_idx: number | null
          computed_at: string; created_at: string
        }
        Insert: {
          id?: string; zone_key: string; asset_class: string; period_label: string
          absorption_rate?: number | null; listing_velocity_chg?: number | null
          price_delta_pct?: number | null; demand_supply_ratio?: number | null
          market_pressure?: string | null; market_regime?: string | null
          market_health_score?: number | null; pricing_pressure_idx?: number | null
          computed_at?: string; created_at?: string
        }
        Update: {
          absorption_rate?: number | null; listing_velocity_chg?: number | null
          price_delta_pct?: number | null; demand_supply_ratio?: number | null
          market_pressure?: string | null; market_regime?: string | null
          market_health_score?: number | null; pricing_pressure_idx?: number | null
          computed_at?: string
        }
        Relationships: []
      }

      // ─── referrals ────────────────────────────────────────────────────────
      referrals: {
        Row: {
          id: string; referrer_contact_id: string | null; referred_contact_id: string | null
          referrer_email: string | null; referred_email: string | null
          source: string; deal_id: string | null
          reward_triggered: boolean; reward_amount: number | null
          notes: string | null; created_at: string
        }
        Insert: {
          id?: string; referrer_contact_id?: string | null; referred_contact_id?: string | null
          referrer_email?: string | null; referred_email?: string | null
          source?: string; deal_id?: string | null
          reward_triggered?: boolean; reward_amount?: number | null
          notes?: string | null; created_at?: string
        }
        Update: {
          reward_triggered?: boolean; reward_amount?: number | null; notes?: string | null
        }
        Relationships: []
      }

      // ─── growth_metrics ───────────────────────────────────────────────────
      growth_metrics: {
        Row: {
          id: string; week_start: string
          new_leads: number; new_qualified: number; new_clients: number
          referral_count: number; organic_leads: number; paid_leads: number
          viral_coefficient: number | null; cac_eur: number | null; ltv_eur: number | null
          created_at: string
        }
        Insert: {
          id?: string; week_start: string
          new_leads?: number; new_qualified?: number; new_clients?: number
          referral_count?: number; organic_leads?: number; paid_leads?: number
          viral_coefficient?: number | null; cac_eur?: number | null; ltv_eur?: number | null
          created_at?: string
        }
        Update: {
          new_leads?: number; new_qualified?: number; new_clients?: number
          referral_count?: number; organic_leads?: number; paid_leads?: number
          viral_coefficient?: number | null; cac_eur?: number | null; ltv_eur?: number | null
        }
        Relationships: []
      }

      // ─── commission_records ───────────────────────────────────────────────
      commission_records: {
        Row: {
          id: string; property_id: string; agent_email: string
          sale_price: number | null; expected_commission: number | null
          realized_commission: number | null; split_pct: number | null
          split_counterpart_email: string | null
          cpcv_date: string | null; cpcv_amount: number | null
          escritura_date: string | null; escritura_amount: number | null
          payout_status: 'pending' | 'partial' | 'paid' | 'cancelled'
          paid_at: string | null; notes: string | null
          created_at: string; updated_at: string
        }
        Insert: {
          id?: string; property_id: string; agent_email: string
          sale_price?: number | null; expected_commission?: number | null
          realized_commission?: number | null; split_pct?: number | null
          split_counterpart_email?: string | null
          cpcv_date?: string | null; cpcv_amount?: number | null
          escritura_date?: string | null; escritura_amount?: number | null
          payout_status?: string; paid_at?: string | null; notes?: string | null
          created_at?: string; updated_at?: string
        }
        Update: {
          sale_price?: number | null; expected_commission?: number | null
          realized_commission?: number | null; payout_status?: string
          cpcv_date?: string | null; cpcv_amount?: number | null
          escritura_date?: string | null; escritura_amount?: number | null
          paid_at?: string | null; notes?: string | null; updated_at?: string
        }
        Relationships: []
      }
    }

    // -----------------------------------------------------------------------
    // VIEWS (none defined — required by Supabase GenericSchema)
    // -----------------------------------------------------------------------
    Views: {
      [_ in never]: never
    }

    // -----------------------------------------------------------------------
    // ENUMS (required by Supabase GenericSchema)
    // -----------------------------------------------------------------------
    Enums: {
      [_ in never]: never
    }

    // -----------------------------------------------------------------------
    // RPC FUNCTIONS
    // -----------------------------------------------------------------------
    Functions: {
      match_properties: {
        Args: {
          query_embedding: number[]
          match_threshold?: number
          match_count?: number
          filter?: Record<string, unknown>
        }
        Returns: Array<{
          id: string
          title: string
          zone: string | null
          price: number
          type: PropertyType
          bedrooms: number | null
          area_m2: number | null
          similarity: number
        }>
      }
      get_pipeline_summary: {
        Args: Record<string, never>
        Returns: Array<{
          stage: DealStage
          count: number
          total_value: number
          weighted_value: number
          avg_probability: number
        }>
      }
      search_properties_semantic: {
        Args: {
          query_embedding: number[]
          match_count?: number
        }
        Returns: Array<{
          id: string
          title: string
          zone: string | null
          price: number
          type: PropertyType
          bedrooms: number | null
          area_m2: number | null
          similarity: number
        }>
      }
    }
  }
}
