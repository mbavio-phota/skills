---
name: ship-tickets
description: "Drive a Linear milestone or ticket group into reviewed, code-review-bot-clean PRs — fan out implementers, run rotating-lens fresh-agent review, open PRs, triage the bot. Never merges. User-invoked."
disable-model-invocation: true
---

# ship-tickets

Drive a set of tickets (a Linear milestone, a project, or an explicit list) from backlog to **reviewed, bot-clean PRs ready for a human to merge**. You are the orchestrator: you plan, spawn workers, route findings, and report — you do not write the feature code yourself, and you **never merge**.

This skill is the wrapper around `implement` + `tenacious-review` + `fix-greptile-review`. Its value is the coordination discipline and the gotchas baked in below.

> **External dependencies.** `tenacious-review` and `fix-greptile-review` ship in this collection. **`implement` does not** — it's expected to be present in your environment. Every reference below is written to invoke `implement` via the Skill tool *when available* and to fall back to an explicit inline TDD procedure when it isn't, so the skill degrades gracefully in a standalone install.

## Inputs to establish first (ask only if ambiguous)

- **Ticket set**: milestone URL/id, project, or an explicit ticket list. Pull each ticket's **full body** (descriptions are long and carry the fix + verifier notes — never work from titles).
- **Base branch** (default `main`).
- **One-PR-per-ticket** (default) vs. combine. Honor the user's convention; most teams want one issue = one PR.
- **Merge policy**: default is *you never merge*. State it back.

## Phase 0 — Preflight (do this BEFORE spawning anything)

Each of these, skipped, silently costs a full poll cycle or a blocked fix round:

1. **Discover the repo's code-review bot mechanics.** Do NOT assume a slash command. Establish, once: its trigger syntax (many bots use an @-mention, not a slash), its bot login, and — critically — its **re-review completion signal**. Many bots **edit their existing summary comment in place** rather than posting a new one; a poller waiting for a *second* comment then hangs forever, so detect completion via the comment's `updated_at` advancing plus the body referencing the new commit SHA. For `photalabs/retina` the bot is **Greptile** and every concrete value is in [`references/greptile-photalabs-retina.md`](references/greptile-photalabs-retina.md) — load it and skip the discovery. `fix-greptile-review` owns the triage.
2. **`gh auth status`** and confirm the remote/owner casing — GraphQL comment posting is owner-case-sensitive (e.g. a mixed-case owner must be spelled exactly, `-R Owner/repo`).
3. **Worktree/branch hygiene.** List `git worktree list`. Plan to prune finished agent worktrees before any fix round — a locked worktree holding a branch **blocks checkout of that branch**. Only prune worktrees *this session* created.
4. **Fast-check commands.** Find the project's narrowest typecheck / test / lint commands (package.json scripts or BUILD) once, and put them in the shared brief.

## Phase 1 — Plan & group

- **Group tickets by file collision.** Two tickets touching the same file → one worker, **stacked branches** (or one combined PR if both are tiny and same-file). Independent tickets → their own worker. This avoids merge conflicts and lost work.
- Use the tracker's **generated branch name** per ticket, verbatim.
- Carry the ticket's own **verifier/"Adjusted" scope notes** into the brief — they are authoritative over the original finding and stop workers from over-building.
- Write a **shared brief file** (git rules, fast-check commands, scope rules, report format) + a **per-group brief** (the ticket bodies + any decision guidance). Workers read files, not a giant prompt.

## Phase 2 — Implement (parallel background agents, isolated worktrees)

Spawn one background agent per group with `isolation: worktree`. Instruct each worker: **invoke the `implement` skill via the Skill tool; if it isn't available in this environment, implement directly** — TDD where practical, run the fast checks continuously, commit. Do not hedge this with vague "or equivalent" wording — name the skill explicitly (a precise named reference is what actually triggers the tool call; a hedge invites the agent to skip it and implement inline). **Bake these rules into every brief:**

- **The implementer does NOT review its own work.** Skip `implement`'s built-in `/code-review` step entirely — an agent grading its own implementation is both complacent (it rationalizes its choices) and the main stall source (that step spawns nested Standards+Spec sub-agents that hang). The implementer's job ends at: implement, add tests, run the fast checks, commit. **All review is done by fresh, independent agents in Phase 3** who never saw the implementer's reasoning. Independence is the point — the fresh reviewer is what catches the regression the author is blind to.
- Branch off the base; **one commit per ticket**; stacked branches for stacked groups.
- **No push, no PR, no tracker updates** — the orchestrator owns those.
- Minimal, idiomatic diffs; no drive-by refactors; mirror sibling patterns.
- End with a structured report: branch(es), SHA(s), files, per-ticket what/why, exact test/typecheck/lint counts, deviations, and any **manual/infra follow-up** that can't be done in code.

If an agent notification shows it paused "waiting on review sub-agents," `SendMessage` it: *"don't block on sub-agents; synthesize, commit, report now."* Expect to do this a few times.

## Phase 3 — Review rounds (multiple fresh agents, rotating lenses)

Every review pass is a **fresh** agent (isolated worktree) that did **not** write the code — never the implementer, never the same reviewer twice in a row. Fresh eyes are the whole value; and rotating the *method* is what makes agreement mean something (three static readers sharing one blind spot is not confirmation).

