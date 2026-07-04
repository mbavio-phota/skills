---
name: tenacious-audit
description: >-
  Whole-tree sibling of tenacious-review. Audits a full codebase or large subsystem (not a
  diff) and lands a verified, tracked backlog: findings partitioned by subsystem x lens,
  adversarially refuted, then filed as milestoned tickets plus an inventory doc. Run by hand.
disable-model-invocation: true
---

# Tenacious Audit

A codebase is larger than one context window, so no single pass can review it: a lone
read-through misses things and hallucinates others. The winning move is to partition the
work two ways — by subsystem (a **slice**) and by perspective (a **lens**) — carry every
finding as **structured data** end to end, and make each one survive an adversarial
**refute** before it becomes a ticket. The lenses are borrowed from existing review skills;
this skill's value is the orchestration, the data discipline, and the refute gate around
them. **It orchestrates lenses — it does not replace them.**

Reach for a neighbor instead when:
- the target is a **diff / PR / branch** -> `tenacious-review` (one prioritized report, no tickets).
- you want **read-only implementation plans** for another agent, not a tracked backlog -> `improve`.

## Parameters — settle these before you start

Read from the invocation; infer and state your assumption for anything unspecified.

- **scope** — the whole app, or a named subsystem / set of path globs. Default: whole tree.
- **thoroughness** — `standard` (one pass, 1 refuter per finding) or `deep` (two passes with
  a growing "already-found" list, and a 3-vote majority refuter for blocker/high findings).
- **tracker** — a Linear project / GitHub issues / `markdown-only` (inventory doc + artifact,
  no tickets). Default: ask once, up front.

## Operating rules — the payload, and they override intuition

These came from a real run where the naive approach broke. Follow them from the start.

1. **Waves, not blasts.** Launch sub-agents in **waves of ~5 concurrent**, never one big
   parallel fan-out — a ~34-agent blast tripped a server-side burst rate-limiter that killed
   30 of them mid-work and forced a recovery pass. Applies to finders, refuters, triage
   judges, AND ticket agents. Collect each wave's output to disk so a failed wave is cheap to retry.
2. **Match model to job.** Cheap/fast models for mechanical scanners (file size,
   suppressions, dead code); strong models for adversarial refutation and end-to-end traces.
3. **Findings are DATA, not prose.** Every finder, refuter, and triage judge returns the fixed
   JSON in `references/schemas.md`. Structured findings can be deduped, verified, counted, and
   turned into tickets mechanically; prose cannot.
4. **Verify before ticketing; refuted != ticket.** A finding becomes a ticket only after an
   adversarial refuter confirms or adjusts it. Refuted findings are *recorded in the inventory*
   (so nobody re-raises them) but never filed.
5. **Never make an LLM re-type a ticket body.** LLMs truncate and paraphrase multi-KB text.
   Generate ticket payloads *deterministically* from the finding JSON with
   `scripts/build_tickets.py`, write them to disk, then have executor agents create each
   ticket VERBATIM from its file. Join issues<->findings by a unique title.
6. **Reconcile, don't trust.** After bulk create/update, list the tracker, verify counts, and
   fetch **one full record** to confirm the body stored intact (list APIs truncate).
7. **Surface what you couldn't do.** A silent gap is worse than a reported one — the final
   completeness critic (phase 7) names every empty cell, everything unverified, and anything
   capped or dropped.

## The pipeline

Seven phases, walked in order. Detailed per-phase agent prompts and rationale live in
`references/pipeline.md`; read it after settling the parameters.

1. **Ground before reading.** Static reads are blind to import-time crashes, vacuous test
   harnesses, and behavior a comment only *claims*. Inventory the tree + file sizes
   (`scripts/inventory.py`), find the project's fast checks (typecheck / lint / unit-test /
   eval — usually `package.json` scripts or BUILD targets), and **actually run them**. Record
   the exact commands (tickets reuse them as the "how to verify" block).
   **Done =** checks run (or their absence recorded as a finding) and the file-size inventory captured.

2. **Partition into slices.** Each slice = explicit path globs + a **context note** with three
   parts: (a) invariants/conventions (from the repo's own docs); (b) **known-safe patterns NOT
   to flag** (e.g. "this component keeps props to protect a memo boundary — not prop-drilling");
   (c) an **"already found — do not re-report" list**, seeded empty and grown after every wave.
   Part (c) is the cross-pass dedupe.
   **Done =** every in-scope path is in exactly one coherent slice, each with all three note parts.

3. **Find — the slice x lens matrix.** Per slice, up to three lenses (correctness/security,
   maintainability/design, and for frontend a framework lens); PLUS global scanners run once
   over the whole tree (size, suppressions, dead code, deps, test gaps — cheap models); PLUS
   1-2 **end-to-end trace specialists** that use a *different method* than static reading (a
   security path-tracer across route boundaries, and an execute-and-trace pass against the
   INSTALLED dependency source, not the code's claims about it). Lens catalog + graceful
   degradation: `references/lenses.md`. Every finder returns the `finding` schema and nothing else.
   **Done =** every (slice x applicable lens) cell and every scanner returned or is recorded empty.

4. **Refute — the quality gate.** Mechanical dedupe first (bucket by file + finding-family +
   line proximity). Then one refuter per bug/security finding, told to *try to REFUTE it*, lean
   refuted when uncertain, returning the `verdict` schema (confirmed / adjusted / refuted). The
   refuter prompt is in `references/pipeline.md`. A real run here killed 11 false positives and
   corrected ~26 overclaimed ones.
   **Done =** every bug/security finding carries a verdict; refuted ones are marked record-only.

5. **Triage the quality items.** Non-bug items (smell, tech-debt, test-gap, perf, a11y,
   improvement) skip the refuter and go to per-slice triage judges: merge duplicates,
   spot-check against HEAD, drop the wrong/too-trivial, assign effort (S/M/L). Return the
   `triage` schema; surface `droppedCount` — never drop silently.
   **Done =** every non-bug finding is kept-with-effort or dropped-with-reason.

6. **Land it.** Merge confirmed/adjusted bugs + kept quality items into one JSON dataset (mark
   ticketed rows `status:"ticketed"`), then produce the outputs the `tracker` dial selects:
   always a markdown inventory; optionally a filterable HTML artifact; and — unless
   markdown-only — self-contained tickets grouped into execution-phase milestones. Follow
   `references/landing.md`: severity->priority and type->label maps, the six milestones with
   "Done =" lines, ticket anatomy, and the reconcile checklist. Generate ticket bodies with
   `scripts/build_tickets.py` (rule 5), file them in waves, then reconcile (rule 6).
   **Done =** inventory written; tickets created and reconciled against the dataset count.

7. **Completeness critic.** Never skipped. Report openly (rule 7): which slice/lens produced no
   output, what remains unverified, what was capped or dropped and how much.
   **Done =** all three questions answered in the final summary, even when the answer is "none".

## Bundled resources

- `references/pipeline.md` — full phase-by-phase playbook, including the adversarial refuter prompt.
- `references/lenses.md` — lens catalog, which skills to call, rubric fallback when a lens skill is absent, and the thoroughness knob.
- `references/schemas.md` — the `finding` / `verdict` / `triage` JSON and the merged-dataset contract.
- `references/landing.md` — severity/type maps, execution-phase milestones, ticket anatomy, reconciliation.
- `scripts/build_tickets.py` — render self-contained ticket payloads deterministically from merged findings (rule 5). `--help` for usage.
- `scripts/inventory.py` — phase-1 grounding: tree, largest files, and fast-check commands.
- `evals/evals.json` — trigger/behavior tests, including a should-NOT-fire diff-review negative case.
