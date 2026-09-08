# State AI Compliance Cost Model — operating guide

A dashboard (live at https://elliotjames-paschal.github.io/state-ai-compliance-cost/) estimating
what state-by-state AI regulation costs a firm above a single federal standard, plus a bill-text
pipeline that feeds the statute-coding work. Read README.md for the model's methodology; this file
is the runbook for operating the repo.

No build step, no dependencies beyond Python 3 stdlib + `pypdf`. The dashboard is static files
(`index.html`, `app.js`, `styles.css`, `data/*.js`) served by GitHub Pages from `main`.

## Data layers

1. `data/bills-2026.js` — the working dataset of passed state AI bills (hand-curated origin;
   converted from an a16z spreadsheet). Drives the State Law Explorer map. **This is the entry
   point for new bills.**
2. `texts/` — the fetched statute text corpus. One `<slug>.txt` per bill (plain text), the
   original document in `texts/raw/`, and a provenance manifest in `texts/manifest/<slug>.json`.
   Slug rule: lowercase, hyphens at letter/digit boundaries (`CO HB26-1139` → `co-hb-26-1139`).
3. `data/bills.js` — the coded cost-model dataset. **Still placeholder values.** The
   statute-coding pass reads texts from layer 2 and produces, per bill: `category` (who it
   binds), `family`, `appliesTo` (display), `duties` (triangular hours for legal/eng/ops),
   `params` (coded comparable values — numbers and short enums only), and `sources` (the quoted
   provision behind each param, same keys). Family `reuse` and the federal baseline are NOT
   coded — app.js derives both from the params (reuse = mean pairwise param agreement; federal
   LCD = share of params every state in the family sets identically), so param vocabulary
   consistency within a family is what makes the derivation meaningful. Full schema in the file
   header.

The manifest is the source of truth for text provenance. Statuses: `ok` (verified), `needs-review`
(fetched but failed a check — read the `notes`), `missing` (couldn't fetch). Every bill used in
coding must be `ok`; if a check fails for a legitimate reason (e.g. a genuinely tiny bill), verify
by reading the text, then set status `ok` with a note saying what you verified.

## Fetching bill texts

Requires `LEGISCAN_API_KEY` in the environment. Free key: register at https://legiscan.com/legiscan
(Public tier, 30,000 queries/month — a full 89-bill sweep uses ~400, and API responses are cached
in `texts/tmp/legiscan/` so reruns are nearly free).

```
python3 pipeline/legiscan.py                  # everything in data/bills-2026.js; skips status=ok
python3 pipeline/legiscan.py "VA HB 1186"     # one bill        (also: one state, e.g. VA)
python3 pipeline/legiscan.py --list "VA HB 1186"   # show available text versions, fetch nothing
python3 pipeline/legiscan.py --force ...      # refetch even if already ok
```

The script resolves state → session → bill via LegiScan, prefers Chaptered > Enrolled > newest
version, and automatically falls back to the next version when a document extracts to nothing
(image-scan PDFs, empty stubs). Verification: minimum length + bill number must appear in the text.

Fallback for bills LegiScan doesn't have cleanly — fetch from a state site or a saved file:

```
python3 pipeline/fetch.py <slug> <url> --id "HI HB 2137" --state HI --version "CD1 (final)" \
    --keyword "artificial intelligence" [--from-file <path>]
```

## Runbook: a new bill is introduced or enacted

1. **Add it to `data/bills-2026.js`** (or update its record if it's already there — e.g. status
   `Passed Senate` → `Enacted`). Copy an existing record; fields are self-explanatory. Bump the
   `asOf` date.
2. **Fetch the text**: `python3 pipeline/legiscan.py "XX HB 123"`. If the bill was fetched earlier
   at the Introduced stage and has since been enacted, delete its cached
   `texts/tmp/legiscan/bill-*.json` first (the cache never expires) and add `--force` to upgrade
   to the Chaptered/Enrolled text.
3. **Regenerate the explorer overlay**: `python3 pipeline/enrich.py` rebuilds `data/legiscan.js`
   (live status, floor votes, sponsors, official links, substitution relations) from the getBill
   cache. LegiScan's numeric `status` (4 = Passed) is the source of truth for enactment, and its
   `sasts` field catches NY-style companion substitutions — a bill "replaced by" another is the
   same law under a different number; never count both in the cost model.
4. **Refresh the existing bills too.** The dataset and texts go stale between updates (bills get
   enacted after the spreadsheet snapshot, introduced texts get superseded by enrolled ones). While
   you're in here:
   - Clear the bill cache so LegiScan answers fresh: `rm texts/tmp/legiscan/bill-*.json`, then
     `python3 pipeline/legiscan.py --list <bill>` per bill (or loop all) to repull records —
     ~90 getBill calls, trivial against the 30k/month quota.
   - Compare each bill's LegiScan `status` (4 = Passed) against the dataset's `enacted` flag and
     the stored text version. For any bill that advanced, or whose record now lists a text
     version newer than the `doc_id` in its manifest notes, refetch with `--force`.
   - Check `sasts` on anything new — a "replaced by" relation means the law lives under a
     different bill number (fetch that vehicle, and never count both in the cost model).
5. **Triage** anything that isn't `OK` using the failure playbook below.
6. **Code the statute** into `data/bills.js`: who it binds (`category`), which requirement family,
   duty-hour estimates, the statutory parameters that drive reuse, and the statutory `exposure`
   (penaltyMax / penaltyUnit / enforcer / cureDays). Anchor every extracted value — params and
   exposure alike — to the quoted provision in `sources`. Exposure rules, in order of
   defensibility: code only what this bill's text states; if it cross-references another act for
   enforcement, code `enforcer` with that quote and no penaltyMax; if it's silent, omit the block
   (silence is silence, not zero). Exposure is reported as fact and never enters the cost
   estimate or the reuse/baseline derivation. Until the coding methodology is finalized, mirror
   how existing entries are structured.
7. Commit. GitHub Pages redeploys `main` automatically.

## Failure playbook (all of these have happened)

- **"not in LegiScan master list"** — number-format drift. The matcher already handles zero
  padding ("SB 5"/"SB00005"), dropped B's ("HB 301"/"H301"), and Colorado session prefixes. Maine
  is special: bills file as HP/SP papers but LegiScan indexes LD numbers — add to
  `NUMBER_OVERRIDES` in `pipeline/legiscan.py` (find the LD on legislature.maine.gov's bill page).
- **Text extracts to ~0 chars** — the version fallback usually handles it. Known causes: Colorado
  chaptered PDFs are image-only scans (Enrolled is digital); some LegiScan HTML docs are empty
  Word-styling stubs.
- **Every LegiScan version is a stub** (both Hawaii bills) — LegiScan's HI copies are summary
  pages, not bill text. Hawaii's site blocks non-browser fetches (Cloudflare). Recover via the
  Wayback Machine: query `web.archive.org/cdx/search/cdx?url=capitol.hawaii.gov/sessions/...`,
  download the snapshot with the `id_` URL modifier (the response is the original **gzip** bytes —
  gunzip before use), then run through `fetch.py --from-file`.
- **"text too short" on a real fetch** — read the text. Some acts are genuinely tiny
  (MS HB 1723 defines one term; TN SB 837 is a two-line personhood act). If legitimate, set the
  manifest status to `ok` and note what you verified.
- **State-site scraping** (pre-LegiScan approach, still the fallback): Virginia's LIS is a React
  app (raw HTML is empty — needs a browser or LegiScan), Kansas HB 2183's "Enrolled" PDF link
  serves the wrong bill (documented in its manifest), Tennessee/Louisiana render text links via JS
  but have constructible document URLs.

## Known caveats in the current corpus

- A handful of bills have only Introduced-version text (DE HB 191, MA ×2, NY ×3). ID H 727 was
  verified passed-as-introduced (no amendments exist). The NY situation is substitutions, not
  missing text: A 9487 was replaced by S 8831 (both in the dataset — same law, count once) and
  S 8793 was replaced by A 9456 (fetched as `ny-a-9456`, not in the dataset). CA AB 1651 and
  NJ S 4390 were enacted after the spreadsheet's 7/31 cutoff — LegiScan status is current, the
  dataset's `enacted` flags are not.
- The source spreadsheet is hand-curated: bill numbers and statuses can carry human error. The
  pipeline's verify step (bill number must appear in the fetched text) is the guard — don't
  weaken it.

## Norms

- Never commit the LegiScan key. It lives in the environment (`~/.zshenv`), nowhere in the repo.
- `texts/tmp/` is disposable cache (gitignored). Everything else under `texts/` is provenance —
  commit it.
- LegiScan data is CC BY 4.0 — attribute LegiScan in anything published from it.
- The cost model's numbers in `data/bills.js` are placeholders until the coding pass lands; the
  README says so prominently. Keep that disclaimer until it's no longer true.
