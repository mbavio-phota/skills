export const meta = {
  name: 'ship-tickets',
  description: 'Deterministic ticket-group pipeline: implement → fresh-agent review → fix+re-review → push+PR. One group per item; stacked pairs are one group. The external code-review bot round is handled by the main loop AFTER this returns (external timing is not deterministic).',
  phases: [
    { title: 'Implement' },
    { title: 'Review' },
    { title: 'Fix' },
    { title: 'PR' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT CONTRACT — build `args` inline BEFORE calling Workflow (scout first):
//   Phase 0/1 of the skill (fetch ticket bodies, discover bot trigger, group by
//   file collision) runs in the main loop; its output is this args object.
//
// args = {
//   baseBranch: 'main',
//   fastChecks: 'cd web && pnpm --filter @phota/studio typecheck && ... test:run && ... lint',
//   groups: [
//     {
//       key: 'feedback',                 // short label
//       severity: 'security',            // 'security' | 'behavioral' | 'cosmetic'
//       stacked: true,                   // >1 ticket sharing a file → stacked branches
//       tickets: [                       // in stack order (base first)
//         { id: 'WEB-188', branch: 'mbavio/web-188-...', base: 'main',            body: '<full ticket text + verifier/Adjusted scope>' },
//         { id: 'WEB-199', branch: 'mbavio/web-199-...', base: 'mbavio/web-188-...', body: '<full ticket text>' },
//       ],
//     },
//     ...
//   ],
// }
// ─────────────────────────────────────────────────────────────────────────────

const BASE = args.baseBranch || 'main'
const FAST = args.fastChecks || '(no fast-check command provided)'
const groups = args.groups || []

// Schemas force structured returns so later stages consume data, not prose.
const IMPL_SCHEMA = {
  type: 'object',
  required: ['ok', 'branches'],
  properties: {
    ok: { type: 'boolean' },
    branches: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'branch', 'sha'],
        properties: {
          id: { type: 'string' }, branch: { type: 'string' }, sha: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          tests: { type: 'string' },        // exact counts
          manualFollowup: { type: 'string' }, // infra step that can't be done in code, or ''
        },
      },
    },
    notes: { type: 'string' },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  required: ['verdict', 'findings'],
  properties: {
    verdict: { type: 'string', enum: ['ship', 'minor', 'needs-changes', 'blocker'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'file', 'summary'],
        properties: {
          severity: { type: 'string', enum: ['blocker', 'high', 'medium', 'low', 'nit'] },
          file: { type: 'string' }, line: { type: 'number' },
          summary: { type: 'string' }, fixDirection: { type: 'string' },
        },
      },
    },
  },
}

const PR_SCHEMA = {
  type: 'object',
  required: ['ok', 'prs'],
  properties: {
    ok: { type: 'boolean' },
    prs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'url'],
        properties: { id: { type: 'string' }, url: { type: 'string' }, base: { type: 'string' }, stackedOn: { type: 'string' } },
      },
    },
  },
}

// Review budget is severity-gated, in TOTAL passes (original + re-reviews):
//   substantive/security/behavioral → min 3, max 4 (i.e. original + 2..3 re-reviews)
//   cosmetic/low-risk               → min 1, max 2 (1 pass, +1 only if it finds something)
const budgetFor = (sev) => (sev === 'cosmetic' ? { min: 1, max: 2 } : { min: 3, max: 4 })

const implementPrompt = (g) => `Implement the ticket(s) below in isolated worktree(s). Read your shared brief file first if one was provided.

Invoke the \`implement\` skill via the Skill tool. If it is not available in this environment, implement directly: TDD where practical, run the fast checks continuously, commit.

Base branch: ${BASE}. Fast checks (must be green before you commit): ${FAST}

Rules:
- The verifier/"Adjusted" scope in a ticket body is AUTHORITATIVE over the original finding — do not over-build.
- One commit per ticket. ${g.stacked ? 'STACKED: implement ticket 1 on its base and commit; then checkout ticket 2 (branch off ticket 1) and implement it. Keep them as separate branches/commits.' : 'Single branch off ' + BASE + '.'}
- Add tests for the fixed behavior. Minimal, idiomatic diffs. Mirror sibling patterns.
- DO NOT review your own work (a fresh agent reviews it next). DO NOT push, open PRs, or touch the tracker.
- Return structured: per branch → id, branch name, commit sha, files, exact test counts, and any manual/infra follow-up that can't be done in code.

Tickets:
${g.tickets.map((t) => `### ${t.id}  (branch: ${t.branch}, base: ${t.base})\n${t.body}`).join('\n\n')}`

// Rotating lenses — each review PASS uses a different METHOD so agreement means
// something (three static readers sharing one blind spot is not confirmation).
const LENSES = [
  { key: 'adversarial', desc: 'ADVERSARIAL break-it: actively try to break the change with concrete inputs; enumerate bypass/edge classes and actually resolve/execute them against the pinned deps.' },
  { key: 'tenacious', desc: 'Apply the `tenacious-review` rubric INLINE — load the skill for its criteria (thermo-nuclear correctness/security + code-quality, plus studio-review/react lenses for web/ diffs) and apply them yourself. Do NOT run its multi-sub-agent fan-out.' },
  { key: 'execute-trace', desc: 'EXECUTE-AND-TRACE: run the fast checks, trace one real path through the INSTALLED dep versions, and grep sibling modules for the same pattern (catches import-time crashes / broken harnesses a static read misses).' },
  { key: 're-attack', desc: 'Targeted RE-ATTACK on the specific residual finding(s) from the prior pass.' },
]

