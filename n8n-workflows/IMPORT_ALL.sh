#!/bin/bash
# =============================================================================
# Agency Group — Import All n8n Workflows to Cloud
# Run: bash n8n-workflows/IMPORT_ALL.sh
#
# Requires:
#   N8N_API_KEY  — Settings → API Keys in n8n Cloud
#   N8N_BASE_URL — https://agencygroup.app.n8n.cloud
#
# Order: non-dependent workflows first, then dependent ones last
# =============================================================================

N8N_API_KEY="${N8N_API_KEY:?Set N8N_API_KEY env var}"
N8N_BASE_URL="${N8N_BASE_URL:-https://agencygroup.app.n8n.cloud}"
DIR="$(dirname "$0")"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

import_workflow() {
  local file="$1"
  local name
  name=$(python3 -c "import json,sys; d=json.load(open('$file')); print(d.get('name','?'))" 2>/dev/null || echo "$file")

  echo -n "  → Importing: $name ... "

  local response
  response=$(curl -s -X POST \
    "${N8N_BASE_URL}/rest/workflows" \
    -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
    -H "Content-Type: application/json" \
    -d @"$file")

  local id
  id=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)

  if [ -n "$id" ]; then
    echo -e "${GREEN}✓ id=$id${NC}"
    # Activate immediately
    curl -s -X PATCH \
      "${N8N_BASE_URL}/rest/workflows/${id}" \
      -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
      -H "Content-Type: application/json" \
      -d '{"active":true}' > /dev/null
    echo -e "    ${GREEN}↳ Activated${NC}"
  else
    echo -e "${RED}✗ Failed${NC}"
    echo "    Response: $response" | head -2
  fi
}

echo ""
echo -e "${YELLOW}━━━ Agency Group — n8n Workflow Import ━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "  Base: $N8N_BASE_URL"
echo ""

# Phase 1: Core ingestion (no dependencies)
echo "Phase 1: Core ingestion"
import_workflow "$DIR/workflow-a-lead-inbound.json"
import_workflow "$DIR/workflow-a-lead-enrichment.json"
import_workflow "$DIR/wf_g_current.json"

# Phase 2: Alerts + matching (depend on contacts table)
echo ""
echo "Phase 2: Alerts + matching"
import_workflow "$DIR/workflow-p-saved-search-created.json"
import_workflow "$DIR/workflow-q-property-alert-match.json"

# Phase 3: Scoring + nurture
echo ""
echo "Phase 3: Scoring + nurture"
import_workflow "$DIR/workflow-b-lead-scoring.json"
import_workflow "$DIR/workflow-h-score-high-alert.json"
import_workflow "$DIR/workflow-r-lead-nurture.json"

# Phase 4: Follow-up + reactivation
echo ""
echo "Phase 4: Follow-up + reactivation"
import_workflow "$DIR/workflow-i-followup-auto.json"
import_workflow "$DIR/workflow-c-dormant-lead.json"
import_workflow "$DIR/workflow-l-lead-reactivation.json"

# Phase 5: Investor + vendor
echo ""
echo "Phase 5: Investor + vendor"
import_workflow "$DIR/workflow-d-investor-alert.json"
import_workflow "$DIR/workflow-e-vendor-report.json"

# Phase 6: Partners + meetings
echo ""
echo "Phase 6: Partners + meetings"
import_workflow "$DIR/workflow-j-partner-onboarding.json"
import_workflow "$DIR/workflow-k-meeting-notify.json"
import_workflow "$DIR/workflow-m-advisor-assignment.json"

# Phase 7: Reporting (daily/weekly)
echo ""
echo "Phase 7: Reporting"
import_workflow "$DIR/workflow-b-daily-report.json"
import_workflow "$DIR/workflow-n-daily-digest.json"
import_workflow "$DIR/workflow-o-weekly-performance.json"

echo ""
echo -e "${GREEN}━━━ Import complete ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "  Check: ${N8N_BASE_URL}/workflows"
echo ""
