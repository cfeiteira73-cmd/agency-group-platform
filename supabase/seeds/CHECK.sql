SELECT
  (SELECT COUNT(*) FROM offmarket_leads) as leads_count,
  (SELECT COUNT(*) FROM market_price_refs) as price_refs_count,
  (SELECT COUNT(*) FROM contacts) as contacts_count,
  (SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name=''offmarket_leads'' AND column_name=''master_attack_rank'')) as has_master_attack_rank,
  (SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name=''offmarket_leads'' AND column_name=''deal_readiness_score'')) as has_deal_readiness,
  (SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name=''offmarket_leads'' AND column_name=''last_call_at'')) as has_call_tracking,
  (SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name=''offmarket_leads'' AND column_name=''call_done_today'')) as has_call_done_today,
  (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name=''agent_daily_discipline'')) as has_discipline_table,
  (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name=''buyer_match_results'')) as has_buyer_match_table;
