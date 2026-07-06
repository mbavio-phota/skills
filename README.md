# skills

Personal [agent skills](https://github.com/vercel-labs/skills) by [@mbavio-phota](https://github.com/mbavio-phota).

[![skills.sh](https://skills.sh/b/martinbavio/skills)](https://skills.sh/martinbavio/skills)

## Install

```bash
npx skills add mbavio-phota/skills
# or a single skill:
npx skills add mbavio-phota/skills --skill tenacious-review
```

## Skills

### Review

| Skill | Description |
|:------|:------------|
| `tenacious-review` | Consolidated local PR review — runs the thermo correctness/security + code-quality rubrics (plus React/studio lenses when the diff touches a web frontend) over the worktree diff, then synthesizes one prioritized, deduped report. Harness-agnostic (Claude Code, Cursor, Codex, …); parallel sub-agents where supported, sequential otherwise. |
| `tenacious-audit` | Whole-tree sibling of `tenacious-review` — audits a full codebase or large subsystem (not a diff) by partitioning the work across subsystem *slices* × review *lenses*, adversarially refuting each finding, then landing a verified, tracked backlog as milestoned tickets plus an inventory doc. Run by hand. |
| `thermo-nuclear-review` | Deep correctness & security branch audit (bugs, breaking changes, security, devex regressions, feature-flag leaks), scoped to the diff. |
| `thermo-nuclear-code-quality-review` | Strict maintainability audit (abstraction quality, giant files, spaghetti-condition growth, boundaries). |
| `fix-greptile-review` | Fetch Greptile's PR comments (inline **and** "Comments Outside Diff"), judge each against the code, fix the valid ones, then commit and push. A trustworthy filter — never a blind apply, never a blanket dismiss. Triggers on "grr"/"greptile"/"fix the PR review comments". |

`tenacious-review` orchestrates the two `thermo-nuclear-*` rubrics as its always-on lenses; `tenacious-audit` applies the same lenses across a whole codebase rather than a single diff.

### Orchestration

| Skill | Description |
|:------|:------------|
| `ship-tickets` | Drive a Linear milestone or ticket group end-to-end into reviewed, Greptile-clean PRs: fan out one implementer per ticket-group (isolated worktrees), run multi-pass **fresh-agent** review with rotating lenses (adversarial break-it → `tenacious-review` rubric → execute-and-trace), open one PR per issue (stacked where they share files), trigger + triage the code-review bot, then report. Stops at PRs — **never merges**. Implementers never review their own work; review depth and the bot re-review are severity-gated. Ships with an optional deterministic `Workflow` script (`ship-tickets.workflow.js`) for the parallel middle. User-invoked. |

`ship-tickets` composes `tenacious-review` (as a review lens) and `fix-greptile-review` (for the bot round), and drives the `implement` skill per ticket-group.

### Linear workflow

| Skill | Description |
|:------|:------------|
| `to-linear-prd` | Synthesizes the current conversation into a PRD and publishes it to Linear as a resource document under an umbrella issue — no interview, just synthesis of what's been discussed. |
| `to-linear-plan` | Turns a Linear-hosted PRD into a multi-phase, tracer-bullet implementation plan saved to `./plans/`, then fills the umbrella issue (single-phase) or creates one child issue per phase (multi-phase). Invoke as `/to-linear-plan <umbrella-issue>`. |

## Attribution

`thermo-nuclear-review` and `thermo-nuclear-code-quality-review` are adapted from the
[Thermos plugin](https://github.com/cursor/plugins/tree/main/thermos) (MIT) — ported to be
harness-agnostic. `tenacious-review` and `tenacious-audit` are original.

## License

MIT