const reviewPrompt = (g, impl, lens, passNo) => `You are a FRESH reviewer (pass #${passNo}, lens: ${lens.key}). You did NOT write this code and are not the previous reviewer. Review the branch(es) for ticket group "${g.key}" (severity: ${g.severity}).

Method for THIS pass: ${lens.desc}
Run the project's fast checks: ${FAST}

For a stacked group, review the child branch's three-dot diff vs ${BASE} so you see all commits, then attribute findings per ticket. Confirm each stacked base is an ancestor of its child.

Branches to review: ${impl.branches.map((b) => `${b.id}=${b.branch}@${b.sha}`).join(', ')}

Do NOT modify files. Do NOT spawn nested sub-agents — apply the rubric inline yourself. Return verdict (ship/minor/needs-changes/blocker) + findings (severity, file:line, summary, fixDirection).`

const fixPrompt = (g, impl, rev) => `Apply fixes for the review findings on ticket group "${g.key}". Branches: ${impl.branches.map((b) => b.branch).join(', ')}.

Findings to address (fix the valid ones; for any you skip, give a crisp rationale):
${rev.findings.map((f) => `- [${f.severity}] ${f.file}${f.line ? ':' + f.line : ''} — ${f.summary}${f.fixDirection ? ' → ' + f.fixDirection : ''}`).join('\n')}

Minimal diffs. Keep fast checks green (${FAST}). ${g.stacked ? 'If you amend the base branch, rebase the child onto the new base tip and push it with --force-with-lease.' : ''} Commit on the same branch(es). Return the same structured shape as the implementer (updated shas).`

const prPrompt = (g, impl) => `Push and open PR(s) for ticket group "${g.key}". Use gh with the canonical owner casing.

For each branch (base-first for stacks): push, then \`gh pr create\` with --base = the ticket's base (${g.stacked ? "the child's base is its PARENT branch, not " + BASE : BASE}). PR body template: issue link · Problem · Fix · Testing (exact counts) · Review verdict · ⚠ Manual follow-ups · (stacked) "Stacked on #<parent> — merge that first."

Branches: ${impl.branches.map((b) => `${b.id}=${b.branch}@${b.sha}${b.manualFollowup ? ' [manual: ' + b.manualFollowup + ']' : ''}`).join(', ')}

Do NOT merge. Verify each pushed tip matches the sha above. Return per-ticket { id, url, base, stackedOn }.`

// ── The deterministic pipeline: one atom per ticket-GROUP ────────────────────
const results = await pipeline(
  groups,

  // Stage 1 — implement (isolated worktree so parallel groups don't collide)
  (g) => agent(implementPrompt(g), { label: `impl:${g.key}`, phase: 'Implement', isolation: 'worktree', schema: IMPL_SCHEMA }),

  // Stage 2 — multi-pass review + fix loop. Every pass is a FRESH agent (never the
  // author, never the same reviewer twice) using the NEXT rotating lens. Bounded by
  // the severity budget: min passes always run (even if clean, for independent
  // confidence); extra passes beyond the min run only while findings remain worthwhile.
  async (impl, g) => {
    if (!impl || !impl.ok) return null
    const { min, max } = budgetFor(g.severity)
    const worthwhile = (v) =>
      !!v && (v.verdict === 'needs-changes' || v.verdict === 'blocker' ||
        (v.findings || []).some((f) => f.severity === 'blocker' || f.severity === 'high'))

    let cur = impl
    let rev = null
    let pass = 0
    while (pass < max) {
      const lens = LENSES[pass < LENSES.length ? pass : LENSES.length - 1]
      rev = await agent(reviewPrompt(g, cur, lens, pass + 1), {
        label: `review#${pass + 1}(${lens.key}):${g.key}`, phase: 'Review', isolation: 'worktree', schema: REVIEW_SCHEMA,
      })
      pass += 1
      if (worthwhile(rev)) {
        // Fix, then loop to re-review with the NEXT lens (a new fresh agent).
        const fixed = await agent(fixPrompt(g, cur, rev), {
          label: `fix#${pass}:${g.key}`, phase: 'Fix', isolation: 'worktree', schema: IMPL_SCHEMA,
        })
        if (fixed && fixed.ok) cur = fixed
        continue // always re-review after a fix (still bounded by max)
      }
      if (pass >= min) break // clean pass and minimum met → stop
    }
    return { impl: cur, rev, passes: pass }
  },

  // Stage 3 — push + open PR(s), base-first for stacks
  (r, g) => {
    if (!r || !r.impl || !r.impl.ok) return null
    return agent(prPrompt(g, r.impl), { label: `pr:${g.key}`, phase: 'PR', schema: PR_SCHEMA })
      .then((pr) => ({ key: g.key, severity: g.severity, review: r.rev, passes: r.passes, pr, branches: r.impl.branches }))
  },
)

// Hand back a compact roster for the main loop to drive the external bot round
// (trigger the code-review bot, poll for its in-place update, triage, and — per
// severity — do at most one re-review for security/behavioral, zero for cosmetic).
return {
  groups: results.filter(Boolean).map((x) => ({
    key: x.key,
    severity: x.severity,
    reviewPasses: x.passes,
    verdict: x.review && x.review.verdict,
    openFindings: (x.review && x.review.findings || []).filter((f) => f.severity === 'blocker' || f.severity === 'high'),
    prs: (x.pr && x.pr.prs) || [],
    manualFollowups: x.branches.filter((b) => b.manualFollowup).map((b) => ({ id: b.id, step: b.manualFollowup })),
  })),
}
