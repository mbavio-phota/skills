#!/usr/bin/env python3
"""Generate self-contained ticket payloads from a merged findings dataset.

Why this exists: LLMs truncate and paraphrase multi-KB issue bodies when asked to
re-type them. So we render the ticket text DETERMINISTICALLY here, write one file per
ticket, and let executor agents create each ticket verbatim from its file. Issues are
joined back to findings by a unique title recorded in index.json.

Input: a merged findings JSON array (see references/schemas.md). Each element with
status == "ticketed" becomes a ticket. Refuted/dropped rows are skipped (they live in
the inventory doc, not the tracker).

Usage:
    python build_tickets.py --findings merged.json --out tickets/
    python build_tickets.py --findings merged.json --out tickets/ --app-context context.md

The optional --app-context file is appended verbatim to every ticket as the standing
"context for a zero-context agent" block (what the app is, which docs to read, the
typecheck/test commands, and the line-drift caveat).
"""

import argparse
import json
import re
import sys
from pathlib import Path

# severity -> tracker priority, and type -> label. Kept here so the mapping is applied
# once, deterministically, rather than re-decided by each ticket agent.
SEVERITY_TO_PRIORITY = {
    "blocker": "Urgent",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
}

# type -> execution-phase milestone number. Milestones encode DO-ORDER (safety net before
# refactors), not severity/type — those are carried by priority + label.
TYPE_TO_PHASE = {
    "security": 1,
    "bug": 2,
    "test-gap": 3,
    "tech-debt": 4,
    "code-smell": 5,
    "perf": 5,
    "improvement": 6,
    "a11y": 6,
}

PHASE_NAMES = {
    1: "Security / auth hardening",
    2: "Confirmed correctness bugs",
    3: "Test & CI safety net",
    4: "Structural decomposition & dead code",
    5: "Duplication / smell cleanup",
    6: "Polish / a11y / low-priority",
}


def slugify(title: str, existing: set) -> str:
    """Stable, filesystem-safe, unique slug from a ticket title."""
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60] or "finding"
    slug = base
    n = 2
    while slug in existing:
        slug = f"{base}-{n}"
        n += 1
    existing.add(slug)
    return slug


def render_body(f: dict, app_context: str) -> str:
    """Render a self-contained ticket body from a single finding dict."""
    loc = f.get("file", "unknown")
    if f.get("line"):
        loc = f"{loc}:{f['line']}"

    lines = [
        f"**Location:** `{loc}`",
        f"**Severity:** {f.get('severity', 'unknown')}  |  "
        f"**Type:** {f.get('type', 'unknown')}  |  "
        f"**Confidence:** {f.get('confidence', 'unknown')}",
        "",
        "## Evidence",
        "```",
        f.get("evidence", "(no evidence captured)"),
        "```",
        "",
        "## Suggested fix",
        f.get("suggestion", "(no suggestion captured)"),
    ]

    verdict = f.get("verdict")
    if verdict:
        lines += [
            "",
            "## How verified",
            f"Adversarial refuter verdict: **{verdict.get('verdict', 'unknown')}**.",
            verdict.get("reason", ""),
        ]

    if f.get("effort"):
        lines += ["", f"**Effort estimate:** {f['effort']}"]
    if f.get("mergedCount", 1) > 1:
        lines += [f"_Merged from {f['mergedCount']} raw findings._"]

    lines += [
        "",
        "---",
        "> **Context for a zero-context agent.** Line numbers may have drifted since the "
        "audit — re-confirm the evidence at HEAD before editing.",
    ]
    if app_context:
        lines += ["", app_context.rstrip()]

    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--findings", required=True, help="merged findings JSON array")
    ap.add_argument("--out", required=True, help="output directory for ticket files")
    ap.add_argument("--app-context", help="markdown file appended to every ticket body")
    args = ap.parse_args()

    data = json.loads(Path(args.findings).read_text())
    if not isinstance(data, list):
        print("error: --findings must be a JSON array", file=sys.stderr)
        return 1

    app_context = Path(args.app_context).read_text() if args.app_context else ""
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    slugs: set = set()
    index = []
    ticketed = 0
    for f in data:
        if f.get("status") != "ticketed":
            continue
        title = f.get("title", "").strip()
        if not title:
            print("warning: skipping a ticketed row with no title", file=sys.stderr)
            continue

        slug = slugify(title, slugs)
        severity = f.get("severity", "low")
        phase = f.get("phase") or TYPE_TO_PHASE.get(f.get("type", ""), 6)
        (out / f"{slug}.md").write_text(f"# {title}\n\n" + render_body(f, app_context))
        index.append({
            "slug": slug,
            "title": title,          # unique join key: issue <-> finding
            "file": f"{slug}.md",
            "priority": SEVERITY_TO_PRIORITY.get(severity, "Low"),
            "label": f.get("type", "improvement"),
            "milestone": phase,
            "milestoneName": PHASE_NAMES.get(phase, "Uncategorized"),
        })
        ticketed += 1

    (out / "index.json").write_text(json.dumps(index, indent=2) + "\n")

    milestones = sorted({row["milestone"] for row in index})
    print(f"Wrote {ticketed} ticket file(s) to {out}/")
    print(f"Milestones present: {', '.join(f'{m} ({PHASE_NAMES.get(m)})' for m in milestones)}")
    print(f"Join key: unique `title`. Executors: create each ticket VERBATIM from its file, "
          f"set priority/label/milestone from index.json, then reconcile.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
