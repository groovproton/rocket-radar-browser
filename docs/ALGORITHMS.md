# Signal algorithms — research specification

## INPLAY (independent)
Rolling windows for actual incoming exchange aggTrade events, e.g. 10s/60s/5m; sum `price*quantity`, measure aggregate-event intensity, buy/sell delta using `m` maker-side flag. Binance `aggTrade` combines trades, so events/sec ≠ individual trades/sec: count actual trades via candle `n` where provided. Compare turnover against the symbol's past comparable minutes (`median`/MAD or empirical quantiles). The P0 `RVOL>=5` and `$10k/min` limits are placeholder demo values, **not optimized thresholds**. Baselines must exclude the active incomplete window. Timestamp and stream-gap confidence are mandatory in P1.

## MA50 on 15m (independent)
For fully closed 15m bars: `MA_t = mean(Close_{t-49} .. Close_t)`; detachment `D_t = 100 * (Close_t / MA_t - 1)`; `V_t=D_t-D_{t-1}`, `A_t=V_t-V_{t-1}`. Qualify separately for positive/negative drift. Prefer increasing smoothed |D| across a lookback; don't demand all individual candles be monotonic. Distinguish sideways price as MA catches up vs price retraces toward MA (PRICE_TO_MA vs MA_TO_PRICE). Preserve attention on detached shelves even with INPLAY=OFF.

## Route targets and historical regimes (planned)
For historical coins, enumerate as-of-time zones (daily / weekly swing highs and lows, consolidation boundaries and MA confluence as candidates). Distinguish **Express Target** from **Global Target** using estimated probability `P(hit target before stop within H | signal, features)`, expected travel time and drawdown. Post-target accumulation is a possible outcome, not a guaranteed result. For new coins with insufficient history, output `NO_HISTORICAL_TARGET` and focus on early detection & in-flight momentum.

## Trimming and conditional probability
If hypothesized span [S,T], fractional position `u=(P-S)/(T-S)`; e.g. 100→200 gives 115→185 for fractions 0.15–0.85. This is a **metaphor**, not a Gaussian law of price or 100% hit probability. `P(hit T before stop, before horizon H | signal at P)` can only be estimated from real reference/negative events under walk-forward evaluation. Route efficiency `abs(exit-entry)/sum(abs(price[k]-price[k-1]))` computed **after** a completed path is a label, not an available real-time input. Optimize conditional expected net utility with slippage, fees and adverse excursion; asymmetric trim permitted.

## Metric hierarchy
First: calibrated precision and expected net payoff after costs on genuinely independent tests. Second: expected drawdown, target-first probability, time-to-target, and candidate coverage. Small samples must report confidence intervals. Avoid hindsight/selection bias, survivorship bias, and optimistic fill assumptions.
