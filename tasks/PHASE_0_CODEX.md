# PHASE 0 — Codex task: Binance WebSocket ingestion

## Purpose
Turn existing minimalist scaffold into a reliable **browser-only** Binance USD-M Futures live feed. No backend, Node, npm, framework, secrets, trading actions.

## Required work
1. Create a clean event schema `{symbol,type,exchangeTime,receivedTime,source,payload}` for `aggTrade` and `kline_1m`, with explicit partial/closed kline semantics; add parser fixtures captured from docs/real packets.
2. Implement reconnect with jitter/backoff, stream resubscription, maintenance rotation, heartbeat/health state, per-symbol last event/trade-id watermarks and duplicate/out-of-order protection. Exchange aggTrade IDs can skip due to aggregation/market behavior; gaps require investigation, **not automatic presumption of missing data based solely on id+1**.
3. REST-bootstrap 1m historical bars and reliably REST-backfill missed *closed* bars after disconnect. Distinguish missing trade events from restored bars; mark tick activity **NOT_READY** for a full 60s window after gap. Prevent WS updates racing with bootstrap/rest updates.
4. Bound all symbol buffers in time + count, include backpressure/drop metrics. Monitor only configured symbols; do not claim whole-universe discovery yet.
5. Show status, last exchange timestamp, observed latency, per-symbol readiness/gap flags, reconnect count in UI. Handle inaccessible Binance endpoints gracefully.
6. Browser-native regression tests plus simulated disconnect/reconnect (fake WebSocket/fetch). Avoid brittle live API dependency in unit tests.

## Acceptance
- `make check`, `make test`, `make test-browser` green.
- Run 10-minute live capture without unbounded memory growth and with reconnect checks. Provide measurement and actual timestamped evidence, not made-up stats.
- Disconnect for >=90s: missed closed minute bars backfilled, 60s INPLAY marked NOT_READY until fresh stream recovered; no artificial zero-turnover signal.
- Unit tests: duplicate and out-of-order packets; REST errors; reconnect; 15m boundary; reconnect race; no look-ahead.

## Scope not in Phase 0
No Express Target, calibrated scores, whole-universe discovery, trading automation, persistence beyond what is needed for recovery.
