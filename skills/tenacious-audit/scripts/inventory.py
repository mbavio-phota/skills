#!/usr/bin/env python3
"""Phase-1 grounding: inventory a tree and surface its fast-check commands.

Prints three things the audit needs before anyone reads for findings:
  1. the directory layout (slice candidates),
  2. the largest source files (structure-smell candidates),
  3. the fast-check commands found in package.json scripts and Bazel BUILD files —
     which you should then actually RUN (a static read can't see import-time crashes,
     vacuous test harnesses, or SDK behavior only claimed in a comment).

Usage:
    python inventory.py <root> [--top 25] [--ext .ts,.tsx,.py,.js]
"""

import argparse
import json
import re
from pathlib import Path

DEFAULT_EXTS = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java"]
SKIP_DIRS = {".git", "node_modules", "__pycache__", "dist", "build", ".next",
             "bazel-out", ".venv", "venv", "vendor", "target"}


def iter_source_files(root: Path, exts):
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if any(part in SKIP_DIRS for part in p.relative_to(root).parts):
            continue
        if p.suffix in exts:
            yield p


def package_json_scripts(root: Path):
    """Return {package.json path: {script: command}} for every package.json in the tree."""
    out = {}
    for pj in root.rglob("package.json"):
        if any(part in SKIP_DIRS for part in pj.relative_to(root).parts):
            continue
        try:
            data = json.loads(pj.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        scripts = data.get("scripts", {})
        # Keep the ones that look like fast checks.
        interesting = {
            k: v for k, v in scripts.items()
            if re.search(r"lint|typecheck|type-check|tsc|test|check|eval|pyright", k, re.I)
        }
        if interesting:
            out[str(pj.relative_to(root))] = interesting
    return out


def bazel_test_targets(root: Path, limit=40):
    """Rough list of BUILD files that declare test targets (candidate fast checks)."""
    hits = []
    for build in root.rglob("BUILD"):
        if any(part in SKIP_DIRS for part in build.relative_to(root).parts):
            continue
        try:
            text = build.read_text()
        except OSError:
            continue
        if re.search(r"_test\(|py_test|go_test|ts_test", text):
            hits.append(str(build.relative_to(root)))
        if len(hits) >= limit:
            break
    return hits


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("root")
    ap.add_argument("--top", type=int, default=25, help="how many largest files to show")
    ap.add_argument("--ext", help="comma-separated extensions (default: common source)")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    exts = [e if e.startswith(".") else f".{e}" for e in args.ext.split(",")] \
        if args.ext else DEFAULT_EXTS

    files = list(iter_source_files(root, exts))
    by_size = sorted(files, key=lambda p: p.stat().st_size, reverse=True)

    top_dirs = {}
    for p in files:
        parts = p.relative_to(root).parts
        key = parts[0] if len(parts) > 1 else "(root)"
        top_dirs[key] = top_dirs.get(key, 0) + 1

    print(f"# Inventory of {root}\n")
    print(f"Source files ({', '.join(exts)}): {len(files)}\n")

    print("## Top-level directories (slice candidates)")
    for d, n in sorted(top_dirs.items(), key=lambda kv: kv[1], reverse=True):
        print(f"  {n:5d}  {d}")

    print(f"\n## Largest {args.top} files (structure-smell candidates)")
    for p in by_size[:args.top]:
        loc = sum(1 for _ in p.open(errors="ignore"))
        print(f"  {p.stat().st_size:8d}B  {loc:6d} loc  {p.relative_to(root)}")

    print("\n## Fast-check commands to RUN (package.json)")
    scripts = package_json_scripts(root)
    if scripts:
        for pj, sc in scripts.items():
            print(f"  {pj}")
            for k, v in sc.items():
                print(f"      {k}: {v}")
    else:
        print("  (none found)")

    print("\n## Bazel BUILD files with test targets")
    targets = bazel_test_targets(root)
    if targets:
        for t in targets:
            print(f"  {t}")
    else:
        print("  (none found)")

    print("\nNext: RUN the fast checks above. Treat any failure as a finding.")


if __name__ == "__main__":
    main()
