#!/usr/bin/env python3
"""Fetch one bill text: download, extract plain text, verify, write manifest.

Usage:
  python3 pipeline/fetch.py SLUG URL --id "TN HB 1455" --state TN \
      --version Enrolled --keyword "artificial intelligence" [--keyword ...] \
      [--source-page URL] [--notes "..."]

Writes texts/raw/<slug>.<ext>, texts/<slug>.txt, texts/manifest/<slug>.json.
Exits nonzero (and marks needs-review/missing) when verification fails, so
callers can see per-bill success at a glance.
"""
import argparse, datetime, html.parser, io, json, pathlib, re, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36")


class TextExtractor(html.parser.HTMLParser):
    SKIP = {"script", "style", "head", "nav", "footer"}

    def __init__(self):
        super().__init__()
        # a set, not a counter: Word-exported HTML opens <style> twice but
        # closes it once, and an unbalanced counter would swallow the document
        self.parts, self._skip = [], set()

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip.add(tag)

    def handle_endtag(self, tag):
        self._skip.discard(tag)

    def handle_data(self, data):
        if not self._skip and data.strip():
            self.parts.append(data)


def extract_html(raw: bytes) -> str:
    p = TextExtractor()
    p.feed(raw.decode("utf-8", "ignore"))
    text = "\n".join(p.parts)
    return re.sub(r"\n{3,}", "\n\n", text)


def extract_pdf(raw: bytes) -> str:
    import pypdf
    reader = pypdf.PdfReader(io.BytesIO(raw))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("url")
    ap.add_argument("--id", required=True)
    ap.add_argument("--state", required=True)
    ap.add_argument("--version", default="unknown")
    ap.add_argument("--keyword", action="append", default=[],
                    help="verification: txt must contain at least one keyword (case-insensitive)")
    ap.add_argument("--source-page", default=None)
    ap.add_argument("--notes", default="")
    ap.add_argument("--min-chars", type=int, default=1200)
    ap.add_argument("--from-file", default=None,
                    help="use a pre-downloaded file (e.g. headless-browser output) instead of fetching url")
    a = ap.parse_args()

    manifest = {
        "id": a.id, "slug": a.slug, "state": a.state,
        "sourcePage": a.source_page or a.url, "docUrl": a.url,
        "docFormat": None, "version": a.version,
        "rawFile": None, "txtFile": None, "chars": 0,
        "fetchedAt": datetime.date.today().isoformat(),
        "status": "missing", "notes": a.notes,
    }
    mpath = ROOT / "texts" / "manifest" / f"{a.slug}.json"

    raw, ctype = None, ""
    if a.from_file:
        raw = pathlib.Path(a.from_file).read_bytes()
    else:
        try:
            req = urllib.request.Request(a.url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read()
                ctype = (r.headers.get("Content-Type") or "").lower()
        except Exception as e:
            # urllib's TLS stack is stricter than curl's; retry via curl before giving up
            import subprocess, tempfile
            tmp = tempfile.NamedTemporaryFile(delete=False)
            cp = subprocess.run(
                ["curl", "-sL", "-A", UA, "--max-time", "40", "-o", tmp.name,
                 "-w", "%{http_code} %{content_type}", a.url],
                capture_output=True, text=True)
            parts = cp.stdout.split(None, 1)
            code = parts[0] if parts else "000"
            if cp.returncode == 0 and code.startswith("2"):
                raw = pathlib.Path(tmp.name).read_bytes()
                ctype = parts[1].lower() if len(parts) > 1 else ""
            else:
                manifest["notes"] = (a.notes + f" | fetch failed: {e}; curl fallback HTTP {code}").strip(" |")
                mpath.write_text(json.dumps(manifest, indent=1))
                print(f"MISSING {a.slug}: fetch failed: {e} (curl fallback HTTP {code})")
                sys.exit(1)

    is_pdf = raw[:5] == b"%PDF-" or "pdf" in ctype
    ext = "pdf" if is_pdf else "html"
    rawfile = ROOT / "texts" / "raw" / f"{a.slug}.{ext}"
    rawfile.write_bytes(raw)
    manifest["docFormat"] = ext
    manifest["rawFile"] = f"texts/raw/{a.slug}.{ext}"

    try:
        text = extract_pdf(raw) if is_pdf else extract_html(raw)
    except Exception as e:
        manifest["status"] = "needs-review"
        manifest["notes"] = (a.notes + f" | extraction failed: {e}").strip(" |")
        mpath.write_text(json.dumps(manifest, indent=1))
        print(f"NEEDS-REVIEW {a.slug}: extraction failed: {e}")
        sys.exit(1)

    txtfile = ROOT / "texts" / f"{a.slug}.txt"
    txtfile.write_text(text)
    manifest["txtFile"] = f"texts/{a.slug}.txt"
    manifest["chars"] = len(text)

    problems = []
    if len(text) < a.min_chars:
        problems.append(f"text too short ({len(text)} chars)")
    # collapse whitespace so PDF extractors that split words across lines
    # don't break phrase matching
    low = re.sub(r"\s+", " ", text.lower())
    if a.keyword and not any(k.lower() in low for k in a.keyword):
        problems.append(f"no verification keyword found ({a.keyword})")
    # bill number digits should appear somewhere
    digits = re.findall(r"\d+", a.id)
    if digits and not any(d in text for d in digits):
        problems.append(f"bill number {digits} not found in text")

    if problems:
        manifest["status"] = "needs-review"
        manifest["notes"] = (a.notes + " | " + "; ".join(problems)).strip(" |")
        mpath.write_text(json.dumps(manifest, indent=1))
        print(f"NEEDS-REVIEW {a.slug}: {'; '.join(problems)}")
        sys.exit(2)

    manifest["status"] = "ok"
    mpath.write_text(json.dumps(manifest, indent=1))
    print(f"OK {a.slug}: {len(text)} chars, {ext}, {a.version}")


if __name__ == "__main__":
    main()
