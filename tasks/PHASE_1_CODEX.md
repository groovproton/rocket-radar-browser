# PHASE 1 — independent INPLAY scanner

Use real WebSocket stream from P0 and bounded sliding windows 10s/60s/5m. Quote notional, signed taker volume, aggregate-event rate, volatility, change in intensity. Normalize by past same-symbol distribution excluding current partial window. Support warm-up, unknown data, stale-data, no artificial zeros on disconnect. Historical 1m trade count is available for broader trend, but aggTrade event-count is not individual trade count. Persist minimal state if useful via IndexedDB (browser-only). Deliver independently usable INPLAY table even when MA15 is not ready. Thresholds are configurable prototypes: do not claim 80–90% proven precision. Add browser tests and explain observable signal definitions.

Acceptance: synthetic early ignition case triggers; inactive, single-print, missing baseline, disconnect and burst overload cases do not falsely qualify; deterministic fixtures; `make test-browser` green.
