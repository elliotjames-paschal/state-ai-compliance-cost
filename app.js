/* State AI Compliance Cost Model — draft dashboard.
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

  // ========================================================================
  // Tabs
  // ========================================================================

  function showTab(name) {
    ["explorer", "model"].forEach(function (t) {
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
    if (t === "model" || t === "explorer") showTab(t);
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
    var meta = [];
    if (b.sponsor) meta.push(esc(b.sponsor));
    if (b.enacted && b.effectiveDate) meta.push("effective " + b.effectiveDate);
    if (!b.enacted && b.lastActionDate) meta.push("last action " + b.lastActionDate);
    return "<div class='bill-card'>" +
      "<span class='bill-id'>" + esc(b.id) + "</span>" +
      "<div class='bill-title'>" + esc(b.description) + "</div>" +
      "<div class='bill-meta'>" +
        "<span class='badge company'>" + esc(b.category) + "</span>" +
        "<span class='badge" + (b.enacted ? "" : " pending") + "'>" + esc(b.status) + "</span>" +
      "</div>" +
      (meta.length ? "<div class='bill-params'>" + meta.join(" · ") + "</div>" : "") +
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
    "firm-scale": "1", "horizon": "5", "reuse": "55", "n-firms": "1000"
  };

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

  function readSettings() {
    var cats = {};
    document.querySelectorAll("input[data-cat]").forEach(function (elm) {
      cats[elm.dataset.cat] = elm.checked;
    });
    return {
      rateLegal: +$("rate-legal").value || 0,
      rateEng: +$("rate-eng").value || 0,
      rateOps: +$("rate-ops").value || 0,
      firmScale: +$("firm-scale").value,
      horizon: +$("horizon").value,
      categories: cats,
      baseline: $("baseline").checked,
      reuseOverride: $("reuse-override").checked,
      reuse: +$("reuse").value / 100,
      nFirms: +$("n-firms").value || 0
    };
  }

  // Cost claimed for one bill in one draw. The first bill in a requirement
  // family stands in for the federal-baseline build: with the baseline toggle
  // on, its cost is not claimed. Each later state claims (1 - reuse) of a
  // fresh build, and ops reuse is assumed weaker (half the build reuse)
  // because filings and audits repeat per state.
  function runSimulation(s) {
    var included = DATA.bills.filter(function (b) { return s.categories[b.category]; });

    var familyBills = {};
    included.forEach(function (b) {
      (familyBills[b.family] = familyBills[b.family] || []).push(b);
    });

    var rng = mulberry32(SEED);
    var totals = new Array(ITERATIONS);
    var familyTotals = {};
    Object.keys(familyBills).forEach(function (f) {
      familyTotals[f] = new Array(ITERATIONS).fill(0);
    });

    // Hour estimates are correlated across bills — if one duty is underestimated,
    // the rest likely are too. A shared per-draw error factor keeps that
    // correlation so uncertainty doesn't wash out when summing many bills.
    var SHARED_ERROR = { low: 0.6, mode: 1.0, high: 1.6 };

    for (var i = 0; i < ITERATIONS; i++) {
      var shared = triangular(rng, SHARED_ERROR);
      var total = 0;
      for (var f in familyBills) {
        var bills = familyBills[f];
        var reuse = s.reuseOverride ? s.reuse : DATA.families[f].reuse;
        var famTotal = 0;
        for (var j = 0; j < bills.length; j++) {
          var d = bills[j].duties;
          var build = (triangular(rng, d.legal) * s.rateLegal +
                       triangular(rng, d.eng) * s.rateEng) * s.firmScale * shared;
          var opsAnnual = triangular(rng, d.ops) * s.rateOps * s.firmScale * shared;
          var claimed;
          if (j === 0) {
            claimed = s.baseline ? 0 : build + opsAnnual * s.horizon;
          } else {
            var opsReuse = reuse * 0.5;
            claimed = (1 - reuse) * build + (1 - opsReuse) * opsAnnual * s.horizon;
          }
          famTotal += claimed;
        }
        familyTotals[f][i] = famTotal;
        total += famTotal;
      }
      totals[i] = total;
    }

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
      return { key: f, label: DATA.families[f].label, value: result.familyMedians[f] };
    }).filter(function (e) { return e.value > 0; })
      .sort(function (a, b) { return b.value - a.value; });

    if (!entries.length) {
      host.innerHTML = '<p class="note">No family contributes cost under current settings.</p>';
      return;
    }

    var W = 820, rowH = 34, labelW = 260, valueW = 70;
    var H = entries.length * rowH + 6;
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H });
    var maxV = entries[0].value, barMax = W - labelW - valueW - 20;

    entries.forEach(function (e, i) {
      var y = i * rowH;
      svg.appendChild(el("text", { class: "fam-name", x: 0, y: y + 21 }, e.label));
      var bw = Math.max(2, (e.value / maxV) * barMax);
      svg.appendChild(el("rect", { class: "fam-bar", x: labelW, y: y + 8, width: bw, height: 16, rx: 2 }));
      svg.appendChild(el("text", { class: "fam-value", x: labelW + bw + 8, y: y + 21 }, money(e.value)));
    });
    host.appendChild(svg);
  }

  function renderBillsTable(s) {
    var tbody = document.querySelector("#bills-table tbody");
    tbody.innerHTML = "";
    var included = 0;
    DATA.bills.forEach(function (b) {
      var inScope = s.categories[b.category];
      if (inScope) included++;
      var tr = document.createElement("tr");
      if (!inScope) tr.className = "excluded";
      var params = Object.keys(b.params).map(function (k) {
        return b.params[k] === null ? null : k + ": " + b.params[k];
      }).filter(Boolean).join(" · ");
      tr.innerHTML =
        "<td><span class='bill-id'>" + b.id + "</span><br><span class='bill-name'>" + b.name + "</span></td>" +
        "<td>" + b.state + "</td>" +
        "<td>" + DATA.families[b.family].label + "</td>" +
        "<td><span class='badge " + b.category + "'>" + CATEGORY_LABELS[b.category] + "</span></td>" +
        "<td class='params'>" + params + "</td>" +
        "<td>" + b.status + "</td>";
      tbody.appendChild(tr);
    });
    $("bill-count").textContent = included + " of " + DATA.bills.length + " bills in scope · placeholder coding";
  }

  function recompute() {
    var s = readSettings();
    var r = runSimulation(s);

    $("horizon-out").textContent = s.horizon + " yr";
    $("headline-horizon").textContent = s.horizon + "-year";
    $("reuse-out").textContent = Math.round(s.reuse * 100) + "%";
    $("reuse").disabled = !s.reuseOverride;

    $("p10").textContent = money(r.p10);
    $("p50").textContent = money(r.p50);
    $("p90").textContent = money(r.p90);
    $("mc-meta").textContent = ITERATIONS.toLocaleString() + " draws · seeded, reproducible";

    $("aggregate-line").innerHTML = s.nFirms > 0
      ? "Across <strong>" + s.nFirms.toLocaleString() + "</strong> firms in scope: <strong>" +
        money(r.p10 * s.nFirms) + "</strong> – <strong>" + money(r.p90 * s.nFirms) +
        "</strong> (central " + money(r.p50 * s.nFirms) + ")"
      : "";

    renderHistogram(r);
    renderFamilies(r);
    renderBillsTable(s);
  }

  document.querySelectorAll("#tab-model input, #tab-model select").forEach(function (elm) {
    elm.addEventListener("input", recompute);
  });

  $("reset").addEventListener("click", function () {
    for (var id in DEFAULTS) $(id).value = DEFAULTS[id];
    document.querySelectorAll("input[data-cat]").forEach(function (elm) {
      elm.checked = elm.dataset.cat === "company";
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
  showTab(location.hash === "#model" ? "model" : "explorer");
})();
