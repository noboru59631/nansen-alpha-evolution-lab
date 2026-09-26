# Nansen Alpha Evolution Lab

> **Finding alpha is easy. Knowing whether it is still alpha is the edge.**

Nansen answers **“Who is moving?”** Alpha Evolution Lab adds a complementary research layer: **“Is that historical signal still alive?”** It audits a Smart Money signal through `DISCOVERED → LIVE → DECAYING → DEAD → NEUTRAL / INVERTED / REBORN`, without claiming to predict prices or execute trades.

The central research question is: **When alpha dies, does it disappear, invert, or return?**

[Nansen](https://www.nansen.ai/) powers the point-in-time data. Alpha Evolution Lab is an independent Buildathon project, not an official or endorsed Nansen product.

## Why this is different

Most trading dashboards ask whether a signal is bullish. This project asks whether the signal itself has survived out-of-sample testing after costs, and whether model consensus may be evidence of crowding rather than confidence.

`FOLLOW`, `WAIT`, `ABSTAIN`, and `FADE` are historical state classifications. They are not investment advice, recommendations, or execution instructions.

## Live result — September 26, 2026 UTC

The reproducible cross-token run in [`research/latest-findings.json`](research/latest-findings.json) fixed the candidate universe at the beginning of the window to avoid selecting only tokens that survived until the end.

- Chain: Solana
- Settled point-in-time window: 2026-06-24 through 2026-09-23
- Universe: top 12 eligible Smart Money holdings at the window start
- Observations: up to 90 consecutive signal→next-day pairs per token
- Result: `UNKNOWN` 12, `LIVE` 0, `DECAYING` 0, `DEAD` 0
- Afterlife: `ABSTAIN` 12, `NEUTRAL` 0, `INVERTED` 0, `REBORN` 0
- No statistically confirmed inversion was found.

This result is intentionally not polished into a win-rate claim. Under the fixed rules below, the tested Smart Money balance-direction signal did not establish enough evidence to label an edge alive or dead. Therefore the system abstained.

> **No evidence of alpha death is not evidence of a contrarian edge.**

An exploratory current-universe screen found a `DECAYING` example, but it was excluded from the headline research finding because selecting at the end of the window introduces survivorship bias.

## What the dashboard shows

- A single visual Alpha Lifecycle with the measured current state highlighted.
- Alpha Half-Life: first OOS rolling window where expectancy falls below half of training expectancy.
- OOS expectancy and its 95% confidence interval.
- Cost-adjusted expectancy using a disclosed 10 bps hurdle.
- Sample size and token age.
- Four deterministic agents: flow momentum, price trend, holder breadth, and concentration.
- Agreement/disagreement and a crowding proxy based on consensus plus the token’s historical Smart Money concentration percentile.
- A Hero Moment connecting Smart Money direction, consensus, crowding, lifecycle, afterlife, and meta state.
- A trace from Nansen endpoint → field → formula → displayed value.

No fixture, mock, demo number, or synthetic chart is rendered in LIVE mode. Without a key or before a successful request, all measured fields remain `—`.

## Methodology

### Point-in-time data

The app uses [`POST /api/v1/smart-money/historical-holdings`](https://docs.nansen.ai/api/smart-money/historical-holdings). Nansen documents daily snapshots, point-in-time market cap, token-address filters, and a rolling historical window. The app excludes the current day and uses `T−3` as its latest date to avoid partial or unsettled snapshots.

The official [Data Methodology](https://docs.nansen.ai/guides/data-methodology-and-technical-reference) explains snapshot timing and historical pricing. The newer [Historical Smart Money Positions](https://docs.nansen.ai/api/backtesting-data/historical-smart-money-positions) endpoint confirms the point-in-time `as_of_date` model; the MVP uses historical holdings because its token-address filter efficiently reconstructs one token’s daily series.

### Pre-registered calculation

For each token and each pair of consecutive UTC days:

```text
signal(t)       = sign(balance_24h_percent_change(t))
forward_return  = market_cap_usd(t+1) / market_cap_usd(t) - 1
gross_edge      = signal(t) × forward_return
net_edge        = gross_edge - 0.001
```

The first 60% of valid chronological pairs is training context. The final 40% is untouched OOS validation. Missing calendar days are never bridged. A minimum of 20 valid pairs is required.

Lifecycle rules are fixed in code, not tuned to improve the result:

- `UNKNOWN`: insufficient samples, no positive training edge, or an OOS confidence interval crossing zero after negative expectancy.
- `LIVE`: the 95% OOS interval is positive and at least 50% of training expectancy remains.
- `DECAYING`: OOS expectancy remains positive but is weaker or statistically uncertain.
- `DEAD`: the full 95% OOS interval is below zero after costs.

Afterlife is only evaluated after confirmed `DEAD` and at least eight post-death observations:

- `INVERTED`: the 95% interval of the reversed signal is positive after costs.
- `REBORN`: the latest five-observation original-signal interval is positive.
- `NEUTRAL`: neither inversion nor rebirth is supported.
- `ABSTAIN`: death is unconfirmed or the post-death sample is insufficient.

## Quant audit

| Risk | Treatment | Remaining limitation |
| --- | --- | --- |
| Look-ahead bias | Signal at day `t`; return strictly from `t` to `t+1` | Daily EOD timing is assumed executable only after snapshot availability |
| Survivorship bias | Candidate universe fixed at window start | Tokens absent from that snapshot are outside the study |
| Data leakage | Chronological 60/40 split; OOS never used to fit rules | Thresholds are methodological choices, not universal constants |
| Future-price contamination | Only next-day historical market cap is paired after the signal | Market cap is a price proxy and can change with supply |
| Fees/slippage | Fixed 10 bps deducted from every observed signal | Not a token-specific executable fill estimate |
| Sample insufficiency | Minimum sample gates and confidence intervals | Short-lived tokens frequently become `UNKNOWN`/`ABSTAIN` |
| Multiple testing | Headline result reports the full fixed universe | A larger study should correct for repeated hypotheses |
| Label revisions | Point-in-time values are requested from Nansen | Nansen notes beta data may change after corrections |

The project performs deterministic statistical analysis on API responses. It does not train, update, or improve an ML/AI model using Nansen data. Raw Nansen responses are not persisted or redistributed.

## Architecture

```text
Browser dashboard
      │ local /api/nansen proxy — API key never enters the client bundle
      ▼
Nansen historical-holdings
      │ settled discovery snapshot fixes the token universe
      │ token_address filter reconstructs one daily series
      ▼
Deterministic audit engine
      │ signal→next-day pairs → 60/40 split → costs → confidence intervals
      ▼
Lifecycle + afterlife + agents + methodology trace
```

- [`src/analysis.ts`](src/analysis.ts): pure deterministic audit logic.
- [`src/nansen.ts`](src/nansen.ts): browser calls to the local proxy.
- [`vite.config.ts`](vite.config.ts): development/preview proxy that injects the API key server-side.
- [`scripts/live-research.ts`](scripts/live-research.ts): reproducible multi-token research run; saves aggregate findings only.

## Run in under 10 minutes

Requirements: Node.js 24+ and a Nansen API key.

```powershell
Copy-Item .env.example .env.local
# Set NANSEN_API_KEY in .env.local
npm install
npm run dev
```

Open the printed local URL and click **RUN LIVE AUDIT**. The first call fixes the token universe at the window start. The second retrieves the selected token’s daily history. Choose another token and rerun to compare it using the same rules.

For a production-like local check:

```powershell
npm run build
npx vite preview
```

The key remains server-side in both development and preview. `.env.local` is ignored by Git.

## Reproduce the cross-token study

```powershell
npm run research:live -- --limit=12
```

This makes one discovery call plus one token-history call per candidate. It overwrites `research/latest-findings.json` with aggregate results only. Each request is substantive research use; the script is not an API-call counter.

## Verification

```powershell
npm run typecheck
npm test
npm run build
```

Current status: typecheck PASS, 4 tests PASS, production build PASS. The tests cover next-day pairing, missing-day rejection, insufficient-sample abstention, and persistent positive-edge classification.

## Buildathon requirements and API-call discrepancy

The latest official [Meridian Buildathon FAQ](https://release.nansen.ai/help/articles/3540155-nansen-meridian-buildathon-sep-14-27) requires **100+ API calls** between Sep 14–27. The campaign landing page still contains an older **1,000 calls** line. This project follows the latest FAQ while explicitly recording the discrepancy.

The latest research run used 13 calls and reported 57 credits remaining; two subsequent end-to-end UI validations reported 55 remaining. This is not claimed as proof of the 100-call requirement. Verify the authoritative total in [Nansen API Usage Analytics](https://app.nansen.ai/api?tab=usage-analytics). Do not generate meaningless calls merely to increase the count; expand the fixed-universe research across more tokens or windows after obtaining sufficient campaign credits.

The repository must remain public. Never commit `.env.local`, API keys, or raw API exports.

## Limitations and future work

- A single aggregate Smart Money cohort can hide wallet-level heterogeneity.
- Holder count and concentration are proxies, not direct wallet synchronization.
- “Trader intuition” could later be represented as latent state: early-wallet selling, late-wallet acceleration, price/flow divergence, liquidity deterioration, wallet synchronization, and holder concentration.
- A larger preregistered study should compare chains, sectors, windows, and signal definitions with multiple-testing correction.
- Flow Intelligence, DEX Trades, and historical wallet-level endpoints could strengthen causal interpretation without turning the project into a trading bot.

## Demo and submission

See [`SUBMISSION.md`](SUBMISSION.md) for the silent 30–60 second recording sequence, English X post, form description, GitHub description, and final checklist.

Powered by Nansen. Independent research project. Not an official Nansen product.
