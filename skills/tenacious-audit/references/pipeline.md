# Pipeline playbook

The phase-by-phase execution guide. Read this after confirming scope, thoroughness,
and tracker target. Each phase says what to do, why, and — where a subagent runs it —
what to put in its prompt.

## Contents

1. Phase 1 — Ground before reading
2. Phase 2 — Partition into slices
3. Phase 3 — Find (slice × lens matrix)
4. Phase 4 — Verify adversarially
5. Phase 5 — Triage quality items
6. Phase 6 — Land it
7. Phase 7 — Completeness critic
8. Fan-out discipline (applies to every phase)

---

## Phase 1 — Ground before reading

Static reading is blind to whole classes of problems: a module that crashes on import,
a test file that runs zero tests and "passes" vacuously, an SDK behavior a code comment
*claims* but that the installed version doesn't actually do. So before anyone reads for
findings, establish ground truth by running the project's own checks.

1. Inventory the tree and file sizes. `scripts/inventory.py <root>` prints the directory
   layout, the largest files (structure smell candidates), and the fast-check commands it
   finds in `package.json` scripts and Bazel `BUILD` files.
2. Actually RUN the fast checks you find — typecheck, lint, unit tests, any eval harness.
   Don't just note that they exist.
3. Treat every failure as a finding, entered in the same schema as everything else. In the
   real run this surfaced a runtime `TimeoutNaNWarning` and confirmed the suite actually
   executed (as opposed to passing vacuously).

Record the exact commands you ran — the tickets will reference them as the "how to verify"
block, and future agents need them.

---

## Phase 2 — Partition into slices

A slice is a unit of review small enough to fit a finder's context. Define each as:

- **path globs** — the explicit files/directories in the slice.
- **context note** — three parts, and all three matter:
  - **(a) invariants & conventions** — what this subsystem guarantees and how it's meant
    to be written. Pull from the repo's own docs (CLAUDE.md, AGENTS.md, architecture/ADR
    docs) rather than inventing them.
  - **(b) known-safe patterns NOT to flag** — deliberate choices that a naive lens will
    "correct." Example: "OutputPanel keeps `referenceImages`/`isDragging` as props on
    purpose to protect a memo boundary — do NOT report it as prop-drilling." Without this,
    finders waste effort re-discovering intentional design and drown the signal.
  - **(c) already-found — do not re-report** — a list that starts empty and grows after
    each pass. In `deep` mode, the second pass gets the first pass's confirmed+refuted
    titles here, so it explores new ground instead of re-surfacing the same items.

Keep slices coherent (one subsystem, not a random file grab-bag) so the context note is
actually true for the whole slice.

---

## Phase 3 — Find (the slice × lens matrix)

Three kinds of finder run here. All return the `finding[]` schema (see schemas.md). Assign
lenses per `references/lenses.md`.

**Per-slice lenses (up to 3 per slice):**
- correctness / security
- maintainability / design
- framework-specific (frontend only — react/next)

**Global scanners (run ONCE across the whole tree, not per slice):**
- file size / structure (giant files, deep nesting)
- suppressions (`eslint-disable`, `ts-ignore`, `any`, `TODO`/`FIXME`)
- dead code (unreferenced exports, unreachable branches)
- dependency audit (outdated / vulnerable / unused deps)
- test-coverage gaps

Use cheap/fast models for the mechanical scanners — they're pattern matches, not judgment.

**End-to-end trace specialists (1–2, strong model) — the differentiator:**
These use a *different method* than static reading, which is why they catch what readers
miss. Give them a strong model.
- **security path-tracer** — follow auth/authz/SSRF concerns across route boundaries,
  not file by file. Trace a request from entrypoint to sink.
- **installed-dependency tracer** — execute and trace against the ACTUAL source in
  `node_modules` (or the vendored/installed dep), not against what a comment or the docs
  claim. This is how you catch "the code assumes the SDK accumulates tokens, but the
  pinned version doesn't."

Each finder writes its JSON to a per-agent file (e.g. `findings/<slice>-<lens>.json`) so
nothing is lost and dedupe can read them all.

---

## Phase 4 — Verify adversarially (the quality gate)

Nothing becomes a ticket without passing this gate.

1. **Mechanical dedupe first.** Bucket findings by `file` + finding-family (type +
   normalized title) + line proximity. Collapse near-identical reports into one, keeping
   the highest-confidence evidence. Do this with a script, not an LLM — it's deterministic.
2. **One refuter per bug/security finding** (per finding for `standard`; a 3-vote majority
   for blocker/high in `deep`). The refuter prompt is adversarial on purpose:

   > You are trying to REFUTE this finding, not confirm it. Read the cited file at the
   > cited line and the surrounding context. If the finding is wrong, or the evidence
   > doesn't support the claimed severity, say so. When genuinely uncertain, lean
   > refuted — a false ticket costs more than a missed nitpick. Return the `verdict`
   > schema: confirmed / adjusted (give corrected severity and title) / refuted (give
   > the reason it doesn't hold).

3. **Record every verdict, including refuted.** Refuted findings stay in the inventory
   dataset with their reason so nobody investigates them again — but they never become
   tickets (rule 5 in SKILL.md). In the real run this gate killed 11 false positives and
   corrected ~26 overclaimed severities/titles.

Only bug/security findings need the adversarial refuter. Quality items go to triage next.

---

## Phase 5 — Triage the quality items

Non-bug items — code-smell, tech-debt, test-gap, perf, a11y, improvement — go through a
per-slice triage judge rather than the refuter. The judge:

- merges duplicates that survived mechanical dedupe (semantic near-duplicates),
- spot-checks each item against HEAD (the finding may cite a stale line),
- drops the factually-wrong and the too-trivial (not worth a ticket),
- assigns an **effort estimate** S / M / L,

and returns the `triage` schema: `{ kept: [...], droppedCount, dropRationale }`. Keep the
`droppedCount` and rationale — the completeness critic reports them so nothing vanishes
silently.

---

## Phase 6 — Land it

See `references/landing.md` for the full mechanics. In short: merge every confirmed/
adjusted finding and every kept triage item into one JSON dataset, generate the markdown
inventory and optional HTML artifact, then generate ticket payloads deterministically
(`scripts/build_tickets.py`), file them in waves, and reconcile.

---

## Phase 7 — Completeness critic

The last step, and non-negotiable — a silent gap erodes trust in the whole audit. Ask and
answer, in the open:

- Which slice or lens produced NO output? (crashed? timed out? genuinely clean?)
- What remains unverified — did any finding skip the refuter because of a cap or failure?
- What was capped or dropped, and how many? (pull the `droppedCount`s from triage.)

Put this in the inventory doc and tell the user directly. Never bury it.

---

## Fan-out discipline (every phase)

Launch subagents in **waves of ~5 concurrent**, not one big parallel blast. A ~34-agent
blast tripped a server-side burst rate-limiter that killed 30 agents mid-work and forced a
recovery pass. Waves of 5 finish reliably. Between waves, collect outputs to disk so a
failed wave is cheap to retry. This throttle applies to finders, verifiers, triagers, and
the ticket create/update agents alike.
