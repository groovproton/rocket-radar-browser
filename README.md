# Rocket Radar — BTRUSDT research V1/V2

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

## V2 — candidate confirmation (experimental)

V1 `detect()` remains unchanged: same 14 BTR candidate timestamps. V2 runs in `src/confirmation.js`, using the **same shared code** in browser and CLI. It evaluates each candidate at its own minute-close, without looking into future candles:

- Close above the previous **60m high** (+1 score)
- Close above the previous **240m high** (+2)
- Mean volume during **last 5m / preceding 55m**: ≥1.7× (+1), ≥3× (+2); the current minute is included only at minute close
- Three consecutive rising closes (+1)
- Recent 3m distance acceleration exceeds 30% of the prior 10m change (+1)

The heuristic scores 0–7; `ROCKET START` requires score ≥4. Otherwise it is `CANDIDATE`; incomplete prior history is `INSUFFICIENT_DATA`. Thresholds are provisional **not optimized** to BTR. A signal cannot be confirmed earlier than the minute-close when its features exist. Trade/order-flow indicators, precise liquidity targets and senior timeframe analysis beyond rolling 1m breakout highs are not yet implemented.

`make test` runs V1 regression (14 reference events, BTR October 22 17:16 UTC) and V2 prefix-causality assertions. Console output prints V1 outcomes and V2 evidence on each candidate. `make report` includes machine-readable `v2.results`, including outcome labels used **solely after the signal** for post-hoc evaluation. The browser shows the same diagnostics in the table.

**Acceptance is not yet established:** we must run `make test` on the checked-in archive and see how many V2 confirmations remain, particularly BTR 17:16. We should not tune the threshold to obtain a desired outcome on a single coin; validation on untouched other datasets will follow.

## Two-stage lifecycle (current experiment)

1. `CANDIDATE` is emitted by the unchanged V1 detector at its original minute-close timestamp and price.
2. A **pending** candidate is assessed on following completed 1m candles; `CONFIRMED` is a distinct event with its own price, UTC timestamp, score and delay. It may occur 1–10 minutes after the candidate. Confirmation on the identical minute is intentionally prohibited.
3. If no confirmation appears in 10 minutes the candidate status becomes `EXPIRED`. This does not remove the original candidate from history. A new candidate supersedes a still-pending older one.

The shared state machine is `src/stages.js`, imported by browser and CLI. `make test` verifies stage order, maximum confirmation delay and event-history causality. `make report` includes `stages.episodes` and `stages.events`. The browser shows separate candidate and confirmation timestamps/prices.

**No V1 changes.** The earlier V2-at-candidate diagnostics remain available for historical comparison. Current confirm policy is experimental and may still accept weak impulses. We have not yet measured the detection-quality impact of delayed entry.

## Replay browser notifications

When clicking **Replay**, crossing a new event minute shows an in-page popup and a clickable entry in the notification journal. Supported historical events: `CANDIDATE`, `CONFIRMED`, and `EXPIRED` after the confirmation window elapses. Historical timestamps (UTC) and price are displayed, and clicking a notification jumps to its corresponding historical candle.

Use the **Включить системные уведомления** button to request browser/OS notification permission; alerts are only shown if explicitly granted. In-page popups work without notification permission. `alerts-enabled` allows silencing alerts, while **Очистить журнал** clears the current UI entries. No alerts are fired when loading archives, scrubbing the range slider, resetting or clicking historical events; only forward replay emits notifications. Advancing multiple historical minutes per timer tick still emits each crossed stage event.

`make test` checks the replay event boundary contract. Native notification delivery depends on local browser and OS permissions and cannot be verified by the CLI regression.

## Replay UI cleanup

- Notification controls stay compact; the clickable journal starts collapsed.
- `CANDIDATE` shows an amber toast for 5 seconds; `CONFIRMED` shows a green toast for 8 seconds; `EXPIRED` is journal-only.
- All three event types remain in the journal. The checkbox silences popups without disabling event logging; manual seeking never creates notifications.
- Price canvas scales only finite values, shows a fallback on missing data, and draws amber CANDIDATE / green CONFIRMED markers within the visible replay window.
- V1 and V2 detection rules and scores are unchanged.

The browser rendering and OS notification permissions still require manual verification in a real browser. `make test` remains the deterministic CLI test for the signal and stage pipeline.
