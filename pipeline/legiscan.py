#!/usr/bin/env python3
"""Fetch bill texts via the LegiScan API instead of scraping 30 state sites.

Usage:
  export LEGISCAN_API_KEY=...
  python3 pipeline/legiscan.py                 # all bills from data/bills-2026.js
  python3 pipeline/legiscan.py VA              # one state
  python3 pipeline/legiscan.py "VA HB 1186"    # one bill
  python3 pipeline/legiscan.py --list "VA HB 1186"   # show available text versions, fetch nothing
  python3 pipeline/legiscan.py --force ...     # refetch even if manifest status is ok

For each bill: resolve the state's 2025-2026/2026 session, look the bill number
up in the session master list, pick the latest text version (Chaptered >
Enrolled > newest otherwise), download it base64-encoded from LegiScan's
archive, and hand the bytes to the same extraction + verification used by
fetch.py. Writes texts/raw/<slug>.<ext>, texts/<slug>.txt,
texts/manifest/<slug>.json — same layout, so tools_check.py keeps working.

API responses are cached in texts/tmp/legiscan/ so reruns don't spend quota
(~250 calls for the full 89-bill run against a 30k/month free tier).
"""
import base64, datetime, json, os, pathlib, re, sys, urllib.parse, urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from fetch import extract_html, extract_pdf

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "texts" / "tmp" / "legiscan"
API = "https://api.legiscan.com/"

# Preferred text version, best first. Anything not listed ranks below, by date.
VERSION_RANK = ["Chaptered", "Enrolled"]


def api(op, cache_key=None, **params):
    key = os.environ.get("LEGISCAN_API_KEY")
    if not key:
        sys.exit("LEGISCAN_API_KEY is not set")
    cpath = CACHE / f"{cache_key or op}.json" if cache_key or op != "getBillText" else None
    if cpath and cpath.exists():
        return json.loads(cpath.read_text())
    q = urllib.parse.urlencode({"key": key, "op": op, **params})
    with urllib.request.urlopen(f"{API}?{q}", timeout=30) as r:
        data = json.loads(r.read())
    if data.get("status") != "OK":
        raise RuntimeError(f"{op}({params}): {data.get('alert', data)}")
    if cpath:
        CACHE.mkdir(parents=True, exist_ok=True)
        cpath.write_text(json.dumps(data))
    return data


def slugify(bill_id):
    # "CO HB26-1139" -> co-hb-26-1139, "NY A 9487" -> ny-a-9487
    s = re.sub(r"([a-zA-Z])(\d)", r"\1-\2", bill_id)
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def load_bills():
    src = (ROOT / "data" / "bills-2026.js").read_text()
    data = json.loads(src[src.index("{", src.index("BILLS_2026")):src.rindex("}") + 1])
    return data["bills"]


def find_session(state):
    sessions = api("getSessionList", cache_key=f"sessions-{state}", state=state)["sessions"]
    # newest regular session covering 2026; fall back to newest overall
    regular = [s for s in sessions if not s.get("special") and s["year_end"] >= 2026]
    pick = min(regular, key=lambda s: s["year_end"]) if regular else sessions[0]
    return pick["session_id"], pick["session_name"]


# Maine files bills as House/Senate Papers but LegiScan indexes by LD number
# (mappings read off legislature.maine.gov's own bill pages)
NUMBER_OVERRIDES = {("ME", "HP 1397"): "LD 2082", ("ME", "HP 343"): "LD 524"}


def parse_number(number):
    # ("HB", 545) from any of "HB 545" / "HB0545" / "H545" / "HB26-1139".
    # The trailing digit group drops both zero padding and CO's session prefix.
    alpha = re.match(r"[A-Za-z]*", number.strip()).group(0).upper()
    digits = re.findall(r"\d+", number)
    return alpha, int(digits[-1]) if digits else 0


def find_bill_id(state, number):
    number = NUMBER_OVERRIDES.get((state, number), number)
    session_id, _ = find_session(state)
    ml = api("getMasterList", cache_key=f"masterlist-{session_id}", id=session_id)["masterlist"]
    alpha, num = parse_number(number)
    fallback = None
    for k, v in ml.items():
        if k == "session":
            continue
        a, n = parse_number(v["number"])
        if n != num:
            continue
        if a == alpha:
            return v["bill_id"]
        # "H 301" vs "HB301" style prefix drift — but never HB vs HR/HJR
        if a.startswith(alpha) or alpha.startswith(a):
            fallback = v["bill_id"]
    return fallback


def rank_texts(texts):
    # doc_id, not date, breaks ties within a rank: LegiScan doc_ids increase
    # chronologically and are always present, while dates are often 0000-00-00
    def rank(t):
        vr = VERSION_RANK.index(t["type"]) if t["type"] in VERSION_RANK else len(VERSION_RANK)
        return (vr, -t["doc_id"])
    return sorted(texts, key=rank)


