// PLACEHOLDER DATASET — illustrative values pending statute coding.
//
// This file defines the schema the coded dataset will ship in. Every duty-hour
// range, parameter value, and source quote below is a placeholder chosen for
// plausibility, not a coded fact. In the final version each parameter is
// anchored to the quoted statutory provision it came from, double-coded, and
// hand-validated on a sample.
//
// Schema:
//   families[key]        — a requirement family: bills that ask for the same kind
//                          of thing across states. Reuse is NOT stored here — it
//                          is derived in app.js from the coded params below:
//                          for each pair of bills in a family, the share of
//                          parameters (across both bills' combined set) coded to
//                          the same value; family reuse = the mean over its pairs.
//   bills[].category     — who the bill binds: "company" | "criminal" |
//                          "public-sector" | "education". Only "company" bills
//                          carry into the estimate by default.
//   bills[].appliesTo    — one line on who is covered (display only; not compared)
//   duties[key]          — the standard duty blocks: triangular hour estimates
//                          {low, mode, high} per role for what the AVERAGE AI
//                          model needs to satisfy that duty, wherever it is
//                          imposed. legal (one-time review/counsel), eng
//                          (one-time build), ops (recurring, per year).
//                          Initial values are informed estimates pending
//                          citation to published burden figures (PRA filings,
//                          fiscal notes).
//   bills[].duties       — the duty KEYS this bill triggers; the bill's hours
//                          are the sum of its duty blocks. Bills never carry
//                          their own hour numbers.
//   bills[].params       — coded statutory parameters, comparable across states:
//                          numbers and short enums only. These drive reuse.
//                          Omit a parameter the statute doesn't set.
//   bills[].sources      — same keys as params (and exposure); the quoted
//                          provision each value came from.
//   bills[].exposure     — statutory exposure for non-compliance, reported as
//                          facts and NEVER folded into the cost estimate or the
//                          reuse/baseline derivation. Fields, each optional:
//                            penaltyMax  — max civil penalty stated, dollars
//                            penaltyUnit — the statute's unit ("per violation",
//                                          "per consumer", "per day", ...)
//                            enforcer    — "attorney-general" | "private-right"
//                                          | "attorney-general + private-right"
//                            cureDays    — days to cure before enforcement
//                          Code only what THIS bill's text states. If the bill
//                          just cross-references another act (e.g. "enforceable
//                          under the Consumer Protection Act"), code `enforcer`
//                          with that quote and leave penaltyMax out. If the bill
//                          is silent, omit the block entirely — silence is coded
//                          as silence, not zero.

