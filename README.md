# State AI Compliance Cost Model

**Draft for feedback — all inputs are placeholders pending statute coding.**

A bottom-up estimate of what state-by-state AI regulation costs a firm *above* a single
hypothetical federal standard. Live dashboard: https://elliotjames-paschal.github.io/state-ai-compliance-cost/

Two views:

1. **State Law Explorer** — an interactive US map of the working dataset. Click a state for its
   bills; filter by who each bill binds (companies, criminal prohibitions, state agencies, schools).
   The exploratory starting point: see the laws before arguing about the cost.
2. **Cost Model** — the bottom-up estimate with every assumption exposed as a control.

## How the model works

- **Bottom-up.** Each bill is decomposed into duties — legal review, engineering build, ongoing
  operations — with triangular hour estimates. Cost is hours × rates, the same approach federal
  agencies use for regulatory burden estimates.
- **Increment, not total.** The first build in each requirement family stands in for what a single
  federal standard would require; only per-state divergence beyond it is claimed.
- **Scope carefully.** Bills are sorted by who they bind. Criminal prohibitions and bills binding
  state agencies or schools are excluded from the estimate by default (toggles show what
  indiscriminate counting adds).
- **Reuse from statutes.** Within a family, each additional state costs (1 − reuse) of a fresh
  build. Reuse will be derived by comparing coded statutory parameters across states (age
  thresholds, notice timing, appeal deadlines, audit frequency) — not assigned.
- **Range, not point.** 4,000 seeded Monte Carlo draws over duty hours; the conservative end (p10)
  leads.

Every assumption — rates, roles, horizon, scope, baseline, reuse — is exposed as a dashboard
control so a skeptic can substitute their own and see what it produces.

## Repository layout

```
index.html           markup for both tabs
styles.css           styling
app.js               explorer (map) + model (Monte Carlo, reuse logic) + rendering — no dependencies, no build step
data/bills-2026.js   passed 2026 state AI bills (as of 7/31/2026) — drives the explorer; no coding yet
data/bills.js        placeholder coded subset — drives the cost model until statute coding completes
data/us-map.js       US state shapes (pre-projected Albers, decoded from us-atlas / Census Bureau)
data/source/         the source spreadsheet the explorer dataset was converted from
```

## Status

The statute coding pass is in progress. Duty hours, reuse values, and bill selection in
`data/bills.js` are illustrative placeholders. The final version will ship the coded dataset with
every extracted parameter anchored to the quoted statutory provision, double-coded, and
hand-validated on a sample.

Feedback: open an issue, or comment on anything that looks wrong — framing, layout, scoping
choices, or the model structure itself.
