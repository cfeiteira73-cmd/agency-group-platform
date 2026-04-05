# Agency Group Portal — Quick Setup

## Prerequisites
- Node.js 18+
- Git
- Supabase account
- Anthropic API key

## 1. Clone & Install
```bash
git clone https://github.com/your-org/agency-group.git
cd agency-group
npm install
```

## 2. Environment Variables
```bash
cp .env.local.example .env.local
# Edit .env.local with your values
```

## 3. Database Setup
1. Go to Supabase Dashboard → SQL Editor
2. Run `supabase/migrations/001_initial_check.sql` (verify existing tables)
3. Run `supabase/migrations/002_missing_tables.sql` (create missing tables)
4. Run `scripts/seed-supabase.js` to seed initial data:
```bash
node scripts/seed-supabase.js
node scripts/seed-properties-deals.js
```

## 4. Run Development Server
```bash
npm run dev
# Open http://localhost:3000
```

## 5. Verify Health
```bash
curl http://localhost:3000/api/health
# Should return: { "status": "healthy", "counts": { "contacts": 10, "properties": 8, "deals": 8 } }
```

## 6. Deploy to Production (Vercel)
```bash
npx vercel deploy
# Add all .env.local variables to Vercel dashboard
```

## 7. Deploy Scraper (Railway)
See `services/scraper/README.md`

## 8. Deploy n8n (Railway)
See `n8n-workflows/IMPORT_GUIDE.md`

## 9. WhatsApp Setup
See `docs/whatsapp-setup.md`
