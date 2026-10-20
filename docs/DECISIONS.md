# Architecture decisions (accepted)

1. **ONLY browser-native implementation is in scope**. No Go/Node or forward compatibility work (2026-10-20).
2. Binance Futures WebSocket primary live feed; REST bootstrap/gap-repair; archives for research replay.
3. INPLAY and MA50/15m Detachment are independent outputs. Shelf remains relevant when INPLAY is quiet.
4. Both indicators active means PRIORITY CANDIDATE, not auto-trade.
5. Express Target ≠ Global Target. If history missing, no imaginary global target.
6. Precision > Recall. Alerts optional; `NO_TRADE` is valid.
7. Backtests as-of time; retain immutable raw research datasets and reproducible checksums.
8. Trim predicted route edges using conditional empirical evidence, not literal Gaussian returns.
9. No key management, trading integration, storage backend, web framework, bundlers or npm.
