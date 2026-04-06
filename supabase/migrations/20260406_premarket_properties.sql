-- Pre-market / exclusive properties table
CREATE TABLE IF NOT EXISTS premarket_properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  zone TEXT NOT NULL,
  type TEXT NOT NULL, -- 'Apartamento' | 'Moradia' | 'Quinta'
  price_min INTEGER,
  price_max INTEGER,
  area INTEGER,
  bedrooms INTEGER,
  description TEXT,
  features TEXT[], -- array of feature strings
  available_from DATE,
  exclusive_until DATE,
  access_level TEXT DEFAULT 'registered', -- 'registered' | 'premium' | 'vip'
  images TEXT[], -- array of image URLs
  agent_name TEXT,
  agent_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  views_count INTEGER DEFAULT 0,
  alerts_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Property alerts (interested buyers)
CREATE TABLE IF NOT EXISTS property_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  zone TEXT,
  type TEXT,
  min_price INTEGER,
  max_price INTEGER,
  min_bedrooms INTEGER,
  features TEXT[],
  notify_email BOOLEAN DEFAULT true,
  notify_push BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pre-market interest (user interested in specific property)
CREATE TABLE IF NOT EXISTS premarket_interest (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES premarket_properties(id) ON DELETE CASCADE,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, property_id)
);

-- RLS policies
ALTER TABLE premarket_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE premarket_interest ENABLE ROW LEVEL SECURITY;

-- Public can read active pre-market properties
CREATE POLICY "Public can view active premarket" ON premarket_properties
  FOR SELECT USING (is_active = true);

-- Users manage their own alerts
CREATE POLICY "Users manage own alerts" ON property_alerts
  FOR ALL USING (auth.uid() = user_id);

-- Users manage their own interest
CREATE POLICY "Users manage own interest" ON premarket_interest
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_premarket_zone ON premarket_properties(zone);
CREATE INDEX IF NOT EXISTS idx_premarket_active ON premarket_properties(is_active);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON property_alerts(user_id);
