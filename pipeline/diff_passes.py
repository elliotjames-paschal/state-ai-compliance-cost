#!/usr/bin/env python3
"""Compare two independent coding passes for a bill; promote the result.

  python3 pipeline/diff_passes.py <slug>            # report material differences
  python3 pipeline/diff_passes.py <slug> --promote  # write coding/coded/<slug>.json

Material fields (what adjudication is for): category, family, duplicateOf,
duties, params, and the numeric exposure facts (penaltyMax, cureDays).
Free-text phrasing (appliesTo, enforcer/penaltyUnit wording, sources, flags) is
NOT material — the original sweep wasted 40 adjudications on enforcer wording
before learning this.

--promote picks, in order: <slug>.final.json (an adjudicated result) if present,
else pass1 when the passes materially agree. If they disagree and no final
exists, it refuses — adjudicate first (see CODING.md appendix for the prompt).
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXPOSURE_KEYS = ("penaltyMax", "cureDays")


def norm(e):
    exp = e.get("exposure") or {}
    return {
        "category": e.get("category", ""), "family": e.get("family", ""),
        "duties": sorted(e.get("duties") or []), "dup": e.get("duplicateOf"),
        "params": {k: str(v) for k, v in sorted((e.get("params") or {}).items())},
        "exposure": {k: str(exp[k]) for k in EXPOSURE_KEYS if k in exp},
    }


def diffs(a, c):
    A = sorted(a["entries"], key=lambda x: x.get("segment") or "")
    C = sorted(c["entries"], key=lambda x: x.get("segment") or "")
    if len(A) != len(C):
        return [f"segment count: {len(A)} vs {len(C)}"]
    out = []
    for x, y in zip(A, C):
        nx, ny, tag = norm(x), norm(y), x.get("segment") or "main"
        for k in nx:
            if nx[k] != ny[k]:
                out.append(f"{tag}: {k} — {nx[k]!r} vs {ny[k]!r}")
    return out


def main():
    slug = sys.argv[1]
    promote = "--promote" in sys.argv
    passes = ROOT / "coding" / "passes"
    final = passes / f"{slug}.final.json"
    p1, p2 = passes / f"{slug}.pass1.json", passes / f"{slug}.pass2.json"
    a, c = json.load(open(p1)), json.load(open(p2))
    d = diffs(a, c)

    if final.exists():
        print(f"{slug}: adjudicated final exists" + (f" ({len(d)} raw pass differences)" if d else ""))
        src = final
    elif not d:
        print(f"{slug}: passes materially agree")
        src = p1
    else:
        print(f"{slug}: {len(d)} MATERIAL DISAGREEMENT(S) — adjudicate before promoting:")
        for x in d:
            print("  ", x)
        sys.exit(1)

    if promote:
        data = json.load(open(src))
        data["resolution"] = "final" if src == final else "pass1"
        out = ROOT / "coding" / "coded" / f"{slug}.json"
        out.write_text(json.dumps(data, indent=1))
        print(f"promoted {src.name} -> {out}")


if __name__ == "__main__":
    main()
