# Property AI Engine — Deployment Checklist
## AGENCY GROUP SH-ROS | AMI: 22506

### Status: Code ✅ | DB Migrations ⏳ | Storage ⏳

---

## Step 1 — Apply Database Migrations

Open the Supabase SQL Editor:
**https://supabase.com/dashboard/project/isbfiofwpxqqpgxoftph/sql/new**

### Migration 020 — 9 New Tables (run first)
File: `supabase/migrations/20260516_020_property_ai.sql`

Tables created:
- `property_ai_submissions` — incoming upload submissions
- `property_ai_analysis` — vision + OCR + geo results
- `property_ai_listings` — multilingual generated listings
- `property_ai_media` — scored media assets
- `property_ai_intelligence` — demand / investor / homepage scores
- `property_ai_copilot` — agent recommendations
- `property_ai_distribution` — channel distribution results
- `property_ai_performance_events` — CTR / click / view events
- `property_ai_learning_adjustments` — feedback loop weight changes

All tables: RLS enabled, service_role only, CASCADE DELETE from submissions.

Verify after running:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'property_ai_%' ORDER BY table_name;
-- Expected: 9 rows
```

### Migration 021 — Storage Bucket
File: `supabase/migrations/20260516_021_storage.sql`

Creates `property-media` public bucket (50MB limit):
- Accepts: JPG, PNG, WebP, HEIC, MP4, MOV, WebM, MP3, M4A, WAV, OGG, PDF
- Public read (required for Claude Vision URL analysis)
- Service-role-only write (API routes use `SUPABASE_SERVICE_ROLE_KEY`)

Verify after running:
```sql
SELECT id, name, public FROM storage.buckets WHERE id = 'property-media';
-- Expected: 1 row, public = true
```

---

## Step 2 — Verify API Routes

After migrations are applied, test the pipeline:

```bash
# Upload test (requires auth cookie)
curl -X POST https://agencygroup.pt/api/property-ai/submit \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "org_id": "agency-group",
    "agent_id": "test-agent",
    "input_files": [],
    "raw_description": "Moradia T4 com piscina em Cascais, 320m2, vista mar, garagem dupla",
    "price_eur": 1850000
  }'
```

Expected response shape:
```json
{
  "submission_id": "<uuid>",
  "status": "live",
  "pipeline": {
    "ingestion": { "confidence": 0.7, "missing_info": [...], "analysis": {...} },
    "listing":   { "listing_id": "...", "title": {...} },
    "media":     { "total": 0, "quality": "poor" },
    "intelligence": { "demand_score": 72, "listing_readiness": 68 },
    "copilot":   { "readiness_score": 68, "ready_to_publish": true, "optimal_price": 1850000 },
    "distribution": { "channels": [...], "success_count": 7 }
  },
  "processing_time_ms": 12000
}
```

---

## Step 3 — Test Upload Page

Navigate to: **https://agencygroup.pt/dashboard/properties/new**

The page now uses real APIs:
1. Files → `POST /api/property-ai/upload` (Supabase Storage)
2. Pipeline → `POST /api/property-ai/submit` (full AI pipeline, ~30–60s)
3. Status → `GET /api/property-ai/submissions/:id` (polling)

---

## Architecture Overview

```
Browser Upload Page
    │
    ├── POST /api/property-ai/upload     → Supabase Storage (property-media bucket)
    │                                      Returns: [{ file_id, url, type }]
    │
    └── POST /api/property-ai/submit     (max 60s)
            │
            ├── 1. mediaIngestionOrchestrator.orchestrate()
            │      ├── visionAnalyzer        (Claude claude-opus-4-5 Vision)
            │      ├── ocrDocumentIntelligence (PDF energy certs, floorplans)
            │      ├── voiceIntelligence     (audio notes → seller intent)
            │      └── geospatialIntelligence (Portugal zone map)
            │
            ├── 2. listingOrchestrator.generate()
            │      └── PT+EN parallel → ES+FR parallel → DE+AR (luxury only)
            │
            ├── 3. mediaOrchestrator.process()
            │      ├── imageScoringEngine   (aesthetic score, blur/dup detection)
            │      └── coverImageSelector   (canonical room order)
            │
            ├── 4. propertyIntelligenceEngine.compute()
            │      ├── demandScorer
            │      ├── pricingCompetitivenessAnalyzer
            │      ├── investorAttractivenessScorer
            │      └── homepagePlacementScorer
            │
            ├── 5. copilotOrchestrator.generate()
            │      ├── listingReadinessScorer (grade A–F)
            │      ├── pricingAdvisor        (4 strategies)
            │      ├── publishingTimingAdvisor
            │      └── targetAudienceAdvisor (Portugal 2026 buyer data)
            │
            └── 6. distributionOrchestrator.distribute()
                   ├── Luxury (≥€1M):    kyero + instagram + whatsapp + idealista
                   └── Standard:         idealista + imovirtual + instagram + facebook
```

---

## Pending (Future)

- [ ] WhatsApp Business API credentials (status always `pending` until configured)
- [ ] CDN image transforms for `socialMediaCropper` crop specs (Cloudinary/Imgix)
- [ ] n8n webhook trigger on `status = live` → notify agent via Resend
- [ ] `GET /api/property-ai/submissions` list endpoint (all submissions for org)
