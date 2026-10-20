# Immutable research datasets

Six supplied futures market ZIP archives are stored as-is under `data/raw/` with SHA-256 checksums (`data/manifest.json`). Charts and old specs included for auditability. Some archives have other OI / ratios / mark/index funding snapshots; inspect file availability per symbol rather than assume identical coverage.

| Symbol | Proposed reference use | Retrospective idea, not a validated signal |
|---|---|---|
| ARIAUSDT | **Fast Lane benchmark** | Oct 18 and Oct 20, 2026 are separate attempts around 0.06098–0.06471; detect passage **to** zone, not eventual breakout |
| DOODUSDT | Express vs Global | ~0.0024 near-term vs ~0.0035 global historical context |
| COMPUSDT | Express vs weekly | ~$29.26 nearby historical zone vs upper weekly levels |
| JCTUSDT | Extreme expansion | Verify early detection, multiple impulses, false alarms |
| METUSDT | Ambiguous / negative candidate | May deliberately skip |
| SUSDT | Ambiguous / negative candidate | May deliberately skip |

Beware: charts from conversation may show data later than archive cutoff. Do **not** use levels selected with future evidence as as-of-time targets. Store annotation provenance (known before, identified afterwards). Need additional failed launches/non-events to estimate signal precision credibly.

Import `futures_klines_1m.csv` via native file selection of **extracted CSV** in Phase 2; native browser cannot unzip ZIP without a ZIP decoder or decompression support suitable for ZIP containers. Keep original ZIP files intact. Do not silently claim sub-minute replay from minute candles.
