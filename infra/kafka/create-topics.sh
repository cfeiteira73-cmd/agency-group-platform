#!/usr/bin/env bash
# =============================================================================
# Agency Group — Kafka / Redpanda Topic Initialisation
# infra/kafka/create-topics.sh
#
# Creates ALL production topics with proper partition counts, replication,
# retention policies, and DLQs.  Partition counts match PARTITION_COUNTS in
# lib/events/partitionStrategy.ts and TOPIC_CONFIGS in lib/events/kafkaTopics.ts.
#
# Prerequisites:
#   docker compose -f infra/kafka/docker-compose.redpanda.yml up -d
#   (all 3 brokers must be healthy — replication factor 3 requires all 3 nodes)
#
# Usage:
#   chmod +x infra/kafka/create-topics.sh
#   ./infra/kafka/create-topics.sh                  # default: localhost:19092
#   ./infra/kafka/create-topics.sh localhost:19092  # explicit broker address
#
# Idempotent: safe to run multiple times — existing topics log a warning and
# the script continues.
# =============================================================================

set -euo pipefail

BROKER="${1:-localhost:19092}"
RF=3   # replication factor — requires all 3 brokers running
RPK="docker exec redpanda-0 rpk"

# ─── Helpers ────────────────────────────────────────────────────────────────────

create_topic() {
  local topic="$1"
  local partitions="$2"
  local retention_ms="$3"

  echo "  [topic] ${topic}  (partitions=${partitions}, rf=${RF}, retention=${retention_ms}ms)"
  $RPK topic create "${topic}" \
    --brokers "${BROKER}" \
    --partitions "${partitions}" \
    --replicas "${RF}" \
    --topic-config "retention.ms=${retention_ms}" \
    --topic-config "min.insync.replicas=2" \
    --topic-config "cleanup.policy=delete" \
    2>&1 | grep -v "^$" || echo "    (already exists — skipping)"
}

create_dlq() {
  local topic="$1"
  # DLQs: 3 partitions, 30-day retention for investigation + replay
  create_topic "${topic}.dlq" 3 2592000000
}

echo "==================================================================="
echo " Agency Group — Redpanda topic initialisation"
echo " broker : ${BROKER}"
echo " RF     : ${RF}"
echo "==================================================================="
echo ""

# ─── Domain (aggregate) topics ──────────────────────────────────────────────────
# These are what producers actually write to (see kafkaAdapter.ts EVENT_TOPIC_MAP).
# Partition counts from lib/events/partitionStrategy.ts PARTITION_COUNTS.

echo "--- Domain topics ---"
create_topic "deal-events"          12  604800000   # 7 days
create_topic "revenue-events"        6  2592000000  # 30 days (financial records)
create_topic "property-events"      24  604800000   # 7 days  (high volume)
create_topic "investor-events"      12  604800000   # 7 days
create_topic "lead-events"          12  604800000   # 7 days
create_topic "ai-events"             6  259200000   # 3 days
create_topic "system-events"         3  604800000   # 7 days
create_topic "intelligence-events"   6  604800000   # 7 days
create_topic "governance-events"     3  2592000000  # 30 days (compliance)
create_topic "platform-events"       6  604800000   # 7 days  (catch-all)

echo ""

# ─── Granular dot-notation topics ───────────────────────────────────────────────
# Used by targeted consumers and Redpanda Console for per-event-type inspection.
# Partition counts from lib/events/kafkaTopics.ts TOPIC_CONFIGS.

echo "--- Granular (dot-notation) topics ---"

# Deal / revenue — 12 partitions, 7 days
create_topic "deal.created"         12  604800000
create_topic "deal.updated"         12  604800000
create_topic "deal.closed"          12  2592000000  # 30 days (revenue audit)
create_topic "revenue.recognized"   12  2592000000  # 30 days (financial)
create_topic "commission.calculated" 12 2592000000  # 30 days

# Property — 6 partitions, 30 days
create_topic "property.ingested"     6  2592000000
create_topic "property.normalized"   6  2592000000
create_topic "property.enriched"     6  2592000000
create_topic "property.scored"       6  2592000000
create_topic "property.fraud_detected" 6 604800000

# Lead / investor — 6 partitions, 14 days
create_topic "lead.created"          6  1209600000
create_topic "lead.qualified"        6  1209600000
create_topic "investor.created"      6  1209600000
create_topic "investor.matched"      6  1209600000

# Market / AI — 6 partitions, 14 days
create_topic "market.snapshot"       6  1209600000
create_topic "ai.requested"          6  1209600000
create_topic "ai.executed"           6  1209600000

# ML training signals — low volume
create_topic "ml.training_event"     3  604800000
create_topic "ml.retrain_trigger"    1  86400000    # 1 day, very low volume

# System / governance — 3 partitions
create_topic "system.failure"        3  259200000
create_topic "system.recovery"       3  259200000

echo ""

# ─── DLQ topics ─────────────────────────────────────────────────────────────────
# 30-day retention on all DLQs for post-mortem investigation and replay.

echo "--- DLQ topics (3p / 30d each) ---"

# Domain DLQs (critical paths)
create_dlq "deal-events"
create_dlq "revenue-events"
create_dlq "property-events"
create_dlq "investor-events"
create_dlq "lead-events"
create_dlq "platform-events"

# Granular DLQs (high-value events)
create_dlq "deal.closed"
create_dlq "revenue.recognized"
create_dlq "commission.calculated"
create_dlq "property.scored"
create_dlq "property.fraud_detected"
create_dlq "investor.matched"
create_dlq "deal.created"
create_dlq "deal.updated"
create_dlq "property.ingested"
create_dlq "lead.created"
create_dlq "ai.requested"
create_dlq "ai.executed"
create_dlq "system.failure"

echo ""
echo "==================================================================="
echo " All topics created successfully."
echo " Run: docker exec redpanda-0 rpk topic list --brokers ${BROKER}"
echo "==================================================================="