def fetch_bill(bill, force=False, list_only=False):
    slug = slugify(bill["id"])
    state, number = bill["state"], bill["id"][len(bill["state"]):].strip()
    mpath = ROOT / "texts" / "manifest" / f"{slug}.json"
    if not force and not list_only and mpath.exists() and json.loads(mpath.read_text())["status"] == "ok":
        print(f"SKIP {slug}: already ok (use --force to refetch)")
        return True

    manifest = {
        "id": bill["id"], "slug": slug, "state": state,
        "sourcePage": None, "docUrl": None, "docFormat": None, "version": None,
        "rawFile": None, "txtFile": None, "chars": 0,
        "fetchedAt": datetime.date.today().isoformat(),
        "status": "missing", "notes": "via LegiScan API",
    }

    try:
        bill_id = find_bill_id(state, number)
        if not bill_id:
            raise RuntimeError(f"{number} not in LegiScan master list for {state}")
        b = api("getBill", cache_key=f"bill-{state}-{slugify(number)}", id=bill_id)["bill"]
        manifest["sourcePage"] = b.get("state_link") or b.get("url")
        if not b.get("texts"):
            raise RuntimeError("LegiScan has no text documents for this bill")
        if list_only:
            print(f"{bill['id']} (bill_id {bill_id}):")
            for t in b["texts"]:
                print(f"  doc {t['doc_id']}: {t['type']} {t['date']} ({t['mime']})")
            return True
        # best version first, but fall back: chaptered CO acts are image-only
        # scans and some HI/NJ amended docs are empty Word-styling stubs
        text = raw = doc = ext = None
        tried = []
        for cand in rank_texts(b["texts"])[:4]:
            payload = api("getBillText", id=cand["doc_id"])["text"]
            craw = base64.b64decode(payload["doc"])
            is_pdf = craw[:5] == b"%PDF-" or "pdf" in payload.get("mime", "").lower()
            try:
                ctext = extract_pdf(craw) if is_pdf else extract_html(craw)
            except Exception as e:
                tried.append(f"{cand['type']} {cand['date']}: extraction failed: {e}")
                continue
            if len(ctext) >= 800:
                text, raw, doc, ext = ctext, craw, cand, ("pdf" if is_pdf else "html")
                break
            tried.append(f"{cand['type']} {cand['date']}: {len(ctext)} chars")
        if doc is None:
            raise RuntimeError("no version extracted; tried " + "; ".join(tried))
        manifest["version"] = doc["type"]
        manifest["docUrl"] = doc.get("state_link") or doc.get("url")
        manifest["notes"] += f" | doc_id {doc['doc_id']} ({doc['type']} {doc['date']})"
        if tried:
            manifest["notes"] += " | fell back past: " + "; ".join(tried)
    except Exception as e:
        manifest["notes"] += f" | {e}"
        mpath.write_text(json.dumps(manifest, indent=1))
        print(f"MISSING {slug}: {e}")
        return False

    (ROOT / "texts" / "raw" / f"{slug}.{ext}").write_bytes(raw)
    manifest["docFormat"] = ext
    manifest["rawFile"] = f"texts/raw/{slug}.{ext}"
    (ROOT / "texts" / f"{slug}.txt").write_text(text)
    manifest["txtFile"] = f"texts/{slug}.txt"
    manifest["chars"] = len(text)

    problems = []
    if len(text) < 1200:
        problems.append(f"text too short ({len(text)} chars)")
    digits = re.findall(r"\d+", bill["id"])
    if digits and not any(d in text for d in digits):
        problems.append(f"bill number {digits} not found in text")

    manifest["status"] = "needs-review" if problems else "ok"
    if problems:
        manifest["notes"] += " | " + "; ".join(problems)
    mpath.write_text(json.dumps(manifest, indent=1))
    tag = "NEEDS-REVIEW" if problems else "OK"
    detail = "; ".join(problems) if problems else f"{len(text)} chars, {ext}, {doc['type']}"
    print(f"{tag} {slug}: {detail}")
    return not problems


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force, list_only = "--force" in sys.argv, "--list" in sys.argv
    bills = load_bills()
    if args:
        sel = args[0].upper()
        bills = [b for b in bills if b["id"].upper() == sel or (len(sel) == 2 and b["state"] == sel)]
        if not bills:
            sys.exit(f"no bill matches {args[0]!r}")
    ok = sum(fetch_bill(b, force=force, list_only=list_only) for b in bills)
    print(f"\n{ok}/{len(bills)} ok")
    sys.exit(0 if ok == len(bills) else 1)


if __name__ == "__main__":
    main()
