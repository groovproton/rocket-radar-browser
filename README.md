# Rocket Radar — BTRUSDT research V1

One coin, one deterministic detection engine, two execution modes.

## Commands

- `make run` — browser at http://127.0.0.1:8000/
- `make test` — CLI regression on the checked-in BTR dataset (nonzero exit on failure)
- `make report` — JSON events report
- `make start`, `make stop`, `make status`, `make logs` — server management

Browser uses Vanilla JS only. **CLI uses Node.js built-ins only** (no npm/install/build tools); this is a test runner, not a market backend. Python 3 is used only to serve static files for the browser.

## Single-source algorithm

`src/signal.js` exports `detect(bars)` and `summarize(bars, signals)` for BOTH browser and CLI. Same 1m OHLCV input, same closed-candle MA50 on 15m, same provisional ignition thresholds. No Binance.

Data: `data/BTRUSDT/market.zip`; inside, `futures_klines_1m.csv`. The CLI specifically reads this path inside the ZIP. The browser selects the 1m OHLCV candidate. Both use the original archived dataset.

### Automatic checks

`make test` asserts 1) enough data and equal input/output lengths; 2) no signals before MA is available; 3) prefix replay decisions are identical to complete replay (no future leakage); 4) changing the current incomplete 15m candle cannot alter the completed-candle MA.

These are **correctness/regression checks**, not proof the trading hypothesis works. The CLI reports every ignition timestamp/price without using future candles. We still need to evaluate whether BTR's first ignition precedes the real rapid move and count false alerts.

## Current restrictions

Only BTRUSDT. No live data, BTC, order flow, UI cross-coin ranking, price targets, or claim of predictive quality. The score is an uncalibrated heuristic. The strict multi-MA WAIT trading filter is not implemented; no result is a trade recommendation.

## Development note

Browser and CLI parsers are distinct because of the platform ZIP APIs. The actual signal algorithm is **one module**. The CLI uses Node built-in `zlib`, the browser uses `DecompressionStream`.

## Forward evaluation (BTR only)

`src/evaluation.js` computes post-ignition maximum high, minimum low, and minutes to peak for **15 / 30 / 60 minutes**, plus hit flags for +5%, +10%, +20%. The entry is the signal minute **close**; the entry candle's high/low is excluded because it may precede the alert. Only future 1m candles are evaluated. Missing/incomplete horizons return `N/A`, not zero. Metrics are a look-ahead **evaluation** and must never enter `detect()`.

`make test` prints the table and checks the evaluation output. `make report` includes structured `evaluation.events` and `evaluation.aggregate` JSON. The browser displays the same data with clickable signal times and the original `data/BTRUSDT/chart.png` multi-timeframe reference.

**Note:** A hit is a possible excursion of price, not an executable profit; it ignores spread, slippage, fees, order fills and ordering of high/low within candles. Accuracy against the annotated chart still needs human review.
