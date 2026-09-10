# State AI Compliance Cost Model

**All statutory inputs are coded from enacted texts with quoted sources; duty-hour defaults are
estimates, editable on the dashboard, pending citation to published burden figures.**

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
- **Increment, not total.** The hypothetical federal standard is each requirement family's least
  common denominator — the parameters every state sets identically, derived from the coded bills
  and recomputed automatically as bills are added. That shared core is never claimed; only
  divergence beyond it is.
- **Scope carefully.** Bills are sorted by who they bind. Criminal prohibitions and bills binding
  state agencies or schools are excluded from the estimate by default (toggles show what
  indiscriminate counting adds).
- **Reuse from statutes.** Within a family, each additional state costs (1 − reuse) of a fresh
  build. Reuse is derived, not assigned: for each pair of bills in a family, the share of coded
  statutory parameters (age thresholds, notice timing, audit frequency) set to the same value;
  family reuse is the mean over its pairs. A parameter only one state sets counts as divergence.
  Recurring work reuses more weakly — the ops-carryover control (default 50%) sets how much of
  the build reuse applies to it, since filings and audits repeat per state.
- **Range, not point.** 4,000 seeded Monte Carlo draws over duty hours; the conservative end (p10)
  leads. Draws share a per-simulation error factor (default ±50%, adjustable) so estimation error
  stays correlated across bills instead of washing out in the sum.

Every assumption — rates, roles, horizon, scope, baseline, reuse, ops carryover, estimate error —
is exposed as a dashboard control so a skeptic can substitute their own and see what it produces.
(To remove a role entirely, set its rate to zero.)

Statutory exposure — the penalty a bill itself states for non-compliance (amount, unit, enforcer,
cure period) — is coded and displayed as fact alongside each bill, but never folded into the cost
estimate: turning exposure into an expected cost would require enforcement-probability assumptions
of exactly the kind this model exists to avoid. Bills silent on penalties are coded as silent.

## Repository layout

```
index.html           markup for both tabs
styles.css           styling
app.js               explorer (map) + model (Monte Carlo, reuse logic) + rendering — no dependencies, no build step
data/bills-2026.js   passed 2026 state AI bills (as of 7/31/2026) — drives the explorer; no coding yet
data/legiscan.js     generated LegiScan overlay: live status, votes, sponsors, links, substitutions
data/bills.js        placeholder coded subset — drives the cost model until statute coding completes
data/us-map.js       US state shapes (pre-projected Albers, decoded from us-atlas / Census Bureau)
data/source/         the source spreadsheet the explorer dataset was converted from
pipeline/            bill-text fetchers: legiscan.py (LegiScan API, primary) + fetch.py (direct URL fallback)
texts/               the statute text corpus: <slug>.txt per bill, originals in raw/, provenance in manifest/
CLAUDE.md            operating runbook — how to add a bill, fetch its text, and triage failures
```

## Status

**The text corpus is complete: all 89 bills fetched and verified** (~3.9M characters), primarily
via the LegiScan API with per-bill provenance manifests in `texts/manifest/`. 67 bills carry
enacted text (Chaptered/Enrolled/final); 10 have only Introduced versions pending later
legislative action.

**The statute coding is done.** All 89 bills were coded twice independently by LLM against the
fixed protocol in `CODING.md` (families, parameter vocabularies, duty triggers); the two passes
materially agreed on 76 of 89 bills, and the 13 disagreements were adjudicated from the statutory
text. Every parameter and exposure value is anchored to a quoted provision (`sources`); full
records including flags and confidence are in `coding/`. Companion-bill substitutions are counted
once (5 duplicate vehicles excluded); the 2 bills passed by only one chamber are excluded from
the estimate. Reuse and the federal baseline now derive from the coded parameters.

Remaining caveat: the per-duty hour blocks are informed estimates for the average AI model,
adjustable in the model and pending citation to published burden figures (PRA filings, fiscal
notes).

Bill text data via [LegiScan](https://legiscan.com) (CC BY 4.0).

Feedback: open an issue, or comment on anything that looks wrong — framing, layout, scoping
choices, or the model structure itself.
