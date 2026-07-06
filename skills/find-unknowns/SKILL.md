---
name: find-unknowns
description: >-
  Surface the user's unknowns — the gap between their prompt (the map) and what the work
  actually needs (the territory). Use when the user asks for a blindspot pass or to find
  their unknown unknowns, wants to be interviewed about ambiguities, asks for throwaway
  variations to react to, wants to be quizzed on what a change did, or starts work in a
  domain or codebase area they say they don't know.
---

# Find Unknowns

The user's prompt is a map; the codebase and its real constraints are the territory. Every
gap between them is an **unknown**, and each unknown you hit mid-work gets resolved by your
best guess of what the user wants. An unknown found before code is written costs minutes;
the same unknown found three PRs later costs the three PRs.

Each technique below is a cheap probe for a different kind of unknown. A run uses one or a
few, never all. Two moves apply to every probe:

- **Hand over something to react to; never ask the user to imagine.** Reacting extracts
  knowledge the user has but cannot articulate unprompted. End each artifact with the
  user's next message pre-drafted — lettered options with your recommendation, steal/skip
  choices per item, a copyable sharpened prompt — so reacting costs near-zero typing.
- **Close every unknown in front of the user.** An unknown ends one of exactly three ways:
  settled by the user, settled by the territory (show the question *and* the found answer —
  closed off-screen isn't closed), or OPEN with what unblocks it. End the probe with this
  ledger in the user's hands, not scattered through scrollback.

Claims about the territory cite files actually read; fake data is labeled fake. When a
probe produces something to look at, prefer a single self-contained HTML artifact.

## Diagnose first

Anchor on the user's starting point: their experience with the problem and this codebase,
and where they are in their thought process. If they haven't said, ask — the same task
needs different probes at different starting points. Then pick by quadrant:

| The user... | Their unknowns | Probe |
|---|---|---|
| is in an unfamiliar domain or codebase area and doesn't know what to ask | Unknown unknowns | [Blindspot pass](#blindspot-pass) |
| will only recognize what they want on sight (design, UX, tone, scope) | Unknown knowns | [Variations](#variations) |
| knows the open questions but hasn't settled them | Known unknowns | [Interview](#interview) |
| can point at something that already has the behavior | Knowns they can't articulate | [References](#references) |

(Known knowns are the prompt itself — nothing to probe.)

## Blindspot pass

Sweep the territory the task will touch and teach the user what they don't know to ask.
Hunt specifically for:

- **Landmines** — things that bite silently: wrong-by-default data, stale
  denormalizations, filters that pass bad rows.
- **Unwritten conventions** — rules the code enforces that no doc states.
- **Half-built or reverted prior attempts** at the same job, and *why* they died — the
  reason is usually your landmine.
- **What good looks like** in this domain, when the user can't judge it yet.

Report each finding as a card — evidence (file and line), why it bites, what it changes
about the task — worst first. When the gap is vocabulary (the user lacks the domain's
words, not its facts), ladder from their words to the field's terms, each rung paired with
the prompt it unlocks. Done when you have named the questions they didn't know to ask and
assembled them into one copyable, sharper implementation prompt.

## Variations

Unknown knowns surface on sight, and surfacing them during implementation is expensive —
small spec changes cause drastically different code, and reverting is harder than
discarding. So probe before wiring anything: several genuinely divergent, throwaway
versions built on the user's real data, so what's being judged is the only variable.
Visual work gets incompatible design directions or a clickable mock; non-visual outputs (a
file format, an API response, a report) get a concrete sample with labeled fake data
instead of a description of one. When the user picks, ask *why* — the answer is the
unknown known, now written down and in scope for the real build.

This probe also fits session start: brainstorm intervention points from cheapest to most
ambitious — half-built features and disconnected wiring are the cheapest wins — so scope
is chosen rather than defaulted.

## Interview

Ask one question at a time, ordered by blast radius: questions whose answers would change
the architecture come first. Each question carries lettered options and your recommended
answer, so the user reacts in a few characters rather than composing. Before asking, check
whether the territory already answers it — read, then show. Done when every named question
is closed one of the three ways; recap with a small decisions table.

## References

When the user points at code that already has what they want — a crate, a module, a
component on a live site — read the source, not the screenshot. Produce a semantics map:
what it does (with excerpts), how each behavior maps to the target stack, and every place
the port cannot be literal. Nothing gets ported until the user signs off on the map —
source is the densest reference a user can give; offer to work from one before making them
articulate the inexpressible.

## Building through residual unknowns

No amount of probing clears every unknown, so plan for improvisation:

- **Plan for correction.** Lead the implementation plan with the decisions the user is most
  likely to tweak — data models, type interfaces, anything user-facing — and bury
  mechanical work at the bottom. The plan is a probe, not a contract.
- **Deviations log.** During the build, keep an `implementation-notes.md`. When an edge
  case forces a deviation, log what the plan said, what the code revealed, and the
  conservative call you made, then keep going; tag entries that need the user's judgment.
  Each logged deviation is an unknown that escaped the probes — feed it into attempt #2.

## After the work lands

The unknowns move to the reader's side — the user absorbing the change, reviewers deciding
whether to trust it:

- **Explainer + quiz.** A diff under-informs because behavior depends on existing code
  paths. Produce a report with context and intuition for what changed, ending in a quiz on
  the change's behavior; wrong answers point back to the section the user skimmed. Treat
  the change as merge-ready only after they pass.
- **Pitch.** Package prototype, spec, and deviations log into one shareable doc that leads
  with the demo, pre-answers the objections each reviewer would raise, and names who signs
  off on what.

## When a task comes back wrong

Diagnose upstream before retrying: a long-horizon miss is usually an unknown that was never
clarified, not bad execution. Return to the table, run the missing probe, then retry.
