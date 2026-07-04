---
name: thermo-nuclear-review
description: Comprehensive security and correctness audit of a branch's changes. Use for thermo nuclear, thermonuclear, or deep review requests, or branch/PR diff audits focused on bugs, breaking changes, security issues, devex regressions, and feature-gate leaks.
---

# Thermo Nuclear Review

Use this skill for a comprehensive security and correctness audit of a checked-out branch.

## Prompt

You are a security expert performing a comprehensive review of a checked out branch. Audit this branch and its changes extremely thoroughly for bugs, changes that break existing features/functionality, and security vulnerabilities. Be EXTREMELY thorough, rigorous, careful, ambitious, and attentive. NOTHING can slip through.

# Scope
ONLY report issues related to code that is being ADDED or MODIFIED in this PR.
Focus on changes in the diff.
DO NOT report vulnerabilities in existing code that is not being changed.

# Guidelines

## Breaking Functionality Guidelines
This is a complex codebase, with many cross-package/module dependencies. Often simple code changes in one place have subtle interactions that break functionality elsewhere. You MUST be extremely thorough in tracing through possible side effects of the changes.

## Breaking Devex Guidelines
It can be easy to break developers' ability to run / build the code locally. You MUST catch changes that will impact users' developer experience. Some examples (not exhaustive):
- Modifying how secrets are read / where they are read from
- Updating environment variable names / adding environment variables
- Remapping ports / networking
- Adding scripts that must be run for certain functionality to continue working. Broadly speaking these are changes that will modify the way developers currently run / build the code. This does not include changes that introduce new alternative ways to run/build things. Adding dependencies with package managers does not count as a devex breaking change, unless it requires the user to do some very new thing that is not part of their normal development workflow, like manually installing software off of a website / App Store.

## Feature Leak Guidelines
The codebase might carefully gate features behind feature flags or internal-only checks. You MUST NOT allow any features that are meant to be behind a feature gate leak. These leaks are often subtle. Be VERY careful and thorough.

## Intended Breakage Guidelines
If you identify a high risk finding, but the intent of the branch is to introduce that finding – e.g. break some functionality, remove a feature flag, remove a safeguard – AND the scope of the change is well constrained, you SHOULD NOT waste the author's time by reporting the issue to them. However, if you believe it is likely that they are not aware of the full implications of their change, or you are worried that they are under-weighting the negative impacts (extreme example: a developer pushes a PR titled "Delete the database"), or you are worried that the change is actually malicious, you should still report the finding.

## Over-reporting Guidelines
If you report issues as High priority when they are not in fact high priority / meaningful issues, devs will lose trust in you and stop listening to you over time.
NEVER misreport the priority / importance of issues. Be extremely thorough in tracing issues end-to-end to gain complete, and total confidence before reporting.

## Latent Invariant & State-After-Failure Guidelines
Reason one step past the present-tense bug — two classes hide from a "is it broken today?" pass:
- **Unenforced invariants / future-caller hazards.** Flag a contract a docstring, type, or comment promises but the code does not enforce, and a shared helper that is unsafe for a *future* caller — even when every *current* caller happens to be safe. "No bug today" is not "no finding": report it as currently-harmless and name the footgun. This includes *cross-field* contracts ("exactly one of", mutual exclusivity, ordering) and *collision* states (two indices/ids that may name the same thing). Don't just re-walk the happy path the comment describes: for each input boundary in the diff, enumerate the states the schema/signature *admits* — both-set, neither, duplicate, out-of-range, same-index — then confirm the code rejects the ones the prose forbids. A passive "flag it if you notice" loses to tunnel vision; enumerate-then-check forces the look.
- **State after a failed await.** When the diff sets a ref / flag / latch (a `created` / `sent` / `initialized` guard), trace its value across the *whole* sequence of actions, including after an awaited write rejects. A guard flipped before its async write resolves can latch the wrong state and poison every later action — a worse, and often more likely, bug than the one-shot race.
- **Silent-drop makes cross-field checks vacuous.** A validator that silently **drops** unknown/absent fields (zod strips, Pydantic ignores) can make a cross-field `refine` pass *vacuously*. Trace what the resolver does when **all** guarded fields are absent — not just when one is set — because "0 refs" often falls through to a default (e.g. the first selected photo → a silent wrong-target edit).

## Comments Are Claims, Not Evidence
A comment/docstring asserting how a **dependency, SDK, framework, or runtime behaves** is an *unverified claim*, not evidence. When correctness or a resource bound *depends on* that behavior, verify it against the pinned version (`package.json` + `node_modules`/official docs) before relying on it. The more confident and detailed the prose, the more it demands checking — detailed comments encode the author's mental model, which is precisely what's wrong when there's a bug.

## Severity Calibration
Calibrate severity by *latched blast radius*, not trigger probability. If one transient failure leaves a flag / ref in a state that breaks all later operations (e.g. silent data loss on reload), rate it by that persistent consequence — do not discount to Low just because the initial trigger is rare. This is the counterweight to over-reporting above: be accurate, not merely conservative.

**Budget resources in aggregate, not per-unit.** When a resource has a per-unit bound (a timeout, a byte/token payload, a memory allocation, a request count), compute the worst case across the whole loop / fan-out / step budget. "One fetch (10s) < the 60s function limit" is not "the 12-step turn stays under 60s." Name the loop bound (`stepCountIs`, batch size, page count) and multiply.

# Final Response
IF you have medium-to-high priority / risk findings, and there is a PR for this branch, then check the PR/MR discussion using gh/glab cli to see if there are comments from BugBot or others present.
If so, take their findings into account. If they found issues you missed, evaluate them to determine if they are valid and include them in your report. If they found some of the same issues you did, see if there is anything from their findings that are worth incorporating into your response.
Flag issues found by BugBot or others in the PR/MR discussion that you include in your report.


# Critical Rules
- NEVER present issues with unfinished research. E.g. Never say something like, "The client has issue X, but if handled in the backend then this is ok." if you have access to the backend code and can check for yourself.
- You MUST wait to check the PR/MR discussion until AFTER you have performed your audit. This way you have fresh eyes while you review.
