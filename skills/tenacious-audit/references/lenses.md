# Lens assignment

The lenses are borrowed from existing review skills — this skill's job is to orchestrate
them, not re-implement them. **Call the real lens skill when it's installed; degrade to
the rubric criteria below when it isn't.** Never block the audit because a lens skill is
missing; a rubric-driven finder still returns the same `finding[]` schema.

## How to call a lens skill

A finder subagent for a slice+lens should, in its prompt:

1. Be told which lens skill to invoke (by name) and to follow its methodology.
2. Be told to return findings in the fixed `finding[]` schema regardless of how the lens
   skill normally formats output — the schema is this skill's connective tissue.
3. Get the slice's context note (invariants, known-safe patterns, already-found list) so
   it doesn't flag intentional design or re-report known items.

If the named lens skill isn't available, the finder falls back to the rubric criteria for
that lens (below) and proceeds.

## Lens catalog

Availability varies by repo. Probe for these; use whichever exist. The rubric column is
the fallback when the skill is absent.

| Lens | Preferred skill(s) | Rubric fallback criteria |
|------|--------------------|--------------------------|
| Correctness / security | `thermo-nuclear-review` | Bugs, breaking changes, security holes (authz, injection, SSRF, secret handling), devex regressions, feature-gate leaks. |
| Maintainability / design | `thermo-nuclear-code-quality-review`, `swe-design-review` | Abstraction quality, giant files, spaghetti conditionals, DRY violations, separation of concerns, leaky interfaces, layering. |
| Framework (frontend) | `react-doctor`, `vercel-react-best-practices`, `vercel-composition-patterns` | Hook misuse, memoization correctness, effect/render bugs, boolean-prop proliferation, bundle/perf anti-patterns, a11y. |
| Repo-specific conventions | a repo's own review skill (e.g. `studio-review`) | The invariants/tokens/architecture docs the repo documents for itself. |

## Global scanners (run once across the whole tree)

These are mechanical — assign cheap/fast models. No lens skill needed; the criterion IS
the scan:

- **file size / structure** — flag files above a size threshold, deeply nested dirs.
- **suppressions** — every `eslint-disable`, `ts-ignore`, `@ts-expect-error`, bare `any`,
  and `TODO`/`FIXME`/`HACK`. Each is a potential swept-under-rug finding.
- **dead code** — unreferenced exports, unreachable branches, unused files.
- **dependency audit** — outdated, known-vulnerable, or unused dependencies.
- **test-coverage gaps** — modules with no corresponding test, or tests that assert
  nothing.

## End-to-end trace specialists (strong model, 1–2 total)

These are the highest-value finders because they use a *method static readers can't*:

- **security path-tracer** — trace a request from entrypoint through route boundaries to
  its sink, following auth/authz/SSRF concerns across files. A per-file lens sees each
  handler; the tracer sees the *path*, which is where authz holes live.
- **installed-dependency tracer** — read and, where feasible, execute against the ACTUAL
  installed source (`node_modules`, vendored deps, the pinned version) rather than what a
  comment or the public docs claim. This is how you catch a code path that relies on SDK
  behavior the pinned version doesn't have.

## Thoroughness knob → lens count

- **standard** — per-slice lenses as applicable, global scanners once, 1 trace specialist,
  1 refuter per finding.
- **deep** — two finder passes (second pass seeded with the growing already-found list),
  both trace specialists, and a 3-vote majority refuter for blocker/high findings.