window.MODEL_DATA = {

  // Hours for the average AI model to satisfy each duty, wherever imposed.
  duties: {
    "statutory-review":  { label: "Read & map the statute",
      legal: { low: 10, mode: 25, high: 60 },   eng: { low: 0, mode: 0, high: 0 },       ops: { low: 0, mode: 0, high: 0 } },
    "disclosure-ui":     { label: "AI-use disclosure in product",
      legal: { low: 5, mode: 10, high: 25 },    eng: { low: 20, mode: 60, high: 150 },   ops: { low: 5, mode: 10, high: 30 } },
    "watermarking":      { label: "Output watermarking / provenance",
      legal: { low: 5, mode: 15, high: 30 },    eng: { low: 80, mode: 200, high: 450 },  ops: { low: 20, mode: 40, high: 90 } },
    "detection-tool":    { label: "Public AI-detection tool",
      legal: { low: 5, mode: 15, high: 30 },    eng: { low: 100, mode: 250, high: 550 }, ops: { low: 30, mode: 60, high: 120 } },
    "age-assurance":     { label: "Age gates / verification",
      legal: { low: 10, mode: 25, high: 50 },   eng: { low: 60, mode: 160, high: 350 },  ops: { low: 30, mode: 70, high: 150 } },
    "crisis-protocol":   { label: "Self-harm detection & referral",
      legal: { low: 10, mode: 25, high: 50 },   eng: { low: 80, mode: 200, high: 450 },  ops: { low: 40, mode: 90, high: 180 } },
    "impact-assessment": { label: "Algorithmic impact assessment",
      legal: { low: 30, mode: 70, high: 140 },  eng: { low: 40, mode: 100, high: 220 },  ops: { low: 60, mode: 130, high: 260 } },
    "bias-audit":        { label: "Independent bias audit",
      legal: { low: 15, mode: 40, high: 80 },   eng: { low: 40, mode: 100, high: 220 },  ops: { low: 50, mode: 110, high: 220 } },
    "risk-program":      { label: "AI risk / governance program",
      legal: { low: 40, mode: 90, high: 180 },  eng: { low: 30, mode: 80, high: 180 },   ops: { low: 40, mode: 100, high: 200 } },
    "human-review":      { label: "Human-in-the-loop review workflow",
      legal: { low: 10, mode: 25, high: 50 },   eng: { low: 60, mode: 150, high: 320 },  ops: { low: 60, mode: 140, high: 280 } },
    "consent-workflow":  { label: "Likeness / replica consent flow",
      legal: { low: 15, mode: 30, high: 65 },   eng: { low: 30, mode: 80, high: 180 },   ops: { low: 5, mode: 15, high: 40 } },
    "takedown-process":  { label: "Report & removal channel",
      legal: { low: 10, mode: 20, high: 45 },   eng: { low: 40, mode: 100, high: 220 },  ops: { low: 30, mode: 70, high: 150 } },
    "documentation":     { label: "Training-data / model documentation",
      legal: { low: 10, mode: 25, high: 55 },   eng: { low: 40, mode: 110, high: 240 },  ops: { low: 10, mode: 25, high: 60 } },
    "incident-reporting": { label: "Safety incident reporting",
      legal: { low: 10, mode: 25, high: 50 },   eng: { low: 20, mode: 60, high: 130 },   ops: { low: 10, mode: 30, high: 70 } },
    "registration-filing": { label: "Register / file with agency",
      legal: { low: 5, mode: 15, high: 30 },    eng: { low: 10, mode: 25, high: 60 },    ops: { low: 10, mode: 25, high: 60 } },
    "content-safeguards": { label: "Prohibited-content safeguards",
      legal: { low: 10, mode: 25, high: 50 },   eng: { low: 100, mode: 250, high: 550 }, ops: { low: 40, mode: 90, high: 180 } }
  },

  families: {
    "adm-governance": {
      label: "Automated decision governance",
      note: "Risk programs, impact assessments, bias audits for consequential decisions"
    },
    "transparency": {
      label: "AI disclosure & transparency",
      note: "Consumer-facing disclosure that AI is in use; provenance and detection tooling"
    },
    "training-data": {
      label: "Training data disclosure",
      note: "Public documentation of datasets used to train generative systems"
    },
    "minors": {
      label: "Minor protections & companion AI",
      note: "Age gates, crisis protocols, design duties for users under statutory age thresholds"
    },
    "synthetic-media": {
      label: "Synthetic media & digital replicas",
      note: "Consent and labeling duties for AI-generated likenesses"
    },
    "public-sector": {
      label: "Government AI use",
      note: "Agency inventories and procurement rules — binds the state, not companies"
    },
    "education": {
      label: "Schools & curriculum",
      note: "AI literacy and school policies — binds schools, not companies"
    }
  },

  bills: [
    {
      id: "CO SB24-205", state: "CO", name: "Colorado AI Act",
      category: "company", family: "adm-governance", status: "Enacted",
      appliesTo: "developers & deployers of high-risk AI",
      duties: ["statutory-review", "risk-program", "impact-assessment", "disclosure-ui", "human-review"],
      params: { covers: "developers-deployers", assessment: "annual-impact-assessment", noticeDays: 90 },
      // cross-reference example: the bill routes enforcement through the state
      // UDAP act without stating an amount, so no penaltyMax is coded
      exposure: { enforcer: "attorney-general", cureDays: 60 },
      sources: {
        covers: "§ 6-1-1702 — 'a developer of a high-risk artificial intelligence system…' [placeholder quote]",
        assessment: "§ 6-1-1703(3) — 'an impact assessment… at least annually' [placeholder quote]",
        noticeDays: "§ 6-1-1704 — 'no later than ninety days…' [placeholder quote]",
        enforcer: "§ 6-1-1706 — 'a violation… constitutes an unfair trade practice' (enforced under the CCPA) [placeholder quote]",
        cureDays: "[placeholder quote]"
      }
    },
    {
      id: "IL HB 3773", state: "IL", name: "AI in employment decisions (IHRA amendment)",
      category: "company", family: "adm-governance", status: "Enacted",
      appliesTo: "employers using AI in employment decisions",
      duties: ["statutory-review", "disclosure-ui", "human-review"],
      params: { covers: "employers" },
      sources: { covers: "775 ILCS 5/2-102 — 'an employer that uses artificial intelligence…' [placeholder quote]" }
    },
    {
      id: "NYC LL 144", state: "NY", name: "Automated employment decision tools (NYC)",
      category: "company", family: "adm-governance", status: "In force",
      appliesTo: "employers using AEDTs on NYC candidates",
      duties: ["statutory-review", "bias-audit", "disclosure-ui"],
      params: { covers: "employers", assessment: "annual-bias-audit", noticeDays: 10 },
      sources: {
        covers: "Admin. Code § 20-871 — 'employer or employment agency' [placeholder quote]",
        assessment: "§ 20-871(a) — 'a bias audit conducted no more than one year prior…' [placeholder quote]",
        noticeDays: "§ 20-871(b) — 'no less than ten business days…' [placeholder quote]"
      }
    },
    {
      id: "TX HB 149", state: "TX", name: "Texas Responsible AI Governance Act",
      category: "company", family: "adm-governance", status: "Enacted",
      appliesTo: "developers & deployers",
      duties: ["statutory-review", "risk-program", "disclosure-ui"],
      params: { covers: "developers-deployers", assessment: "prohibited-use-review", noticeDays: 60 },
      sources: {
        covers: "[placeholder quote]",
        assessment: "[placeholder quote]",
        noticeDays: "[placeholder quote]"
      }
    },

    {
      id: "CA SB 942", state: "CA", name: "California AI Transparency Act",
      category: "company", family: "transparency", status: "Enacted",
      appliesTo: "covered GenAI providers >1M monthly users",
      duties: ["statutory-review", "detection-tool", "watermarking", "disclosure-ui"],
      params: { aiDisclosure: "required", detectionTool: "required", userThreshold: 1000000 },
      // direct-penalty example: amount and unit stated in the bill itself
      exposure: { penaltyMax: 5000, penaltyUnit: "per violation per day", enforcer: "attorney-general" },
      sources: {
        aiDisclosure: "[placeholder quote]", detectionTool: "[placeholder quote]", userThreshold: "[placeholder quote]",
        penaltyMax: "[placeholder quote]", penaltyUnit: "[placeholder quote]", enforcer: "[placeholder quote]"
      }
    },
    {
      id: "UT SB 149", state: "UT", name: "Utah AI Policy Act",
      category: "company", family: "transparency", status: "In force",
      appliesTo: "GenAI in regulated occupations & consumer transactions",
      duties: ["statutory-review", "disclosure-ui"],
      params: { aiDisclosure: "required" },
      sources: { aiDisclosure: "[placeholder quote]" }
    },

    {
      id: "CA AB 2013", state: "CA", name: "GenAI training data disclosure",
      category: "company", family: "training-data", status: "Enacted",
      appliesTo: "developers of public GenAI systems",
      duties: ["statutory-review", "documentation"],
      params: { datasetDocs: "public-before-release" },
      sources: { datasetDocs: "[placeholder quote]" }
    },

    {
      id: "CA SB 243", state: "CA", name: "Companion chatbot safeguards",
      category: "company", family: "minors", status: "Enacted",
      appliesTo: "companion chatbot operators",
      duties: ["statutory-review", "disclosure-ui", "crisis-protocol", "age-assurance"],
      params: { ageThreshold: 18, aiDisclosure: "required", crisisProtocol: "required" },
      sources: {
        ageThreshold: "[placeholder quote]", aiDisclosure: "[placeholder quote]", crisisProtocol: "[placeholder quote]"
      }
    },
    {
      id: "MD HB 603", state: "MD", name: "Age-Appropriate Design Code",
      category: "company", family: "minors", status: "Enacted",
      appliesTo: "online services likely accessed by children",
      duties: ["statutory-review", "impact-assessment", "age-assurance", "risk-program"],
      params: { ageThreshold: 18, aiDisclosure: "required", assessment: "data-protection-impact" },
      sources: {
        ageThreshold: "[placeholder quote]", aiDisclosure: "[placeholder quote]", assessment: "[placeholder quote]"
      }
    },

    {
      id: "CA AB 2602", state: "CA", name: "Digital replica consent (performers)",
      category: "company", family: "synthetic-media", status: "Enacted",
      appliesTo: "contracts for digital replicas of performers",
      duties: ["statutory-review", "consent-workflow"],
      params: { replicaConsent: "required" },
      sources: { replicaConsent: "[placeholder quote]" }
    },

    // ---- scoped out by default: criminal prohibitions ----
    {
      id: "TX SB 751", state: "TX", name: "Deceptive election deepfake videos",
      category: "criminal", family: "synthetic-media", status: "In force",
      appliesTo: "persons publishing deceptive election deepfakes",
      duties: ["statutory-review"],
      params: { prohibition: "election-deepfakes", electionWindowDays: 30 },
      sources: { prohibition: "[placeholder quote]", electionWindowDays: "[placeholder quote]" }
    },
    {
      id: "MN HF 1370", state: "MN", name: "Deepfakes in elections & NCII",
      category: "criminal", family: "synthetic-media", status: "In force",
      appliesTo: "persons disseminating deepfakes / NCII",
      duties: ["statutory-review"],
      params: { prohibition: "election-deepfakes", ncii: "prohibited" },
      sources: { prohibition: "[placeholder quote]", ncii: "[placeholder quote]" }
    },

    // ---- scoped out by default: binds state agencies ----
    {
      id: "CT SB 1103", state: "CT", name: "State agency AI inventory & assessment",
      category: "public-sector", family: "public-sector", status: "In force",
      appliesTo: "state agencies",
      duties: ["statutory-review", "registration-filing", "impact-assessment"],
      params: { inventory: "annual", assessment: "impact-assessment" },
      sources: { inventory: "[placeholder quote]", assessment: "[placeholder quote]" }
    },
    {
      id: "CA AB 302", state: "CA", name: "High-risk ADS inventory (state agencies)",
      category: "public-sector", family: "public-sector", status: "In force",
      appliesTo: "state agencies",
      duties: ["statutory-review", "registration-filing"],
      params: { inventory: "annual" },
      sources: { inventory: "[placeholder quote]" }
    },

    // ---- scoped out by default: binds schools ----
    {
      id: "CA AB 2876", state: "CA", name: "AI literacy in curriculum frameworks",
      category: "education", family: "education", status: "Enacted",
      appliesTo: "instructional quality commission",
      duties: ["statutory-review"],
      params: { curriculum: "ai-literacy" },
      sources: { curriculum: "[placeholder quote]" }
    }
  ]
};
