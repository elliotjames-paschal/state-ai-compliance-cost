// PLACEHOLDER DATASET — illustrative values pending statute coding.
//
// This file defines the schema the coded dataset will ship in. Every duty-hour
// range and reuse value below is a placeholder chosen for plausibility, not a
// coded fact. In the final version each extracted parameter is anchored to the
// quoted statutory provision it came from (see `params.source` fields),
// double-coded, and hand-validated on a sample.
//
// Schema:
//   families[key]        — a requirement family: bills that ask for the same kind
//                          of thing across states. `reuse` (0–1) is how much of a
//                          build for one state carries to the next, to be derived
//                          from coded parameter divergence across the family.
//   bills[].category     — who the bill binds: "company" | "criminal" |
//                          "public-sector" | "education". Only "company" bills
//                          carry into the estimate by default.
//   bills[].duties       — triangular hour estimates {low, mode, high} per role:
//                          legal (one-time review/counsel), eng (one-time build),
//                          ops (recurring, per year).
//   bills[].params       — coded statutory parameters used to compute reuse.

window.MODEL_DATA = {

  families: {
    "adm-governance": {
      label: "Automated decision governance",
      note: "Risk programs, impact assessments, bias audits for consequential decisions",
      reuse: 0.45
    },
    "transparency": {
      label: "AI disclosure & transparency",
      note: "Consumer-facing disclosure that AI is in use; provenance and detection tooling",
      reuse: 0.65
    },
    "training-data": {
      label: "Training data disclosure",
      note: "Public documentation of datasets used to train generative systems",
      reuse: 0.80
    },
    "minors": {
      label: "Minor protections & companion AI",
      note: "Age gates, crisis protocols, design duties for users under statutory age thresholds",
      reuse: 0.50
    },
    "synthetic-media": {
      label: "Synthetic media & digital replicas",
      note: "Consent and labeling duties for AI-generated likenesses",
      reuse: 0.60
    },
    "public-sector": {
      label: "Government AI use",
      note: "Agency inventories and procurement rules — binds the state, not companies",
      reuse: 0.50
    },
    "education": {
      label: "Schools & curriculum",
      note: "AI literacy and school policies — binds schools, not companies",
      reuse: 0.50
    }
  },

  bills: [
    {
      id: "CO SB24-205", state: "CO", name: "Colorado AI Act",
      category: "company", family: "adm-governance", status: "Enacted",
      duties: { legal: { low: 60, mode: 120, high: 240 }, eng: { low: 200, mode: 450, high: 900 }, ops: { low: 100, mode: 200, high: 400 } },
      params: { appliesTo: "developers & deployers of high-risk AI", assessment: "annual impact assessment", noticeDays: 90 }
    },
    {
      id: "IL HB 3773", state: "IL", name: "AI in employment decisions (IHRA amendment)",
      category: "company", family: "adm-governance", status: "Enacted",
      duties: { legal: { low: 30, mode: 70, high: 140 }, eng: { low: 80, mode: 180, high: 400 }, ops: { low: 40, mode: 90, high: 180 } },
      params: { appliesTo: "employers using AI in employment decisions", assessment: "none specified", noticeDays: null }
    },
    {
      id: "NYC LL 144", state: "NY", name: "Automated employment decision tools (NYC)",
      category: "company", family: "adm-governance", status: "In force",
      duties: { legal: { low: 25, mode: 50, high: 100 }, eng: { low: 60, mode: 140, high: 300 }, ops: { low: 60, mode: 120, high: 240 } },
      params: { appliesTo: "employers using AEDTs on NYC candidates", assessment: "annual independent bias audit", noticeDays: 10 }
    },
    {
      id: "TX HB 149", state: "TX", name: "Texas Responsible AI Governance Act",
      category: "company", family: "adm-governance", status: "Enacted",
      duties: { legal: { low: 50, mode: 100, high: 200 }, eng: { low: 120, mode: 300, high: 650 }, ops: { low: 60, mode: 140, high: 280 } },
      params: { appliesTo: "developers & deployers", assessment: "prohibited-use review", noticeDays: 60 }
    },
    {
      id: "CA SB 942", state: "CA", name: "California AI Transparency Act",
      category: "company", family: "transparency", status: "Enacted",
      duties: { legal: { low: 20, mode: 45, high: 90 }, eng: { low: 100, mode: 250, high: 550 }, ops: { low: 20, mode: 50, high: 110 } },
      params: { appliesTo: "covered GenAI providers >1M monthly users", requirement: "free AI detection tool + latent disclosure" }
    },
    {
      id: "UT SB 149", state: "UT", name: "Utah AI Policy Act",
      category: "company", family: "transparency", status: "In force",
      duties: { legal: { low: 15, mode: 35, high: 70 }, eng: { low: 40, mode: 100, high: 220 }, ops: { low: 10, mode: 30, high: 70 } },
      params: { appliesTo: "GenAI in regulated occupations & consumer transactions", requirement: "disclosure on request / proactive for regulated occupations" }
    },
    {
      id: "CA AB 2013", state: "CA", name: "GenAI training data disclosure",
      category: "company", family: "training-data", status: "Enacted",
      duties: { legal: { low: 15, mode: 35, high: 80 }, eng: { low: 60, mode: 140, high: 300 }, ops: { low: 10, mode: 25, high: 60 } },
      params: { appliesTo: "developers of public GenAI systems", requirement: "posted dataset documentation before release" }
    },
    {
      id: "CA SB 243", state: "CA", name: "Companion chatbot safeguards",
      category: "company", family: "minors", status: "Enacted",
      duties: { legal: { low: 30, mode: 65, high: 130 }, eng: { low: 120, mode: 280, high: 600 }, ops: { low: 50, mode: 110, high: 220 } },
      params: { appliesTo: "companion chatbot operators", ageThreshold: 18, requirement: "crisis protocols, break reminders, disclosure" }
    },
    {
      id: "MD HB 603", state: "MD", name: "Age-Appropriate Design Code",
      category: "company", family: "minors", status: "Enacted",
      duties: { legal: { low: 40, mode: 85, high: 170 }, eng: { low: 150, mode: 350, high: 750 }, ops: { low: 60, mode: 130, high: 260 } },
      params: { appliesTo: "online services likely accessed by children", ageThreshold: 18, assessment: "data protection impact assessment" }
    },
    {
      id: "CA AB 2602", state: "CA", name: "Digital replica consent (performers)",
      category: "company", family: "synthetic-media", status: "Enacted",
      duties: { legal: { low: 15, mode: 30, high: 65 }, eng: { low: 30, mode: 80, high: 180 }, ops: { low: 5, mode: 15, high: 40 } },
      params: { appliesTo: "contracts for digital replicas of performers", requirement: "informed consent + representation" }
    },

    // ---- scoped out by default: criminal prohibitions ----
    {
      id: "TX SB 751", state: "TX", name: "Deceptive election deepfake videos",
      category: "criminal", family: "synthetic-media", status: "In force",
      duties: { legal: { low: 5, mode: 15, high: 40 }, eng: { low: 10, mode: 30, high: 80 }, ops: { low: 0, mode: 5, high: 15 } },
      params: { prohibition: "publishing deceptive deepfake video within 30 days of election" }
    },
    {
      id: "MN HF 1370", state: "MN", name: "Deepfakes in elections & NCII",
      category: "criminal", family: "synthetic-media", status: "In force",
      duties: { legal: { low: 5, mode: 15, high: 40 }, eng: { low: 10, mode: 30, high: 80 }, ops: { low: 0, mode: 5, high: 15 } },
      params: { prohibition: "disseminating deepfakes to influence elections; nonconsensual intimate imagery" }
    },

    // ---- scoped out by default: binds state agencies ----
    {
      id: "CT SB 1103", state: "CT", name: "State agency AI inventory & assessment",
      category: "public-sector", family: "public-sector", status: "In force",
      duties: { legal: { low: 10, mode: 25, high: 60 }, eng: { low: 20, mode: 60, high: 150 }, ops: { low: 20, mode: 50, high: 120 } },
      params: { appliesTo: "state agencies", requirement: "annual AI inventory + impact assessments" }
    },
    {
      id: "CA AB 302", state: "CA", name: "High-risk ADS inventory (state agencies)",
      category: "public-sector", family: "public-sector", status: "In force",
      duties: { legal: { low: 10, mode: 25, high: 60 }, eng: { low: 20, mode: 60, high: 150 }, ops: { low: 20, mode: 50, high: 120 } },
      params: { appliesTo: "state agencies", requirement: "comprehensive inventory of high-risk automated decision systems" }
    },

    // ---- scoped out by default: binds schools ----
    {
      id: "CA AB 2876", state: "CA", name: "AI literacy in curriculum frameworks",
      category: "education", family: "education", status: "Enacted",
      duties: { legal: { low: 5, mode: 10, high: 25 }, eng: { low: 5, mode: 15, high: 40 }, ops: { low: 5, mode: 15, high: 40 } },
      params: { appliesTo: "instructional quality commission", requirement: "consider AI literacy in math/science/history frameworks" }
    }
  ]
};
