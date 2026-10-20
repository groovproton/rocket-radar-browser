# PHASE 2 — MA15 Detachment + historical replay

Implement a fully independent 15m MA50 classifier on completed 15m bars and optional separately labeled provisional live view. Persistent phases: NORMAL, EXPANDING, DETACHED_SHELF, CONTRACTING_PRICE, CONTRACTING_MA. Keep symbols with structural detachment even after INPLAY fades. Use MA50 warm-up >=50 closed 15m bars (prefer >=51 for velocity). Calculate D/V/A, smooth trends and guard noisy candles; timestamps must align exchange UTC boundaries.

Add historical `File`-selected extracted CSV importer: all research ZIPs contain `futures_klines_1m.csv`. Either bundle audited ZIP decoder in `vendor/` with a documented reason or accept extracted CSV for MVP, preserve original ZIPs unchanged. Replay feeds the **same indicator modules** using only observations known at replay time. CSV replay cannot pretend to reconstruct tick-level sub-minute observations. Add tests for no-lookahead, normalization during a shelf, and incomplete 15m periods.
