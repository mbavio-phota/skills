# Landing the backlog — maps, milestones, and ticket anatomy

State these maps up front, before creating anything. Create any missing tracker labels once, at the start.

## severity → tracker priority

| severity | priority |
|----------|----------|
| blocker  | Urgent   |
| high     | High     |
| medium   | Medium   |
| low      | Low      |

## type → tracker label

One label per `type`: `bug`, `security`, `perf`, `code-smell`, `tech-debt`, `improvement`, `a11y`, `test-gap`. Create the ones that don't exist yet in a single up-front pass.

## Milestones = execution phase (NOT severity, NOT type)

Priority and labels already carry severity and type. Milestones carry **the order you'd actually execute the work**, in dependency order — so the safety net exists before the refactors that could regress silently against it:

1. **Security / auth hardening** — Done = every confirmed auth/authz/SSRF finding closed or explicitly accepted.
2. **Confirmed correctness bugs** — Done = every confirmed/adjusted bug fixed with a regression test.
3. **Test & CI safety net** — built BEFORE the refactors below. Done = the gaps that would let 4–6 regress silently are covered.
4. **Structural decomposition & dead code** — Done = giants split, dead code removed, no behavior change.
5. **Duplication / smell cleanup** — Done = the merged-duplicate clusters collapsed.
6. **Polish / a11y / low-priority** — Done = the low bucket triaged to closed or won't-fix.

Give every milestone its own explicit "Done =" line when you create it.

## Ticket anatomy — self-contained for a zero-context agent

Every ticket body must let a fresh agent act without this session's context:

- **file:line** and the verbatim **evidence** quote.
- **suggested fix.**
- **how-verified** — for confirmed/adjusted findings, the refuter's reasoning.
- A standing **context block** (identical across all tickets in the run): what the app is, which convention docs to read, the typecheck/lint/test commands, and the caveat: *"line numbers may have drifted — re-confirm at HEAD."*

## Reconciliation checklist (§6 tail)

1. List the tracker; assert issue count == confirmed+adjusted+kept count.
2. Fetch **one full issue record** (not the list response — lists can truncate the body) and diff its body against the deterministic payload on disk.
3. Any mismatch → fix and re-verify that record before declaring §6 done.
