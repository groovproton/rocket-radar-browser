# Rocket Radar — offline prototype V1

Purpose: find the **beginning of rapid price detachment from MA50 on 15m**. No Binance connection, accounts, Node, Go or build system.

## Run

From the repository root run `make run` (foreground, Ctrl+C to stop), then open `http://127.0.0.1:8000/` in Chromium. Or use `make start` for background mode, `make status`, `make logs` and `make stop`. Run `make help` for all commands. Override port with `make run PORT=8080`. The HTTP server only serves local static files. No remote market API calls.

Select a coin, click **Загрузить ZIP**, then **Replay**. Pause, adjust speed or scrub through historical time. The yellow dots and event log mark the *first* IGNITION decision in each detected episode.

## Data

Existing datasets are read without modification: \`data/SYMBOL/market.zip\` and \`data/SYMBOL/chart.png\`. Reader scans ZIP entries for 1m OHLCV CSV or JSON, supports Binance kline columns and common named columns, and automatically selects the smallest candle interval. On an unsupported archive the UI explicitly shows an error rather than inventing data. Requires a recent Chromium with \`DecompressionStream("deflate-raw")\`.

> Chart PNG is for **post-hoc visual comparison only**; it does not enter detection.

## V1 algorithm (experimental; thresholds are NOT optimized)

1. Aggregate 1m into 15m, using **only completely closed 15m candles**.
2. Compute SMA(50) of those 15m closes.
3. Track \`D = 100 * (price / SMA50_15m - 1)\`, and \`V = D(now) - D(3 minutes earlier)\`.
4. Arm when price has been within ±1% of MA. Trigger IGNITION when \`D > 1.4%\`, \`V > 0.6 percentage points / 3m\`, and \`3m return > 0.8%\`.
5. Volume ratio contributes to the diagnostic score but does not gate early detection.
6. Track ACCELERATION / FLIGHT / SHELF / LATE; rearm after price returns close to MA.
7. Show events only **up to replay cursor**; no future bars or future highs are used.

The score is a relative diagnostic heuristic, **not a probability** or trade instruction. The strict WAIT filter between junior/senior MAs requires additional timeframe signals and is **not claimed to be implemented in V1**.

## Acceptance and limitations

V1 is a detector workbench, not a validated trading system. Inspect BTR, AIN, ARIA, BTW and other provided cases; compare earliest signal time/price with the start of the actual move, count false positives, and tune *only after* inspecting both successful and negative examples.

Limitations: this prototype has no BTC factor, 1h/4h/1D targets, order flow, OI, backtest scoring, strict MA trade filter or Binance integration. It assumes chronological 1m OHLCV. Some archives might have a different internal schema; if a ZIP cannot be decoded, inspect its filenames and adapt the reader rather than silently substituting fabricated data.
