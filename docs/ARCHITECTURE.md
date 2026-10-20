# Browser-only architecture

```text
Binance USD-M Futures WebSocket (primary LIVE)   Local ZIP/CSV (REPLAY)
    aggTrade / kline_1m                               historical adapter (P2)
           |                                               |
           +-------------- normalized event contract -----+
                                      |
                             per-symbol bounded buffers
                              /                    \
             INPLAY detector                    MA15 detachment detector
             now / 60s                          15m closed candles / MA50
                              \                    /
                     candidate aggregator (P3)
                                      |
                  historical-level analyzer (P4)
                     Express vs Global vs unknown
                                      |
                 calibrated Fast Lane score (P5/P6)
                                      |
                               read-only HTML UI
```

Rules: no server backend, no third-party runtime requirement, no framework, no application build. Static dev HTTP server only. Actual business logic must stay in ES Modules callable by browser-native test runner. Binance public endpoints use `wss://fstream.binance.com` and `https://fapi.binance.com`; some networks block them. Reconnect/backfill is P0 acceptance, not achieved in scaffold. Avoid excessive subscribe streams due to exchange limits. Backfill 1m candles after gaps; *cannot reconstruct exact missed aggregate-trade ticks from klines*. Mark INPLAY readiness `unknown` until new full rolling window is observed, or complete historical trade replay is available.

## Independent indicator lifecycle

- INPLAY can become quiet immediately when activity dissipates; it does **not** delete a symbol from detachment.
- MA15 Detachment uses MA50 calculated on 50 **closed** 15m bars. Partial 15m values may be previewed but never silently treated as final.
- Detachment has distinct EXPANDING, DETACHED_SHELF, CONTRACTING/COOLING and NORMAL states; current code has coarse states only.
- A rocket candidate is an intersection or separately ranked alert and never itself signals execution.

## History boundary

For a minute at t, use closed history strictly preceding a snapshot to compute baselines. Historical level extraction in replay must run **as-of time t**. Target zone labels from future screenshots cannot be used to construct the candidate level at an earlier time.
