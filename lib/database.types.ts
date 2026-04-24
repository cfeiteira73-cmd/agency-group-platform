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
