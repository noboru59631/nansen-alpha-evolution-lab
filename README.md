# Nansen Alpha Evolution Lab

> Finding alpha is easy. Knowing whether it is still alpha is the edge.

Nansen Alpha Evolution Lab is a research tool for auditing the lifecycle of an on-chain edge. It is deliberately not an execution bot and does not make a buy/sell recommendation. It asks a narrower question: when a historical signal stops working, does it disappear, invert, or return?

## What works in the MVP

- Solana-first point-in-time analysis through Nansen Smart Money Historical Holdings.
- Walk-forward split: the first 60% is training context and the untouched final 40% is out-of-sample validation.
- No current labels or future prices are used in the historical path.
- `LIVE`, `DECAYING`, `DEAD`, and `UNKNOWN` lifecycle states.
- `NEUTRAL`, `INVERTED`, `REBORN`, or `ABSTAIN` afterlife classification.
- Three intentionally simple independent agents whose agreement/disagreement is shown as a crowding proxy.
- Explicit sample sufficiency gate: fewer than 8 snapshots is `UNKNOWN`; fewer than 12 is `ABSTAIN` for afterlife.
- A transparent 10 bps round-trip fee/slippage hurdle is subtracted before status classification. This is a conservative analysis gate, not a claim about executable fills.
- Keyless startup is visibly `DEMO / NO-LIVE-DATA`; no fake live numbers are shown.

## Run in under 10 minutes

Requirements: Node.js 20+ and a Nansen API key.

```powershell
Copy-Item .env.example .env.local
# edit .env.local and set VITE_NANSEN_API_KEY
npm install
npm run dev
```

Open the local URL printed by Vite. Without a key, the app intentionally stays in demo mode. With a key, `RUN POINT-IN-TIME AUDIT` calls the historical holdings endpoint and switches to live mode only after a successful response.

For a production deployment, put the Nansen request behind a server-side proxy. The current Vite demo keeps the setup minimal; do not commit `.env.local` or expose a production API key in a public browser bundle.

## Architecture

```text
Nansen historical-holdings API
          |
          v
src/nansen.ts  ->  normalized daily snapshots
          |
          v
src/analysis.ts -> cost hurdle -> walk-forward/OOS -> lifecycle + afterlife
          |
          v
src/App.tsx + styles.css -> audit dashboard
```

The app makes one paginated request for the selected date window (`per_page: 100`). The request uses `chains: ["solana"]` by default and includes `Fund` and `Smart Trader` labels. It does not persist or redistribute raw Nansen responses.

## Official API findings

The implementation is based on the official Nansen docs:

- [`smart-money/historical-holdings`](https://docs.nansen.ai/api/smart-money/historical-holdings): daily snapshots, point-in-time price/market-cap fields, up to four years of lookback, and Solana support.
- [`Data Methodology`](https://docs.nansen.ai/guides/data-methodology-and-technical-reference): daily snapshots are end-of-day UTC; historical USD values use the requested day's price; the current incomplete day is excluded.
- [`Endpoints Overview`](https://docs.nansen.ai/api/overview): Smart Money endpoints are 5 credits per call; profiler and TGM endpoints provide lower-cost auxiliary paths.
- [`Credits & Pricing`](https://docs.nansen.ai/getting-started/credits): free users receive 100 one-time credits and Smart Money calls are listed at 50 credits on free tier / 5 on Pro.

The current endpoint documentation exposes daily historical holdings rather than an arbitrary intraday point-in-time replay. The lab therefore labels its source honestly as daily EOD snapshots and does not claim tick-level backtesting. Smart Money Netflow and Token Screener are intentionally not required by the MVP; they can be added as independently logged features after verifying their current schemas and costs.

## Methodology and limitations

The score is an explainable cohort signal, not a trained ML model. The app requests data on demand and computes medians and thresholds locally; it does not train, update, or improve a model using Nansen data. The cost hurdle is a fixed 10 bps round trip for comparability, not a personalized execution estimate. Historical holdings are a proxy for flow/positioning, not a tradable price series. A real submission should record the exact date window, response metadata, endpoint, credit usage, and API version used in the demo.

`FOLLOW`, `WAIT`, `ABSTAIN`, and `FADE` are historical state classifications only. They are not investment advice, trade instructions, or an execution interface.

## Buildathon requirements

- Data Integration 25%: Nansen historical holdings drive the lifecycle calculation.
- Functionality 25%: one-click audit, OOS gate, lifecycle and afterlife views, crowding proxy.
- Creativity 25%: audits whether alpha survives consensus rather than producing another trading bot.
- Documentation 25%: this README includes setup, architecture, methodology, limitations, and silent demo flow.
- The latest official FAQ says to log `100+ API calls` during Sep 14–27 and submit by Sep 27, 2026 23:59 UTC. The campaign landing page still shows an older `1,000 API calls` line. This README follows the latest FAQ and records the discrepancy explicitly; verify the final submission form at the time of submission.
- Public GitHub repository is required. Do not commit API keys, raw Nansen data, or private account exports.

### Verifying 100+ calls

Use the Nansen API usage page (`https://app.nansen.ai/api?tab=usage-analytics`) before and after your build session. The app's default request is intentionally small enough for a live demo; for the buildathon quota, make repeat calls only with your own account, record the usage before/after, and retain a screenshot or exported usage proof for submission. Never fabricate the count.

## Silent 30–60 second demo

1. Start the app with a real key and show the green `LIVE DATA` badge.
2. Select Solana and click `RUN POINT-IN-TIME AUDIT`.
3. Hold on the lifecycle chart as the OOS boundary and cost gate are visible.
4. Show `ALPHA STATUS`, `ALPHA HALF-LIFE`, `CROWDING PROXY`, and `DISAGREEMENT` together.
5. Show the afterlife state and the three agent rows, ending on the audit trace.

The screen should make sense with sound off and should not expose the API key.

## Checks

```powershell
npm run typecheck
npm test
npm run build
```

Powered by Nansen. Not an official Nansen product.
