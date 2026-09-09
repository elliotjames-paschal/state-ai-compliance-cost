# Statute coding protocol — v1.0

(v0.1 piloted on 10 bills 2026-09-09, results in `coding/pilot/`; v1.0 incorporates the pilot's
lessons: content-safeguards duty, userThreshold param, free-text enforcer, criminal-fine
convention, election-family rule, omnibus segmentation.)

How a bill in `texts/<slug>.txt` becomes a coded entry in `data/bills.js`. The coder (LLM or
human) extracts **facts from the enacted text only** — never hours, never judgment calls. Every
value is anchored to a verbatim quote. This file is the fixed vocabulary: coders may not invent
families, parameters, or duties beyond it. If a bill doesn't fit, flag it — don't improvise.

## Output format (one JSON object per bill)

```json
{
  "id": "CO HB 26-1263",
  "category": "company",
  "family": "chatbot-safeguards",
  "appliesTo": "operators of companion chatbots available to minors",
  "duties": ["statutory-review", "disclosure-ui", "crisis-protocol"],
  "dutySources": { "crisis-protocol": "§ 2(3) — 'shall maintain a protocol…'" },
  "params": { "ageThreshold": 18, "aiDisclosure": "session-start" },
  "exposure": { "penaltyMax": 10000, "penaltyUnit": "per violation", "enforcer": "attorney-general" },
  "sources": { "ageThreshold": "§ 1(2) — 'a user under eighteen years of age'", "...": "..." },
  "duplicateOf": null,
  "flags": [],
  "confidence": "high"
}
```

## Rules (in order of importance)

1. **Read the full text file.** Never code from the dataset description or the bill title.
2. **Quote verbatim.** Every entry in `sources`/`dutySources` is a section cite + an exact
   substring of the text. If you can't find a quote for a value, you don't have that value.
3. **Silence is silence.** A parameter the statute doesn't set is omitted, never null/zero.
   A bill with no penalty provision gets no `exposure` block.
