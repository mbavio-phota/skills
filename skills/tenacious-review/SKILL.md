---
name: tenacious-review
description: "Consolidated local PR review — applies the thermo-nuclear correctness/security and code-quality rubrics (plus React/studio lenses when the diff touches a web frontend) over the worktree diff and synthesizes one prioritized, deduped report. Use only when the user asks for a tenacious review by name; never on your own initiative."
---

A harness that does not list this skill reads this SKILL.md directly from where it was installed (for Claude Code, `~/.claude/skills/tenacious-review/SKILL.md`); do not search for it.

# Tenacious Review

Run one consolidated review of the current worktree by applying several independent review lenses (fresh eyes each), then synthesizing a single prioritized, deduped report. This replaces juggling separate review sessions.

## 1. Establish scope

- **Base ref:** if the user named a base ref, use it; otherwise default to `origin/main`.
- `git fetch origin --quiet`, then compute the diff with the merge-base (three-dot):
  - `git diff <base>...HEAD --stat` (read this; it is small)
  - `git diff <base>...HEAD --name-only`
  - Write the patch to files instead of reading it (`mkdir -p .context/review/diffs` first): `git diff <base>...HEAD > .context/review/patch.diff`, and one slice per changed file, `git diff <base>...HEAD -- <path> > .context/review/diffs/<path with / as __>.diff` (skip deletions, lockfiles and generated output). Never print the whole patch into your context: a large one comes back truncated and every lens rereads it.
- Write `.context/review/index.md`: one line per changed file with its +/- counts from `--stat`, its slice path, and a few words on what changed. This index, not the patch, is what every lens starts from. Reviewers read the current contents of the files themselves, in line ranges.
- **Confirm you're reviewing the intended target, and name it in the report.** Two traps make `<base>...HEAD` review the wrong code: (a) a **merge-commit HEAD** (base merged into the branch) makes the three-dot diff empty or understated even when the branch has real changes; (b) an **open PR** is judged on its *committed* diff, which can diverge from the local worktree (uncommitted edits, an earlier/later draft) — so external findings (Greptile, human reviewers) are about the PR, not your worktree. When a PR exists (`gh pr view --json number,headRefName`) and the user's intent is PR review, review `gh pr diff <n>`. State explicitly which target you reviewed (PR #N / worktree / `<base>...HEAD`), and **never switch diff targets silently** — if step 1's command finds nothing useful, say so and say what you ran instead.
- If the diff is empty, **don't stop yet** — an empty three-dot diff with changes obviously present means you're diffing the wrong target (check (a)/(b) above). Only report "no changes vs `<base>`" once you've confirmed the branch genuinely has none.
- If you are reviewing the result of a **structural recommendation** from a prior pass (an extraction or refactor you advised), re-run the affected lens against it — that new surface has been reviewed by no one.

## 2. Decide which lenses apply

- **Always:** the two thermo-nuclear lenses — `thermo-nuclear-review` (correctness/security) and `thermo-nuclear-code-quality-review` (maintainability).
- **Frontend lenses only if changed files include `web/` paths:**
  - any changed `.ts`/`.tsx`/`.jsx` under `web/` → add `react-doctor`, `vercel-react-best-practices`, `vercel-composition-patterns`
  - any change under `web/apps/studio/**` → add the `studio-review` lens **if that rubric is available in this environment** (it is repo-local; skip it silently when it doesn't exist).
- If the diff is backend-only (no `web/`), skip every frontend lens and say so in the report.

## 2.5 Run the project's fast checks before reading

For the touched surface, run the narrowest relevant typecheck / lint / unit-test / eval command (find them in `package.json` scripts or BUILD; in a repo whose AGENTS.md names a focused check, such as `pnpm verify`, use that), and treat any failure as a finding. Send long output to `.context/review/checks.log` and read its tail, and finish this step before the lenses start: browser tests running alongside several lenses flake under the load. A static read cannot see import-time side-effects, broken test/eval harnesses, or a module that crashes on load — exactly the class that trips `import "server-only"` outside a bundler. Never certify a test or eval as *coverage* without confirming it actually runs.

## 3. Run the lenses

Build the shared context block once and give it verbatim to every lens. It is short on purpose: it points at the material, it does not contain it.

```
### Target
<PR #N / worktree / <base>...HEAD>, base <sha>

### Changed files
<the --stat output>
Index: .context/review/index.md · per-file diffs: .context/review/diffs/ · checks: .context/review/checks.log

### How to read
- Start from the index. Read the diff slice of each file your rubric needs; never the whole patch.diff.
- Read source in line ranges (at most ~300 lines a call), never several whole files in one command.
- The repo's rules: read the headings of its conventions doc (e.g. `grep -n '^## ' docs/conventions.md`) and only the sections this diff touches. Do not cat whole docs.
```

Run each applicable lens as an **independent parallel sub-agent if your harness supports them; otherwise run the lenses sequentially.** Each sub-agent gets the same shared context block, applies exactly one rubric to **only** this diff, and **reports findings only — it must not modify any files or run fixes.** Do not spawn nested sub-agents; every lens is independent.

Give one lens a different *method*, not just a different rubric. Run one lens as an **execute-and-trace** pass: it runs the checks from §2.5, traces one real path through the *installed* dependency versions (`package.json` pins + `node_modules`), and greps sibling modules — so the panel isn't three static readers sharing one blind spot.

For each lens, the instruction is: *"Apply the **`<lens>`** rubric to ONLY this diff (load the `<lens>` skill if your harness has one; otherwise follow that rubric's criteria). Report findings only — do not modify any files.\n\n<shared context block>"*

Lenses:

1. `thermo-nuclear-review` — bugs, breaking changes, security, devex regressions, feature-flag leaks.
2. `thermo-nuclear-code-quality-review` — maintainability, structure, 1k-line rule, spaghetti, boundaries.
3. *(if studio + available)* `studio-review` — studio invariants.
4. *(if React)* `react-doctor`.
5. *(if React)* `vercel-react-best-practices`.
6. *(if React)* `vercel-composition-patterns`.

## 4. Synthesize

Once all lenses have finished, produce **one** report:

- **Verdict** line first (e.g. *Ship / Minor polish / Needs changes / Blocker*).
- **Findings grouped by severity** (Blocker → High → Medium → Low → Nit), **deduped across lenses**. When ≥2 lenses raise the same issue, merge it and mark it **corroborated**. But "≥2 lenses agree ⇒ weight higher" holds only when they reached it by **different methods**. Agreement among same-method static readers is a shared blind spot, not confirmation. Conversely, a runtime/SDK claim **no lens tested** is *unverified* — do not upgrade it to a strength because the code's comment is confident and detailed.
- Each finding: `file:line` + one-line evidence + which lens(es) raised it.
- Drop cosmetic nits when structural/correctness issues dominate.
- Don't restate each lens wholesale — surface the unified verdict, highest-signal findings, and any remaining uncertainty.
