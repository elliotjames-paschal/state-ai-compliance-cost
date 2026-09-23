/* State AI Compliance Cost Model — dashboard.
   Tab 1: state law explorer (choropleth of the working dataset).
   Tab 2: bottom-up cost model, Monte Carlo over duty hours.
   All logic runs client-side; data comes from data/*.js (placeholder). */

(function () {
  "use strict";

  var DATA = window.MODEL_DATA;
  var MAP = window.US_MAP;
  var ITERATIONS = 4000;
  var SEED = 20260825; // fixed seed: identical inputs always reproduce identical outputs

  var CATEGORY_LABELS = {
    "company": "Companies",
    "criminal": "Criminal prohibition",
    "public-sector": "State agencies",
    "education": "Schools"
  };

  var STATE_NAMES = {};
  Object.keys(MAP).forEach(function (ab) { STATE_NAMES[ab] = MAP[ab].name; });

  function $(id) { return document.getElementById(id); }

  // ------------------------------------------------------------------------
  // Profile → binding law families. Editable mapping: each role/sector points
  // at the company-binding families that regulate it. See CODING.md for the
  // families themselves. BASELINE applies to any AI company handling data.
  // ------------------------------------------------------------------------
  var BASELINE_FAMILIES = ["privacy-data"];
  var ROLE_FAMILIES = {
    "developer": ["frontier-safety", "provenance-transparency"],
    "app": ["chatbot-safeguards", "likeness-rights", "provenance-transparency"]
  };
  var SECTOR_FAMILIES = {
    "model-regulation": ["frontier-safety"],   // CA SB 53, IL SB 315, NY RAISE Act, …
    "chatbots": ["chatbot-safeguards"],
    "education": ["chatbot-safeguards", "privacy-data"],
    "healthcare": ["healthcare-clinical", "mental-health-practice"],
    "insurance": ["insurance-adm"],
    "employment": ["workforce", "adm-governance"],
    "media": ["likeness-rights", "election-disclosure"],
    "elections": ["election-disclosure"],
    "pricing": ["pricing-competition"]
  };

  // Company-size bands. `rev` is a representative revenue for the % denominator
  // (labeled "assumed" on the card, editable here). `scale` multiplies duty
  // hours — bigger builds cost more, but revenue grows far faster, so % of
  // revenue collapses with size. That regressivity is the headline story.
  var SIZE_BANDS = [
    { key: "pre",    label: "Pre-revenue", bound: "$0",     rev: 0,       scale: 0.5 },
    { key: "small",  label: "Small",       bound: "< $1B",  rev: 250e6,   scale: 0.8 },
    { key: "mid",    label: "Mid-sized",   bound: "< $10B", rev: 3e9,     scale: 1.0 },
    { key: "large",  label: "Large",       bound: "< $50B", rev: 25e9,    scale: 1.8 },
    { key: "xlarge", label: "Very large",  bound: "$100B+", rev: 150e9,   scale: 2.5 }
  ];

  // Where profile responses + email opt-ins are sent. LEAVE EMPTY until a form
  // backend is set up (Formspree / Airtable / Google Apps Script — see SETUP.md).
  // Empty = store to localStorage + console only; nothing leaves the browser.
  var SUBMIT_ENDPOINT = "";

  // ========================================================================
  // Tabs
  // ========================================================================

  function showTab(name) {
    ["explorer", "model", "glossary"].forEach(function (t) {
      $("tab-" + t).classList.toggle("hidden", t !== name);
    });
    document.querySelectorAll(".tab-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tab === name);
    });
    if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
  }

  document.querySelectorAll(".tab-btn").forEach(function (b) {
    b.addEventListener("click", function () { showTab(b.dataset.tab); });
  });
  window.addEventListener("hashchange", function () {
    var t = location.hash.replace("#", "");
    if (t === "model" || t === "explorer" || t === "glossary") showTab(t);
  });

  // ========================================================================
  // Tab 1 — State law explorer
  // ========================================================================

  var BILLS = window.BILLS_2026.bills;
  var explorer = { category: "all", enactedOnly: false, selected: null };

  // choropleth: fill + whether the state label should render white
  var SCALE = [
    { min: 0, fill: "#efece7", dark: false, label: "0" },
    { min: 1, fill: "#f8cdb6", dark: false, label: "1–2" },
    { min: 3, fill: "#ef8557", dark: true,  label: "3–5" },
    { min: 6, fill: "#c23e15", dark: true,  label: "6+" }
  ];

  // manual label nudges where the bbox centroid sits badly (viewBox units)
  var LABEL_NUDGE = { MI: [12, 20], FL: [14, 4], LA: [-8, 0], MD: [0, -4], KY: [6, 4], VA: [4, -2] };
  var LABEL_MIN_AREA = 900;

  function billsForFilter() {
    return BILLS.filter(function (b) {
      if (explorer.enactedOnly && !b.enacted) return false;
      return explorer.category === "all" || b.category === explorer.category;
    });
  }

  function stateCounts() {
    var counts = {};
    billsForFilter().forEach(function (b) { counts[b.state] = (counts[b.state] || 0) + 1; });
    return counts;
  }

  function bucketFor(count) {
    var bucket = SCALE[0];
    SCALE.forEach(function (s) { if (count >= s.min) bucket = s; });
    return bucket;
  }

  var SVG_NS = "http://www.w3.org/2000/svg";

  function el(name, attrs, text) {
    var node = document.createElementNS(SVG_NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (text != null) node.textContent = text;
    return node;
  }

  function buildMap() {
    var svg = el("svg", { viewBox: "0 0 975 610", role: "img", "aria-label": "US map of state AI laws" });
    var tooltip = $("tooltip");

    Object.keys(MAP).forEach(function (ab) {
      var st = MAP[ab];
      var path = el("path", { class: "state", d: st.d, "data-state": ab });

      path.addEventListener("mousemove", function (e) {
        var n = stateCounts()[ab] || 0;
        tooltip.innerHTML = "<strong>" + st.name + "</strong> · <span class='tt-count'>" +
          n + (n === 1 ? " bill" : " bills") + "</span> in dataset";
        tooltip.classList.remove("hidden");
        tooltip.style.left = Math.min(e.clientX + 14, window.innerWidth - 220) + "px";
        tooltip.style.top = (e.clientY + 14) + "px";
      });
      path.addEventListener("mouseleave", function () { tooltip.classList.add("hidden"); });
      path.addEventListener("click", function () {
        explorer.selected = explorer.selected === ab ? null : ab;
        refreshExplorer();
      });
      svg.appendChild(path);
    });

    // labels on top of state shapes
    Object.keys(MAP).forEach(function (ab) {
      var st = MAP[ab];
      if (st.area < LABEL_MIN_AREA) return;
      var nudge = LABEL_NUDGE[ab] || [0, 0];
      svg.appendChild(el("text", {
        class: "state-label", "data-label": ab,
        x: st.cx + nudge[0], y: st.cy + nudge[1] + 3
      }, ab));
    });

    $("usmap").appendChild(svg);
  }

  function refreshMap() {
    var counts = stateCounts();
    document.querySelectorAll("#usmap .state").forEach(function (p) {
      var ab = p.dataset.state;
      var bucket = bucketFor(counts[ab] || 0);
      p.setAttribute("fill", bucket.fill);
      p.classList.toggle("selected", explorer.selected === ab);
    });
    document.querySelectorAll("#usmap .state-label").forEach(function (t) {
      var bucket = bucketFor(counts[t.dataset.label] || 0);
      t.classList.toggle("on-dark", bucket.dark);
    });
    // keep the selected path painted above its neighbours so its outline shows
    var sel = document.querySelector("#usmap .state.selected");
    if (sel) sel.parentNode.insertBefore(sel, sel.parentNode.querySelector(".state-label"));
  }

  function renderLegend() {
    $("legend").innerHTML = "<span>Bills in dataset:</span>" + SCALE.map(function (s) {
      return "<span><span class='swatch' style='background:" + s.fill + "'></span>" + s.label + "</span>";
    }).join("");
  }

  function renderStatStrip() {
    var bills = billsForFilter();
    var states = {}, cats = {};
    bills.forEach(function (b) { states[b.state] = 1; cats[b.category] = 1; });
    var stats = [
      [bills.length, "bills passed"],
      [Object.keys(states).length, "states"],
      [Object.keys(cats).length, "topics"]
    ];
    $("stat-strip").innerHTML = stats.map(function (s) {
      return "<div class='stat'><div class='stat-value'>" + s[0] +
             "</div><div class='stat-label'>" + s[1] + "</div></div>";
    }).join("");
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function billCard(b) {
    var lg = (window.LEGISCAN || {})[b.id] || {};
    var meta = [];
    if (b.sponsor) meta.push(esc(b.sponsor));
    if (b.enacted && b.effectiveDate) meta.push("effective " + b.effectiveDate);
    if (!b.enacted && b.lastActionDate) meta.push("last action " + b.lastActionDate);
    (lg.relations || []).forEach(function (r) {
      meta.push(esc(r.type + " " + r.bill));
    });
    var floor = (lg.votes || []).filter(function (v) { return v.passed; });
    if (floor.length) {
      var fv = floor[floor.length - 1];
      meta.push("final floor vote " + fv.yea + "–" + fv.nay);
    }
    if (lg.ourText) meta.push("text: " + esc(lg.ourText.version));
    var links = [];
    if (lg.stateLink) links.push("<a href='" + esc(lg.stateLink) + "' target='_blank' rel='noopener'>official bill page</a>");
    if (lg.legiscanUrl) links.push("<a href='" + esc(lg.legiscanUrl) + "' target='_blank' rel='noopener'>LegiScan</a>");
    return "<div class='bill-card'>" +
      "<span class='bill-id'>" + esc(b.id) + "</span>" +
      "<div class='bill-title'>" + esc(b.description) + "</div>" +
      "<div class='bill-meta'>" +
        "<span class='badge company'>" + esc(b.category) + "</span>" +
        "<span class='badge" + (b.enacted ? "" : " pending") + "'>" + esc(b.status) + "</span>" +
        (lg.status ? "<span class='badge'>" + esc("LegiScan: " + lg.status +
          (lg.statusDate ? " " + lg.statusDate : "")) + "</span>" : "") +
      "</div>" +
      (meta.length ? "<div class='bill-params'>" + meta.join(" · ") + "</div>" : "") +
      (links.length ? "<div class='bill-links'>" + links.join(" · ") + "</div>" : "") +
      "</div>";
  }

  function renderPanel() {
    var panel = $("state-panel");
    var filtered = explorer.category !== "all" || explorer.enactedOnly;

    if (!explorer.selected) {
      var byCat = {};
      billsForFilter().forEach(function (b) { byCat[b.category] = (byCat[b.category] || 0) + 1; });
      var top = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; }).slice(0, 8);
      panel.innerHTML =
        "<h3>United States</h3>" +
        "<p class='panel-sub'>2026 session · as of " + window.BILLS_2026.asOf +
        " · select a state for its bills</p>" +
        "<div class='panel-breakdown'>" +
        top.map(function (c) {
          return "<div><span>" + esc(c) + "</span><span>" + byCat[c] + "</span></div>";
        }).join("") +
        "</div>" +
        "<p class='panel-empty'>Statute coding &mdash; who each bill binds and what duties it creates &mdash; " +
        "is in progress. Once coded, bills that reach companies flow into the cost model.</p>";
      return;
    }

    var ab = explorer.selected;
    var bills = billsForFilter().filter(function (b) { return b.state === ab; });
    panel.innerHTML =
      "<h3>" + STATE_NAMES[ab] + "</h3>" +
      "<p class='panel-sub'>" + bills.length + (bills.length === 1 ? " bill" : " bills") +
      " passed in 2026" + (filtered ? " (filtered)" : "") + "</p>" +
      (bills.length
        ? bills.map(billCard).join("")
        : "<p class='panel-empty'>No 2026 passed bills for this state" +
          (filtered ? " under the current filter" : "") + " in the dataset.</p>");
  }

  function refreshExplorer() {
    refreshMap();
    renderStatStrip();
    renderPanel();
  }

  function populateCategoryFilter() {
    var counts = {};
    BILLS.forEach(function (b) { counts[b.category] = (counts[b.category] || 0) + 1; });
    var select = $("cat-filter");
    Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c + " (" + counts[c] + ")";
      select.appendChild(opt);
    });
  }

  $("cat-filter").addEventListener("input", function () {
    explorer.category = this.value;
    refreshExplorer();
  });

  $("enacted-only").addEventListener("input", function () {
    explorer.enactedOnly = this.checked;
    refreshExplorer();
  });

  // ========================================================================
  // Tab 2 — Cost model
  // ========================================================================

  var DEFAULTS = {
    "rate-legal": "350", "rate-eng": "150", "rate-ops": "85",
    "horizon": "5", "reuse": "55",
    "ops-share": "50", "err-spread": "50"
  };

  // Both drivers are derived from the coded statute parameters, not assigned,
  // and recompute automatically when bills are added to the dataset:
  //   reuse  — for each pair of bills in a family, the share of parameters
  //            (across both bills' combined set) coded to the same value; the
  //            family's reuse is the mean over its pairs. A parameter only one
  //            state sets counts as a mismatch.
  //   common — the federal least-common-denominator: the share of the family's
  //            parameters that EVERY state sets to the same value. With the
  //            baseline toggle on, that shared core of each build is not
  //            claimed — a federal standard covering what all states agree on
  //            would have required it anyway.
  // Single-bill families: reuse is null (nothing to carry over) and common is 1
  // (one state's law IS the common denominator, so the baseline covers it).
  function deriveFamilyStats() {
    var byFam = {};
    DATA.bills.forEach(function (b) {
      (byFam[b.family] = byFam[b.family] || []).push(b);
    });
    var out = {};
    Object.keys(DATA.families).forEach(function (f) {
      var bills = byFam[f] || [], sum = 0, pairs = 0;
      var union = {};
      bills.forEach(function (b) {
        Object.keys(b.params).forEach(function (k) { union[k] = 1; });
      });
      for (var i = 0; i < bills.length; i++) {
        for (var j = i + 1; j < bills.length; j++) {
          var a = bills[i].params, b = bills[j].params, keys = {};
          Object.keys(a).concat(Object.keys(b)).forEach(function (k) { keys[k] = 1; });
          var ks = Object.keys(keys);
          if (!ks.length) continue;
          var match = 0;
          ks.forEach(function (k) { if (a[k] !== undefined && a[k] === b[k]) match++; });
          sum += match / ks.length;
          pairs++;
        }
      }
      var unionKeys = Object.keys(union);
      var commonCount = unionKeys.filter(function (k) {
        var v = bills[0] && bills[0].params[k];
        return v !== undefined && bills.every(function (b) { return b.params[k] === v; });
      }).length;
      out[f] = {
        reuse: pairs ? sum / pairs : null,
        common: bills.length ? (unionKeys.length ? commonCount / unionKeys.length : 1) : 0
      };
    });
    return out;
  }
  var FAMILY_STATS = deriveFamilyStats();

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function triangular(rng, d) {
    var u = rng(), c = (d.mode - d.low) / (d.high - d.low || 1);
    if (u < c) return d.low + Math.sqrt(u * (d.high - d.low) * (d.mode - d.low));
    return d.high - Math.sqrt((1 - u) * (d.high - d.low) * (d.high - d.mode));
  }

  // The Advanced duty-hours table: one row per duty, editable most-likely
  // (mode) hours per role; the triangular low/high scale with the edit.
  function buildDutyControls() {
    var host = $("duty-table");
    var CAPTIONS = { legal: "legal, once", eng: "eng, once", ops: "ops, per yr" };
    var html = "";
    Object.keys(DATA.duties).forEach(function (k) {
      var d = DATA.duties[k];
      html += "<div class='duty-item'><div class='duty-label' title='" + k + "'>" + d.label + "</div>" +
        "<div class='duty-inputs'>" +
        ["legal", "eng", "ops"].map(function (r) {
          return "<div class='duty-cell'><input type='number' min='0' step='5' data-duty='" + k +
            "' data-role='" + r + "' value='" + d[r].mode + "'>" +
            "<span class='duty-cap'>" + CAPTIONS[r] + "</span></div>";
        }).join("") + "</div></div>";
    });
    host.innerHTML = html;
  }

  function dutyTriangles() {
    // start from the defaults; where the user edited a mode, rescale the range
    var tris = {};
    Object.keys(DATA.duties).forEach(function (k) {
      tris[k] = { legal: DATA.duties[k].legal, eng: DATA.duties[k].eng, ops: DATA.duties[k].ops };
    });
    document.querySelectorAll("#duty-table input").forEach(function (elm) {
      var base = DATA.duties[elm.dataset.duty][elm.dataset.role];
      var m = +elm.value || 0;
      if (m === base.mode) return;
      tris[elm.dataset.duty] = Object.assign({}, tris[elm.dataset.duty]);
      tris[elm.dataset.duty][elm.dataset.role] = base.mode > 0
        ? { low: m * base.low / base.mode, mode: m, high: m * base.high / base.mode }
        : { low: 0, mode: m, high: m * 2 };
    });
    return tris;
  }

  function readSettings() {
    var costs = {};
    document.querySelectorAll("input[data-cost]").forEach(function (elm) {
      costs[elm.dataset.cost] = elm.checked;
    });
    return {
      // unticking a cost type zeroes its rate — isolates e.g. pure build cost
      rateLegal: costs.legal === false ? 0 : +$("rate-legal").value || 0,
      rateEng: costs.eng === false ? 0 : +$("rate-eng").value || 0,
      rateOps: costs.ops === false ? 0 : +$("rate-ops").value || 0,
      firmScale: 1,
      horizon: +$("horizon").value,
      baseline: $("baseline").checked,
      reuseOverride: $("reuse-override").checked,
      reuse: +$("reuse").value / 100,
      opsShare: +$("ops-share").value / 100,
      errSpread: +$("err-spread").value / 100,
      dutyTris: dutyTriangles()
    };
  }

  // Cost claimed for one bill in one draw. The first bill in a requirement
  // family stands in for the federal-baseline build: with the baseline toggle
  // on, its cost is not claimed. Each later state claims (1 - reuse) of a
  // fresh build, and ops reuse is assumed weaker (half the build reuse)
  // because filings and audits repeat per state.
  function runSimulation(included, s, scaleOverride) {
    var firmScale = scaleOverride != null ? scaleOverride : s.firmScale;

    var familyBills = {};
    included.forEach(function (b) {
      (familyBills[b.family] = familyBills[b.family] || []).push(b);
    });

    var rng = mulberry32(SEED);
    var totals = new Array(ITERATIONS);
    var fedTotals = new Array(ITERATIONS);
    var familyTotals = {};
    Object.keys(familyBills).forEach(function (f) {
      familyTotals[f] = new Array(ITERATIONS).fill(0);
    });

    // Hour estimates are correlated across bills — if one duty is underestimated,
    // the rest likely are too. A shared per-draw error factor keeps that
    // correlation so uncertainty doesn't wash out when summing many bills.
    // The spread is the "Hour-estimate error" dashboard control.
    var SHARED_ERROR = { low: 1 - s.errSpread, mode: 1.0, high: 1 + s.errSpread };

    for (var i = 0; i < ITERATIONS; i++) {
      var shared = triangular(rng, SHARED_ERROR);
      // one draw per duty block per iteration: the same duty costs the same
      // hours everywhere it appears in this draw — hours are a property of the
      // duty (for the average model), not of the bill
      var drawn = {};
      for (var dk in DATA.duties) {
        var db = s.dutyTris[dk];
        drawn[dk] = {
          legal: triangular(rng, db.legal),
          eng: triangular(rng, db.eng),
          ops: triangular(rng, db.ops)
        };
      }
      var total = 0, fedDraw = 0;
      for (var f in familyBills) {
        var bills = familyBills[f];
        var reuse = s.reuseOverride ? s.reuse : (FAMILY_STATS[f].reuse || 0);
        var common = FAMILY_STATS[f].common;
        var famTotal = 0;
        for (var j = 0; j < bills.length; j++) {
          var hL = 0, hE = 0, hO = 0;
          for (var q = 0; q < bills[j].duties.length; q++) {
            var dd = drawn[bills[j].duties[q]];
            hL += dd.legal; hE += dd.eng; hO += dd.ops;
          }
          var build = (hL * s.rateLegal + hE * s.rateEng) * firmScale * shared;
          var opsAnnual = hO * s.rateOps * firmScale * shared;
          var claimed;
          if (j === 0) {
            // baseline on: the federal LCD covers the family's common core, so
            // the first state claims only its divergence from that core.
            // Track that core's cost either way — it's reported, not hidden.
            fedDraw += common * build + common * s.opsShare * opsAnnual * s.horizon;
            claimed = s.baseline
              ? (1 - common) * build + (1 - common * s.opsShare) * opsAnnual * s.horizon
              : build + opsAnnual * s.horizon;
          } else {
            // ops carries over more weakly than the build (filings and audits
            // repeat per state) — the ratio is the "Ops carryover" control
            var opsReuse = reuse * s.opsShare;
            claimed = (1 - reuse) * build + (1 - opsReuse) * opsAnnual * s.horizon;
          }
          famTotal += claimed;
        }
        familyTotals[f][i] = famTotal;
        total += famTotal;
      }
      totals[i] = total;
      fedTotals[i] = fedDraw;
    }

    fedTotals.sort(function (a, b) { return a - b; });
    totals.sort(function (a, b) { return a - b; });
    var pct = function (p) { return totals[Math.min(ITERATIONS - 1, Math.floor(p * ITERATIONS))]; };

    var familyMedians = {};
    for (var fam in familyTotals) {
      var arr = familyTotals[fam].slice().sort(function (a, b) { return a - b; });
      familyMedians[fam] = arr[Math.floor(arr.length / 2)];
    }

    return {
      samples: totals,
      p10: pct(0.10), p50: pct(0.50), p90: pct(0.90),
      federalMedian: fedTotals[Math.floor(ITERATIONS / 2)],
      familyMedians: familyMedians,
      nBills: included.length
    };
  }

  function money(v) {
    if (!isFinite(v)) return "—";
    var sign = v < 0 ? "-" : ""; v = Math.abs(v);
    if (v >= 1e9) return sign + "$" + (v / 1e9).toFixed(2) + "B";
    if (v >= 1e6) return sign + "$" + (v / 1e6).toFixed(2) + "M";
    if (v >= 1e3) return sign + "$" + Math.round(v / 1e3) + "k";
    return sign + "$" + Math.round(v);
  }

  function renderHistogram(result) {
    var host = $("histogram");
    host.innerHTML = "";
    var W = 820, H = 220, padL = 10, padR = 10, padB = 26, padT = 18;
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H });

    var s = result.samples;
    var min = s[0], max = s[s.length - 1];
    if (!(max > min)) {
      host.innerHTML = '<p class="note">No cost under current scope — nothing to simulate.</p>';
      return;
    }

    var BINS = 40, counts = new Array(BINS).fill(0);
    var w = (max - min) / BINS;
    s.forEach(function (v) {
      counts[Math.min(BINS - 1, Math.floor((v - min) / w))]++;
    });
    var peak = Math.max.apply(null, counts);
    var plotW = W - padL - padR, plotH = H - padT - padB;

    counts.forEach(function (c, i) {
      var h = (c / peak) * plotH;
      svg.appendChild(el("rect", {
        class: "bar",
        x: padL + (i / BINS) * plotW + 0.5,
        y: padT + plotH - h,
        width: plotW / BINS - 1,
        height: h
      }));
    });

    [["p10", result.p10], ["p50", result.p50], ["p90", result.p90]].forEach(function (p) {
      var x = padL + ((p[1] - min) / (max - min)) * plotW;
      svg.appendChild(el("line", { class: "pct-line", x1: x, y1: padT - 4, x2: x, y2: padT + plotH }));
      var anchor = x > W - 90 ? "end" : "start";
      svg.appendChild(el("text", {
        class: "pct-label", x: x + (anchor === "end" ? -4 : 4), y: padT - 6, "text-anchor": anchor
      }, p[0] + " " + money(p[1])));
    });

    svg.appendChild(el("text", { class: "axis-label", x: padL, y: H - 8 }, money(min)));
    svg.appendChild(el("text", { class: "axis-label", x: W - padR, y: H - 8, "text-anchor": "end" }, money(max)));
    host.appendChild(svg);
  }

  function renderFamilies(result) {
    var host = $("families");
    host.innerHTML = "";
    var entries = Object.keys(result.familyMedians).map(function (f) {
      var st = FAMILY_STATS[f];
      var sub = (st.reuse === null ? "" : "reuse " + Math.round(st.reuse * 100) + "% · ") +
        "federal " + Math.round(st.common * 100) + "%";
      return { key: f, label: DATA.families[f].label, sub: sub, value: result.familyMedians[f] };
    }).filter(function (e) { return e.value > 0; })
      .sort(function (a, b) { return b.value - a.value; });

    if (!entries.length) {
      host.innerHTML = '<p class="note">No family contributes cost under current settings.</p>';
      return;
    }

    var W = 820, rowH = 42, labelW = 250, valueW = 70;
    var H = entries.length * rowH + 6;
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H });
    var maxV = entries[0].value, barMax = W - labelW - valueW - 20;

    entries.forEach(function (e, i) {
      var y = i * rowH;
      svg.appendChild(el("text", { class: "fam-name", x: 0, y: y + 17 }, e.label));
      svg.appendChild(el("text", { class: "fam-sub", x: 0, y: y + 32 }, e.sub));
      var bw = Math.max(2, (e.value / maxV) * barMax);
      svg.appendChild(el("rect", { class: "fam-bar", x: labelW, y: y + 12, width: bw, height: 16, rx: 2 }));
      svg.appendChild(el("text", { class: "fam-value", x: labelW + bw + 8, y: y + 25 }, money(e.value)));
    });
    host.appendChild(svg);
  }

  function renderBillsTable(bindingSet) {
    var inSet = {};
    bindingSet.forEach(function (b) { inSet[b.id + "|" + (b.segment || "")] = 1; });
    var tbody = document.querySelector("#bills-table tbody");
    tbody.innerHTML = "";
    var included = 0;
    // show binding laws first, then the rest greyed out
    var ordered = DATA.bills.slice().sort(function (a, b) {
      var ai = inSet[a.id + "|" + (a.segment || "")] ? 0 : 1;
      var bi = inSet[b.id + "|" + (b.segment || "")] ? 0 : 1;
      return ai - bi;
    });
    ordered.forEach(function (b) {
      var inScope = !!inSet[b.id + "|" + (b.segment || "")];
      if (inScope) included++;
      var tr = document.createElement("tr");
      if (!inScope) tr.className = "excluded";
      var params = [b.appliesTo].concat(Object.keys(b.params).map(function (k) {
        return k + ": " + b.params[k];
      })).join(" · ");
      var exp = b.exposure
        ? Object.keys(b.exposure).map(function (k) {
            var v = b.exposure[k];
            return k + ": " + (k === "penaltyMax" ? money(v) : v);
          }).join(" · ")
        : "<span class='hint'>none stated</span>";
      tr.innerHTML =
        "<td><span class='bill-id'>" + b.id + "</span><br><span class='bill-name'>" + b.name + "</span></td>" +
        "<td>" + b.state + "</td>" +
        "<td>" + DATA.families[b.family].label + "</td>" +
        "<td><span class='badge " + b.category + "'>" + CATEGORY_LABELS[b.category] + "</span></td>" +
        "<td class='params'>" + params + "</td>" +
        "<td class='params'>" + exp + "</td>" +
        "<td>" + b.status + "</td>";
      tbody.appendChild(tr);
    });
    $("bill-count").textContent = included + " laws bind this profile · " +
      DATA.bills.length + " coded entries total";
  }

  // ------------------------------------------------------------------------
  // Profile: read the self-selection, resolve to a binding set of laws.
  // ------------------------------------------------------------------------
  function readProfile() {
    var roles = [], sectors = [];
    document.querySelectorAll("input[data-role]:checked").forEach(function (e) { roles.push(e.dataset.role); });
    document.querySelectorAll("input[data-sector]:checked").forEach(function (e) { sectors.push(e.dataset.sector); });
    var availEl = document.querySelector("input[name='avail']:checked");
    return {
      roles: roles, sectors: sectors,
      basedIn: $("based-in").value,
      availability: availEl ? availEl.value : "national",
      availState: $("avail-state").value
    };
  }

  function profileFamilies(p) {
    if (!p.roles.length && !p.sectors.length) return null; // nothing chosen → all
    var fams = {};
    BASELINE_FAMILIES.forEach(function (f) { fams[f] = 1; });
    p.roles.forEach(function (r) { (ROLE_FAMILIES[r] || []).forEach(function (f) { fams[f] = 1; }); });
    p.sectors.forEach(function (s) { (SECTOR_FAMILIES[s] || []).forEach(function (f) { fams[f] = 1; }); });
    return fams;
  }

  function geoStates(p) {
    if (p.availability === "national") return null; // all states
    var set = {};
    if (p.availState) set[p.availState] = 1;
    if (p.basedIn) set[p.basedIn] = 1; // you always face your home state
    return set;
  }

  function bindingBills(p) {
    var fams = profileFamilies(p);
    var states = geoStates(p);
    return DATA.bills.filter(function (b) {
      if (b.category !== "company") return false;        // the estimate is company cost
      if (fams && !fams[b.family]) return false;
      if (states && !states[b.state]) return false;
      return true;
    });
  }

  function pctRev(cost, rev) {
    if (!rev) return null;
    var p = cost / rev * 100;
    if (p >= 10) return p.toFixed(0) + "%";
    if (p >= 1) return p.toFixed(1) + "%";
    if (p >= 0.1) return p.toFixed(2) + "%";
    if (p >= 0.01) return p.toFixed(3) + "%";
    return p.toFixed(4) + "%";
  }

  function renderSizeCards(bills, s) {
    var host = $("size-cards");
    if (!bills.length) {
      host.innerHTML = "<p class='note' style='grid-column:1/-1'>No 2026-session laws bind this " +
        "profile in the selected geography — so there is no state-specific compliance cost here. " +
        "(The dataset covers laws passed in the 2026 session; earlier laws and other states aren't " +
        "included.) Broaden the sector, or set availability to nationally, to see the fragmentation cost.</p>";
      return null;
    }
    var results = SIZE_BANDS.map(function (band) {
      var r = runSimulation(bills, s, band.scale);
      return { band: band, cost: r.p50, pct: band.rev ? r.p50 / band.rev * 100 : null };
    });
    var maxPct = results.reduce(function (m, x) { return x.pct != null ? Math.max(m, x.pct) : m; }, 0);
    host.innerHTML = results.map(function (x) {
      var b = x.band;
      var head = b.rev
        ? "<div class='sc-pct'>" + (pctRev(x.cost, b.rev) || "—") + "</div><div class='sc-pct-label'>of revenue</div>"
        : "<div class='sc-pct'>" + money(x.cost) + "</div><div class='sc-pct-label'>total, " + s.horizon + " yr</div>";
      var bar = (b.rev && maxPct > 0)
        ? "<div class='sc-bar'><span style='width:" + (x.pct / maxPct * 100).toFixed(1) + "%'></span></div>"
        : "<div class='sc-bar empty'></div>";
      var foot = b.rev
        ? "<div class='sc-cost'>" + money(x.cost) + " over " + s.horizon + " yr</div>" +
          "<div class='sc-assumed'>assumed revenue " + money(b.rev) + "</div>"
        : "<div class='sc-cost'>build + " + s.horizon + " yr ops</div>" +
          "<div class='sc-assumed'>no revenue to divide by</div>";
      return "<div class='size-card'><div class='sc-tier'>" + b.label + "</div>" +
        "<div class='sc-rev'>revenue " + b.bound + "</div>" + head + bar + foot + "</div>";
    }).join("");
    return results;
  }

  function renderProfileSummary(p, bills) {
    var host = $("profile-summary");
    if (!p.roles.length && !p.sectors.length) {
      host.innerHTML = "Select what you build above to tailor the estimate — showing <strong>all " +
        bills.length + "</strong> company-binding laws until you do.";
      return;
    }
    var geo = p.availability === "national" ? "available nationally"
      : "available in " + (STATE_NAMES[p.availState] || "one state");
    host.innerHTML = "<strong>" + bills.length + "</strong> laws bind this profile (" + geo +
      "). Costs below assume the work each law requires of the average AI product, scaled by company size.";
  }

  function recompute() {
    var s = readSettings();
    var p = readProfile();
    var bills = bindingBills(p);

    $("horizon-out").textContent = s.horizon + " yr";
    $("reuse-out").textContent = Math.round(s.reuse * 100) + "%";
    $("reuse").disabled = !s.reuseOverride;
    $("ops-share-out").textContent = Math.round(s.opsShare * 100) + "%";
    $("err-spread-out").textContent = "±" + Math.round(s.errSpread * 100) + "%";
    $("avail-state").disabled = p.availability !== "state";

    renderProfileSummary(p, bills);
    renderWizMap(p);

    var results = renderSizeCards(bills, s);
    if (results) {
      var small = results.find(function (x) { return x.band.key === "small"; });
      var xl = results.find(function (x) { return x.band.key === "xlarge"; });
      $("result-headline").innerHTML = "A small company would spend about <strong>" +
        pctRev(small.cost, small.band.rev) + "</strong> of revenue on this &mdash; a very large one, about <strong>" +
        pctRev(xl.cost, xl.band.rev) + "</strong>.";
    } else {
      $("result-headline").textContent = "No state-specific compliance cost for this profile.";
    }

    // reference views use the mid-size band (1x work) on the binding set
    var ref = runSimulation(bills, s, 1.0);
    $("mc-meta").textContent = ITERATIONS.toLocaleString() + " draws · mid-size reference";
    $("federal-out").textContent = money(ref.federalMedian);
    renderHistogram(ref);
    renderFamilies(ref);
    renderBillsTable(bills);
  }

  // states where a profile-family law binds (ignores geography) — colours the map
  function familyStateCounts(p) {
    var fams = profileFamilies(p);
    var counts = {};
    DATA.bills.forEach(function (b) {
      if (b.category !== "company") return;
      if (fams && !fams[b.family]) return;
      counts[b.state] = (counts[b.state] || 0) + 1;
    });
    return counts;
  }

  function mix(t) { // pale accent-soft → accent ramp
    var a = [253, 234, 227], b = [240, 78, 35];
    return "rgb(" + a.map(function (c, i) { return Math.round(c + (b[i] - c) * t); }).join(",") + ")";
  }

  function buildWizMap() {
    var svg = el("svg", { viewBox: "0 0 975 610", role: "img", "aria-label": "US map of where AI laws bind" });
    Object.keys(MAP).forEach(function (ab) {
      var path = el("path", { class: "wm-state", d: MAP[ab].d, "data-state": ab });
      path.addEventListener("click", function () {
        document.querySelector("input[name='avail'][value='state']").checked = true;
        $("avail-state").value = ab;
        $("avail-state").disabled = false;
        recompute();
      });
      svg.appendChild(path);
    });
    $("wiz-map").appendChild(svg);
  }

  function renderWizMap(p) {
    var counts = familyStateCounts(p);
    var max = Object.keys(counts).reduce(function (m, k) { return Math.max(m, counts[k]); }, 0) || 1;
    var national = p.availability === "national";
    document.querySelectorAll("#wiz-map .wm-state").forEach(function (path) {
      var ab = path.dataset.state, n = counts[ab] || 0;
      var inGeo = national || ab === p.availState || ab === p.basedIn;
      path.setAttribute("fill", n > 0 && inGeo ? mix(n / max) : "#ececec");
      path.classList.toggle("dim", !national && !inGeo);
      path.classList.toggle("picked", !national && (ab === p.availState || ab === p.basedIn));
    });
    var total = Object.keys(counts).reduce(function (a, k) { return a + counts[k]; }, 0);
    var nStates = Object.keys(counts).length;
    $("wiz-map-note").innerHTML = national
      ? "<strong>" + total + "</strong> binding laws across <strong>" + nStates +
        "</strong> states reach a company like yours today."
      : (p.availState
          ? "Showing <strong>" + (counts[p.availState] || 0) + "</strong> binding law(s) in " +
            (STATE_NAMES[p.availState] || p.availState) +
            (p.basedIn && p.basedIn !== p.availState ? " plus your home state" : "") + "."
          : "Pick a state above or click the map.");
  }

  var DUTY_MEANINGS = {
    "statutory-review": "Reading and mapping the law — every law's first cost",
    "disclosure-ui": "Telling users AI is in use",
    "watermarking": "Provenance marks on AI-generated output",
    "detection-tool": "A public tool to detect AI content",
    "age-assurance": "Determining or verifying user age",
    "crisis-protocol": "Detecting and responding to self-harm or crisis",
    "impact-assessment": "Periodic risk/impact assessments of AI systems",
    "bias-audit": "Independent or periodic discrimination audits",
    "risk-program": "A governance program, policies, or safety framework",
    "human-review": "Human review or override of automated decisions",
    "consent-workflow": "Obtaining consent for likeness, replica, or data use",
    "takedown-process": "A reporting, removal, or complaint channel",
    "documentation": "Published documentation of models or training data",
    "incident-reporting": "Reporting safety incidents to a state authority",
    "registration-filing": "Registering with or filing to an agency",
    "content-safeguards": "Technical guardrails against prohibited content or interactions"
  };

  function buildGlossaryDuties() {
    var rows = Object.keys(DATA.duties).map(function (k) {
      var d = DATA.duties[k];
      return "<tr><td><strong>" + d.label + "</strong><br><code>" + k + "</code></td>" +
        "<td>" + (DUTY_MEANINGS[k] || "") + "</td>" +
        "<td class='num'>" + d.legal.mode + " / " + d.eng.mode + " · " + d.ops.mode + "/yr</td></tr>";
    }).join("");
    $("gloss-duties").innerHTML =
      "<table class='gloss-table'><thead><tr><th>Duty</th><th>What the law requires</th>" +
      "<th>Default hours</th></tr></thead><tbody>" + rows + "</tbody></table>";
  }

  buildDutyControls();
  buildGlossaryDuties();

  // populate the state dropdowns (all states, alphabetical by name)
  (function () {
    var opts = Object.keys(MAP).map(function (ab) { return { ab: ab, name: MAP[ab].name }; })
      .sort(function (a, b) { return a.name < b.name ? -1 : 1; })
      .map(function (x) { return "<option value='" + x.ab + "'>" + x.name + "</option>"; }).join("");
    $("based-in").insertAdjacentHTML("beforeend", opts);
    $("avail-state").insertAdjacentHTML("beforeend", opts);
  })();

  buildWizMap();

  // ------------------------------------------------------------------------
  // Wizard: one question per step, estimate on the final step.
  // ------------------------------------------------------------------------
  var wizStep = 0;
  function wizGo(n, skipScroll) {
    wizStep = n;
    document.querySelectorAll("#wizard .wiz-step").forEach(function (st) {
      st.hidden = +st.dataset.step !== n;
    });
    document.querySelectorAll("#wiz-progress li").forEach(function (li) {
      var s = +li.dataset.s;
      li.classList.toggle("active", s === n);
      li.classList.toggle("done", s < n);
    });
    if (n === 2) renderWizMap(readProfile());
    if (n === 3) recompute();
    if (n < 3) $("cost-detail").classList.add("hidden"); // hide detail when editing
    if (!skipScroll) {
      var top = $("wizard").getBoundingClientRect().top + window.scrollY - 74;
      window.scrollTo({ top: top < 0 ? 0 : top, behavior: "smooth" });
    }
  }
  document.querySelectorAll("#wizard .wiz-btn[data-go]").forEach(function (btn) {
    btn.addEventListener("click", function () { wizGo(+btn.dataset.go); });
  });
  $("wiz-progress").addEventListener("click", function (e) {
    var li = e.target.closest("li"); if (li) wizGo(+li.dataset.s);
  });
  $("toggle-detail").addEventListener("click", function () {
    var d = $("cost-detail");
    d.classList.toggle("hidden");
    if (!d.classList.contains("hidden")) d.scrollIntoView({ behavior: "smooth" });
  });

  // live recompute: profile chips/selects refresh the estimate + map;
  // advanced knobs refresh only matter once on the result step
  document.querySelectorAll("#tab-model input, #tab-model select").forEach(function (elm) {
    elm.addEventListener("input", recompute);
    elm.addEventListener("change", recompute);
  });

  // ------------------------------------------------------------------------
  // Lead capture: profile + optional email opt-in.
  // Sends to SUBMIT_ENDPOINT if configured; otherwise stores locally only.
  // ------------------------------------------------------------------------
  function submitLead(payload) {
    if (SUBMIT_ENDPOINT) {
      return fetch(SUBMIT_ENDPOINT, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); });
    }
    // no backend configured — keep it in the browser, nothing leaves the page
    try {
      var store = JSON.parse(localStorage.getItem("leadSubmissions") || "[]");
      store.push(payload);
      localStorage.setItem("leadSubmissions", JSON.stringify(store));
    } catch (e) { /* ignore */ }
    return Promise.resolve();
  }

  $("lead-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("lead-email").value.trim();
    var status = $("lead-status");
    if (!email || email.indexOf("@") < 1) { status.textContent = "Enter a valid email."; return; }
    var p = readProfile();
    var payload = {
      email: email,
      consent: $("lead-consent").checked,
      roles: p.roles, sectors: p.sectors,
      basedIn: p.basedIn, availability: p.availability, availState: p.availState,
      ts: new Date().toISOString(),
      source: "state-ai-compliance-cost"
    };
    status.textContent = "Sending…";
    submitLead(payload).then(function () {
      status.textContent = $("lead-consent").checked
        ? "Thanks — you're on the list. We'll share a16z's AI-policy updates."
        : "Saved. Tick the box above if you'd like a16z policy updates too.";
      $("lead-form").reset();
    }).catch(function () {
      status.textContent = "Something went wrong — please try again later.";
    });
  });

  $("reset").addEventListener("click", function () {
    for (var id in DEFAULTS) $(id).value = DEFAULTS[id];
    document.querySelectorAll("input[data-cost]").forEach(function (elm) {
      elm.checked = true;
    });
    document.querySelectorAll("#duty-table input").forEach(function (elm) {
      elm.value = DATA.duties[elm.dataset.duty][elm.dataset.role].mode;
    });
    $("baseline").checked = true;
    $("reuse-override").checked = false;
    recompute();
  });

  // ========================================================================
  // Boot
  // ========================================================================

  buildMap();
  renderLegend();
  populateCategoryFilter();
  refreshExplorer();
  recompute();
  wizGo(0, true);
  showTab(location.hash === "#model" ? "model" : location.hash === "#glossary" ? "glossary" : "explorer");
})();
