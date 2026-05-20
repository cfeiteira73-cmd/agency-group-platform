#!/usr/bin/env bash
# =============================================================================
# Agency Group — Redpanda Topic Initialisation
# infra/redpanda/create-topics.sh
#
# Creates all platform topics with the correct partition counts, replication
# factors, and retention policies for the 3-node Redpanda cluster.
#
# Prerequisites:
#   docker compose up -d   (cluster must be healthy)
#
# Usage:
#   chmod +x create-topics.sh
#   ./create-topics.sh                      # uses default localhost:19092
#   ./create-topics.sh localhost:19092      # explicit broker address
#
# Topics are idempotent — running the script twice is safe (existing topics
# produce an "already exists" warning and the script continues).
# =============================================================================

set -euo pipefail

BROKER="${1:-localhost:19092}"
RPK="docker exec redpanda-0 rpk"

# ─── Helper ────────────────────────────────────────────────────────────────────

create_topic() {
  local name="$1"
  local partitions="$2"
  local retention_ms="$3"

  echo "  creating: ${name}  (partitions=${partitions}, retention=${retention_ms}ms)"
  $RPK topic create "${name}" \
    --brokers "${BROKER}" \
    --partitions "${partitions}" \
    --replicas 3 \
    --topic-config "retention.ms=${retention_ms}" \
    --topic-config "cleanup.policy=delete" \
    2>&1 || echo "    (already exists or warning — continuing)"
}

echo "=== Agency Group — Redpanda topic init ==="
echo "    broker: ${BROKER}"
echo ""

# ─── Revenue / deal — 12 partitions, 168 h (604 800 000 ms) ──────────────────
echo "--- Revenue & deal topics (12p / 168h) ---"
for t in deal.created deal.updated deal.closed revenue.recognized commission.calculated; do
  create_topic "${t}" 12 604800000
done

# ─── Property — 6 partitions, 720 h (2 592 000 000 ms) ──────────────────────
echo ""
echo "--- Property topics (6p / 720h) ---"
for t in property.ingested property.normalized property.enriched property.scored; do
  create_topic "${t}" 6 2592000000
done

# ─── Lead / investor / market / AI — 6 partitions, 336 h (1 209 600 000 ms) ─
echo ""
echo "--- Lead, investor, market & AI topics (6p / 336h) ---"
for t in lead.created lead.qualified investor.created investor.matched market.snapshot ai.requested ai.executed; do
  create_topic "${t}" 6 1209600000
done

# ─── System — 3 partitions, 72 h (259 200 000 ms) ────────────────────────────
echo ""
echo "--- System topics (3p / 72h) ---"
for t in system.failure system.recovery; do
  create_topic "${t}" 3 259200000
done

# ─── DLQ topics — 3 partitions, 720 h (long retention for investigation) ─────
echo ""
echo "--- DLQ topics (3p / 720h) ---"
for t in \
  deal.created deal.updated deal.closed \
  revenue.recognized commission.calculated \
  property.ingested property.normalized property.enriched property.scored \
  lead.created lead.qualified \
  investor.created investor.matched \
  market.snapshot ai.requested ai.executed \
  system.failure system.recovery
do
  create_topic "${t}.dlq" 3 2592000000
done

echo ""
echo "=== All topics created successfully ==="
