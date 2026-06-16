#!/usr/bin/env bash
set -euo pipefail

SECRET="${PM_BENCHMARK_WEBHOOK_SECRET:-${BENCHMARK_WEBHOOK_SECRET:-test-secret}}"
URL="https://projects.sitedeck.pro/api/v1/webhooks/benchmark"

echo "=== Smoke Test 1: Inbound benchmark webhook (inspection.completed) ==="
BODY='{"event":"benchmark.inspection.completed","eventId":"smoke-insp-001","projectId":"proj-smoke-001","inspectionId":"insp-123","result":"failed","dfowId":"dfow-001","description":"Concrete pour failed slump test"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
SIG="sha256=$SIG"
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  -H "Content-Type: application/json" \
  -H "x-benchmark-signature: $SIG" \
  -d "$BODY" "$URL"

echo ""
echo "=== Smoke Test 2: Inbound benchmark webhook (ncr.opened) ==="
BODY2='{"event":"benchmark.ncr.opened","eventId":"smoke-ncr-001","projectId":"proj-smoke-001","ncrId":"ncr-001","internalNumber":"NCR-2026-042","severity":"high","description":"Rebar spacing non-conformance"}'
SIG2=$(printf '%s' "$BODY2" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
SIG2="sha256=$SIG2"
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  -H "Content-Type: application/json" \
  -H "x-benchmark-signature: $SIG2" \
  -d "$BODY2" "$URL"

echo ""
echo "=== Smoke Test 3: Invalid signature (should return 200 ignored) ==="
BODY3='{"event":"benchmark.hold_point.released","projectId":"proj-smoke-001","holdPointId":"hp-001"}'
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  -H "Content-Type: application/json" \
  -H "x-benchmark-signature: sha256=bad" \
  -d "$BODY3" "$URL"

echo ""
echo "=== Smoke Test 4: GET benchmark-activity for project ==="
curl -s -w "\nHTTP %{http_code}\n" \
  "https://projects.sitedeck.pro/api/v1/projects/proj-smoke-001/benchmark-activity"

echo ""
echo "=== Smoke Test 5: Health check — Benchmark connection ==="
curl -s -w "\nHTTP %{http_code}\n" \
  "https://projects.sitedeck.pro/api/v1/health/connected-products"
