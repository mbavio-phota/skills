---
name: thermo-nuclear-code-quality-review
description: Run an extremely strict maintainability review for abstraction quality, giant files, and spaghetti-condition growth. Use for a thermo-nuclear code quality review, thermonuclear review, deep code quality audit, or especially harsh maintainability review.
---

# Thermo-Nuclear Code Quality Review

Use this skill for an unusually strict review focused on implementation quality, maintainability, abstraction quality, and codebase health.

Above all, be **ambitious** about code structure. Do not merely identify local cleanup opportunities. Actively search for **code judo**: restructurings that preserve behavior while making the implementation dramatically simpler, smaller, more direct, and more elegant. Prefer deleting complexity over rearranging it; prefer the solution that makes the code feel inevitable in hindsight.

## Core Prompt

> Perform a deep code quality audit of the current branch's changes.
> Rethink how to structure / implement the changes to meaningfully improve code quality without impacting behavior.
> Work to improve abstractions, modularity, reduce spaghetti code, improve succinctness and legibility.
> Be ambitious — if there is a clear path to improving the implementation that involves restructuring some of the codebase, go for it.
> Be extremely thorough and rigorous. Measure twice, cut once.

## Standards

Apply these explicit review rules. Each names a real failure mode; flag it for the reason given, not as a stylistic nit.

0. **Be ambitious about structural simplification.** Look for reframings that make whole branches, helpers, modes, conditionals, or layers disappear entirely — a code-judo move that uses the existing architecture more effectively. If you can delete complexity rather than rearrange it, push hard for that.
1. **Don't let a PR push a file from under 1k lines to over 1k without a very strong reason.** Treat crossing 1000 lines as a strong smell; prefer extracting helpers, subcomponents, or modules. Waive only for a compelling structural reason where the file stays clearly organized.
2. **Don't allow spaghetti growth in existing code.** Be highly suspicious of new ad-hoc conditionals, scattered special cases, or one-off branches inserted into unrelated flows. Prefer pushing logic into a dedicated abstraction, helper, state machine, or module over tangling an existing path. Call out changes that make surrounding code harder to reason about even if they technically work.
3. **Bias toward cleaning the design, not just accepting working code.** If behavior can stay the same while structure becomes meaningfully cleaner, push for the cleaner version. Strongly prefer simplifications that remove moving pieces over refactors that merely spread the same complexity around.
4. **Prefer direct, boring, maintainable code over hacky or magical code.** Treat brittle, ad-hoc, or "magic" behavior as a code-quality problem. Be skeptical of generic mechanisms that hide simple data-shape assumptions. Flag thin abstractions, identity wrappers, or pass-through helpers that add indirection without buying clarity.
5. **Push on type and boundary cleanliness when it affects maintainability.** Question unnecessary optionality, `unknown`, `any`, or cast-heavy code when a clearer type boundary could exist. Prefer explicit typed models or shared contracts over loosely-shaped ad-hoc objects. If a branch relies on silent fallback to paper over an unclear invariant, ask whether the boundary should be made explicit.
6. **Keep logic in the canonical layer and reuse existing helpers.** Call out feature logic leaking into shared paths or implementation details leaking through APIs. Prefer existing canonical utilities over bespoke one-offs. Push code toward the right package/service/module instead of normalizing architectural drift. Before judging a new module / type / error-class clean, **grep the sibling directory** for one that already does the job (`*-backend.ts`, `*-service.py`, `*-client.ts`). Cross-sibling duplication is invisible from the diff alone; the canonical home may already exist one file over.
7. **Treat unnecessary sequential orchestration and non-atomic updates as design smells when the cleaner structure is obvious.** If independent work is serialized for no good reason, ask whether it should run in parallel. If related updates can leave state half-applied, push for a more atomic structure. Don't over-index on micro-optimizations, but do flag avoidable orchestration complexity that adds brittleness.

## Tone and output

Be direct, serious, and demanding about quality — not rude, but don't soften major maintainability issues into mild suggestions. If the code makes the codebase messier, say so. If the implementation missed a dramatic simplification, say that too. Don't flood the review with low-value nits when larger structural issues exist; prefer a few high-conviction comments over a long list of cosmetic notes.

Order findings: structural regressions and missed code-judo first, then spaghetti/branching growth, then boundary/type-contract problems, then file-size/decomposition, then legibility.

Representative phrasing:

- `this pushes the file past 1k lines. can we decompose this first?`
- `this adds another special-case branch into an already busy flow. can we move it behind its own abstraction?`
- `this works, but it makes the surrounding code more spaghetti. let's keep the behavior and restructure.`
- `i think there's a code-judo move here that makes this much simpler. can we reframe so these branches disappear?`
- `this refactor moves complexity around but doesn't delete it. is there a way to make the model itself simpler?`

## Approval Bar

Do not approve merely because behavior seems correct. Treat these as presumptive blockers unless the author justifies them clearly:

- the PR preserves a lot of incidental complexity when there is a plausible code-judo move that would delete it
- the PR pushes a file from below 1000 lines to above 1000 lines
- the PR adds ad-hoc branching that makes an existing flow more tangled
- the PR solves a local problem by scattering feature checks across shared code
- the PR adds an unnecessary abstraction, wrapper, or cast-heavy contract that makes the design more indirect
- the PR duplicates an existing helper or puts logic in the wrong layer when there is a clear canonical home

If those conditions aren't met, leave explicit, actionable feedback and push for a cleaner decomposition.
