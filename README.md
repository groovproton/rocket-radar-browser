# Rocket Radar — Browser Only 🚀

**Research-first**, selective Binance Futures market radar. No Node.js, Go, backend, npm, package.json, bundler or build step. Vanilla JavaScript ES Modules + native browser WebSocket/Fetch. Python 3 standard library is used **only to serve static files and run developer commands**, never for application data processing.

## Quick start

```sh
make help
make doctor
make check
make test
make test-browser      # optional automated Chromium; or open tests.html
make start             # http://127.0.0.1:8765/
make status
make stop
```

Foreground alternative: `make serve` (Ctrl-C). Change port: `make start PORT=8899` / `make status PORT=8899`. Run `make verify-data` to verify SHA-256 integrity. `make package` builds a ZIP next to the project directory.

### Current implementation status

**Working scaffold (P0 prototype, not P0 accepted):** Binance combined WebSocket for selected symbols (`aggTrade`, `kline_1m`), REST bootstrap, 1m→15m MA50 detachment, independent rolling 60s INPLAY heuristic, simple monitoring UI, browser tests. LIVE is limited to symbols explicitly entered (max 12). Unavailable exchange APIs or regional restrictions are reported, not concealed.

**Not implemented / not production-ready:** complete recovery/backfill on reconnect, persistent IndexedDB, symbol universe discovery, robust timestamp ordering under dropped packets, real trade-count (aggTrade is *aggregate* events), depth/OI streams, calibrated confidence/precision, automated level targets, ZIP historical tick replay. See `tasks/` for gated implementation. In particular, neither current indicator is a trade signal and no probability of success has been established.

## Core research principles

- **Precision > Recall**: skipping ambiguous pumps (MET/S) is acceptable; false positives are costly.
- **INPLAY ≠ MA15 Detachment**: independent scanners. Strong MA50/15m structural detachment is tracked even if volume cools and INPLAY switches off (shelf).
- Only when *both* fire, promote to **priority for human investigation**, not an automatic trade.
- With historical structure, identify **Express Target** (fast lane) and distinct **Global Targets**. New coins without such history get **No Historical Target**, not an invented price.
- Route trim: trade the empirically more predictable middle of a candidate route, not the first uncertain 15% and last uncertain 15% by decree. Optimize asymmetrically against stop-first probability, time, MFE/MAE, costs, and out-of-sample evidence.
- All case-study outcome labels are retrospective; do not leak future levels into backtests.

## Files

- `docs/` formal spec, statistical model, data contracts, case study and original PDFs.
- `tasks/` Codex tasks PHASE_0 through PHASE_6 with acceptance checks.
- `data/raw/` six immutable original ZIP research archives; `data/charts/` supplied visual references.
- `js/` browser-only modules. `tests.html` executes ES module tests in browser.
- `scripts/` Python dev helpers only (static server, checking, packaging).

## Research data limits

The provided historical ZIPs have 1m OHLCV, volume, trade counts and taker volume. They **do not contain historical tick-level aggTrade records**, so minute-based replay cannot validate sub-minute launch lead time. Collect/live-record ticks separately for that. Cases have selection bias: add both positive and negative cohorts before estimating precision.

**Security:** no secrets or trading API keys. Public market data only; read-only, no order placement.