4. **No imports.** If the bill routes enforcement through another act ("a violation is an unfair
   trade practice under…"), code `enforcer` with that quote and no `penaltyMax`. Same for any
   cross-referenced statute: code only what THIS text states.
5. **Fixed vocabulary.** `family`, `duties`, and each family's `params` come only from the lists
   below. A requirement that fits no listed duty/param goes in `flags`, not a new key.
6. **The dataset's category column is a hint, not an answer.** Assign `category` and `family`
   from the text. (Example: ID S 1227 is filed under "AI in Education" but is a chatbot-safeguards
   bill.)
7. **Duplicates**: if this bill was substituted by / replaced by a companion (check
   `data/legiscan.js` relations), set `duplicateOf` to the surviving bill id and code nothing else.
8. **Uncertain → say so.** Genuine ambiguity goes in `flags` with `confidence: "medium"|"low"`.
   Never resolve ambiguity by guessing in the coded fields.
9. **Omnibus bills** (regimes spanning several families, e.g. CT SB 5): produce one entry per
   family-coherent segment. Each entry keeps the bill `id` plus a `segment` field naming the
   regime ("employment-adm", "ai-companions", …) and codes only that segment's duties/params.
   Only the first segment carries `statutory-review` (the law is read once).
10. **Election communications**: bills regulating AI in political ads/robocalls go in
    `election-disclosure` even when enforced criminally — the enforcement mechanism lives in
    `exposure`, not the family choice. `ai-crimes` is for conduct prohibitions (NCII, CSAM,
    fraud, suicide-encouragement), not disclosure regimes.
11. **Criminal penalties**: `penaltyMax` is the highest stated FINE; imprisonment terms and
    tier structures (misdemeanor/felony) go in `flags`. `enforcer` may be short free text
    naming the actual enforcer ("state-insurance-department", "private-right + attorney-general
    equitable-only") — not limited to an enum.

## category — who the bill binds

- `company` — creates compliance obligations on private businesses (incl. insurers, healthcare
  operators, chatbot operators, developers). If a bill mixes company duties with other provisions,
  it is `company`; note the rest in `flags`.
- `criminal` — criminal prohibitions on persons; no ongoing company compliance duty.
- `public-sector` — binds state agencies/government only.
- `education` — binds schools/districts/curricula only.

## duties — the standard duty blocks (hours live in data/bills.js, not here)

Assign a duty when the text imposes it on the bound party; cite the triggering provision in
`dutySources`. `statutory-review` is automatic for every non-duplicate bill.

| key | assign when the text requires… |
|---|---|
| `statutory-review` | (always — reading/mapping the law) |
| `disclosure-ui` | telling users AI is in use / labeling AI interaction |
| `watermarking` | provenance marks/metadata on AI outputs |
| `detection-tool` | providing a tool to detect AI content |
| `age-assurance` | determining/verifying user age |
| `crisis-protocol` | detecting or responding to self-harm/crisis |
| `impact-assessment` | periodic risk/impact assessments of AI systems |
| `bias-audit` | independent or periodic discrimination audits |
| `risk-program` | a governance program, policies, or safety framework |
| `human-review` | human review/override of automated decisions |
| `consent-workflow` | obtaining consent for likeness/replica/data use |
| `takedown-process` | a reporting, removal, or complaint channel |
| `documentation` | published documentation of models/training data |
| `incident-reporting` | reporting safety incidents to a authority |
| `registration-filing` | registering with or filing to an agency |
| `content-safeguards` | technical measures preventing prohibited content/interactions (sexual content involving minors, sentience claims, romantic role-play with minors, …) |

## families and their fixed param vocabularies

Params are numbers or the listed enums. Multi-value → pick the closest single enum and flag if
lossy. (v0.1 — the pilot exists to stress-test these lists; propose additions via `flags`.)

- **chatbot-safeguards** — companion/conversational AI duties (incl. minors)
  `scope` companion|all-chatbots · `ageFocus` minors|all-users · `aiDisclosure` session-start|periodic|on-request
  `crisisProtocol` required · `breakReminders` required · `parentalTools` required
  `engagementLimits` required · `contentSafeguards` required · `ageThreshold` number
- **mental-health-practice** — AI in therapy/clinical practice, binds providers/operators
  `aiTherapyRule` ban|supervised|disclosure-only · `consentRequired` yes · `scope` psychotherapy|all-clinical
- **insurance-adm** — AI in coverage/claims/prior-auth decisions
  `humanReview` required-final|required-appeal · `decisionsCovered` denials|prior-auth|all
  `disclosure` required · `aiSoleBasis` prohibited · `appealDays` number
- **adm-governance** — high-risk / consequential-decision AI acts
  `covers` developers|deployers|both · `trigger` consequential-decisions|high-risk-listed
  `assessment` pre-deployment|annual|none · `consumerNotice` required · `appealRight` required
  `optOut` required
- **frontier-safety** — large-model developer safety regimes
  `threshold` compute|cost|capability · `safetyFramework` required · `incidentReporting` required
  `thirdPartyAudit` required · `whistleblower` protected
- **provenance-transparency** — output labeling/watermark/detection regimes
  `watermark` required · `detectionTool` required · `disclosureTrigger` all-genai|av-only|on-request
  `userThreshold` number (monthly users above which the duty applies)
- **likeness-rights** — digital replica / NIL consent (civil)
  `consentRequired` yes · `coveredSubjects` performers|all-persons|deceased · `postmortemYears` number
- **ai-crimes** — criminal prohibitions
  `prohibition` ncii|csam|election-deepfakes|impersonation-fraud|suicide-encouragement
  `coveredSubjects` minors|all-persons · `electionWindowDays` number
- **election-disclosure** — AI disclosure in political communications (civil duties)
  `disclosure` required · `scope` ads|robocalls|all-communications · `windowDays` number
- **pricing-competition** — algorithmic pricing/coordination limits
  `prohibition` surveillance-pricing|price-coordination · `disclosure` required
- **privacy-data** — AI provisions inside privacy/data-broker/social-media acts
  `admOptOut` required · `profilingAssessment` required · `minorsFocus` yes · `registration` required
- **workforce** — AI job-displacement / worker-protection duties on employers
  `retaliationProtection` yes · `noticeRequired` yes
- **healthcare-clinical** — AI in medical care beyond insurance (licensure, clinical use)
  `aiPracticeRule` ban|disclosure|supervision · `scope` licensure|treatment|all
- **professional-services** — AI rules in licensed professions/exams
  `aiRule` ban|disclosure|supervision · `profession` free-text-short
- **public-sector** — binds government
  `inventory` one-time|annual · `procurementRules` required · `assessment` required · `program` free-text-short
- **education-k12** — binds schools
  `curriculum` required · `policyRequired` yes · `trainingRequired` yes · `graduationReq` yes
- **definitions-only** — defines terms, imposes nothing
  (no params)
- **data-centers** — AI-infrastructure siting/energy/credits
  `scope` free-text-short

## Process

Pilot: 10 bills spanning the families, single-coded, human-reviewed → vocabulary frozen as v1.0.
Full run: every bill coded twice independently; a comparison script diffs the two passes;
disagreements adjudicated by a third read. Coded entries replace the placeholders in
`data/bills.js` wholesale; reuse and the federal baseline recompute automatically.