**Rotating lenses — each pass uses a different method:**
1. **Adversarial break-it** — actively try to break the change with concrete inputs; enumerate bypass/edge classes and actually resolve/execute them against the pinned deps. This is the pass that catches a regression the fix itself introduced.
2. **`tenacious-review` rubric** — apply the `tenacious-review` lenses (thermo-nuclear correctness/security + code-quality, plus `studio-review`/react lenses for `web/` diffs). **Load the skill for its criteria and apply them INLINE — do not run its multi-sub-agent fan-out** (nested sub-agents stall; you want one agent applying the rubric).
3. **Execute-and-trace** — run the project's fast checks, trace one real path through the *installed* dep versions, grep sibling modules for the same pattern. Catches import-time crashes and broken harnesses a static read misses.
4. **(only if a 4th pass is warranted)** targeted re-attack on the specific residual finding.

Every pass: run the fast checks, report a verdict (Ship / Minor polish / Needs changes / Blocker) + findings with `file:line` + fix direction. Do **not** modify files; do **not** spawn nested sub-agents.

**Review budget (per ticket-group):**
- **Substantive / security / behavioral** → **at least 3 passes** (original + 2 re-reviews), **up to 4** (original + 3 re-reviews). Between passes, if the last pass returned a blocking/high finding, route it back to a fix agent first, then re-review with the *next* lens. Run the 4th pass **only if the 3rd still surfaced something worthwhile** ("1 extra if still worth it"); otherwise stop at 3. Never exceed 4.
- **Cosmetic / low-risk** → 1 pass, +1 only if that pass finds something. (Three adversarial passes on a comment/dead-code fix is waste — this is severity-gated like the bot round. Flip it if you want the 3-pass floor everywhere.)
- Each fix→re-review handoff carries the reviewer's exact finding + fix direction; the re-review is always a new agent with the next lens.

## Phase 4 — PRs (base-first for stacks)

- Prune finished agent worktrees (Phase 0.3) so branches are free, then push all branches.
- Create **one PR per ticket**. For a stack, the child PR's `--base` is its **parent branch**, not `main`; create the parent PR first.
- **PR body template**: Linear/issue link · Problem · Fix · Testing (exact counts) · Review verdict · **⚠ Manual follow-ups** · (stacked) "Stacked on #N — merge that first."
- Verify on origin: each branch tip matches the reviewed SHA, and each stack's base is an ancestor of its child (`git merge-base --is-ancestor`).

## Phase 5 — Code-review bot

- Post the discovered trigger on each PR (correct owner casing).
- **Poll correctly for the mechanic you found in Phase 0** — if the bot edits its comment in place, detect via `updated_at` advancing **and the body referencing the new commit SHA / findings clearing**, not by a new-comment count. A naive "wait for a 2nd comment" poller hangs forever.
- **Triage every finding fix-vs-skip against the code** (use `fix-greptile-review`). A skip needs a crisp written rationale (post it as a reply). Watch for the rare **real bug** among the nits — a bot that mostly flags style will occasionally surface a genuine correctness defect.
- Fixes go on the same branches (force-with-lease for rebased stacks).
- **Re-review is severity-gated:**
  - **Cosmetic / low-risk tickets** (dead-code deletion, comment/doc fixes, test-only additions, pure-style changes): **one Greptile pass and done.** Apply any findings, but do **not** re-trigger the bot — a green re-read buys nothing here.
  - **Substantive / security / behavioral tickets**: after applying fixes, **at most ONE re-review** to confirm the finding cleared and no regression was introduced. Detect completion via the Phase-0 mechanic (e.g. in-place comment edit referencing the new SHA), then stop.
  - Never exceed one re-review on any ticket regardless of severity, unless the user explicitly asks.

## Phase 6 — Report (and never merge)

One consolidated message: table of PR # / issue / priority / what shipped / bot verdict; **stacked merge order**; **manual infra follow-ups** called out separately (they block "done" even though code is merged); test/lint status. State plainly that nothing was merged. Update tracker/memory if the user uses them.

## Calibration

- Scale reviewer intensity to severity: High/security tickets get adversarial break-it passes and a re-review; Low/cosmetic get a light pass.
- Use `AskUserQuestion` only for genuine forks (delete-vs-gate, provision-infra-vs-defer). Otherwise pick the reversible default and note it.
- **Fully-deterministic variant** — [`scripts/ship-tickets.workflow.js`](scripts/ship-tickets.workflow.js). Requires opt-in (the `Workflow` tool is explicit-opt-in only). Scout Phases 0–1 **inline first** to build the `args.groups` work-list, then run the script: it encodes Phases 2–4 (implement → multi-pass review+fix → push+PR) as a `pipeline()` over ticket-groups, applying the same Phase-3 review policy. The external bot round (Phase 5) stays in the main loop — an external service's timing isn't part of a deterministic DAG. "Deterministic" means the *orchestration* is fixed and resumable, not the agents' content. The default path is manual background-agent orchestration, which needs no opt-in.

## Non-negotiables

- **Review is always by a fresh agent that did not write the code.** Implementers never review their own work — no exceptions.
- Never merge. Never push infra/prod changes (deliver scripts/docs + flag the manual step).
- One PR = one issue (unless told otherwise). Minimal diffs.
- Verifier/"Adjusted" scope on a ticket wins over the original finding.
- Every branch stays green (typecheck + full suite + lint) at every handoff.
