-- =============================================================================
-- AGENCY GROUP — SH-ROS Migration 021: Property AI Storage Bucket
-- Creates property-media bucket for photo/video/PDF/audio uploads
-- AMI: 22506 | Safe additive — only creates bucket if not exists
-- =============================================================================

-- Create the property-media bucket (public so Claude Vision can fetch URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-media',
  'property-media',
  true,                                    -- public so AI can fetch via URL
  52428800,                                -- 50 MB per file limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS: allow service_role to upload (via server API routes)
CREATE POLICY IF NOT EXISTS "property_media_service_upload"
  ON storage.objects
  FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'property-media');

-- RLS: allow service_role to read/delete
CREATE POLICY IF NOT EXISTS "property_media_service_read"
  ON storage.objects
  FOR SELECT
  TO service_role
  USING (bucket_id = 'property-media');

-- RLS: allow public read (so URLs work for Claude Vision + portals)
CREATE POLICY IF NOT EXISTS "property_media_public_read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'property-media');

-- =============================================================================
-- Migration 021 complete — property-media bucket created (public, 50MB limit)
-- =============================================================================
