# Code-review bot facts — `photalabs/retina` (Greptile)

Concrete, repo-specific values for Phase 0.1. Load this only when running `ship-tickets` against `photalabs/retina`; for any other repo, discover the equivalents (Phase 0.1 says how). These strings rot when the bot config changes — verify if a run misbehaves.

- **Bot:** Greptile. **Automatic reviews are disabled** on this repo — a review only happens on request.
- **Trigger:** post a PR comment that **@-mentions** `@greptile`. Slash forms (`/greptile`, `/greptileai`) are no-ops here.
- **Bot login:** `greptile-apps[bot]`.
- **Review shape:** one issue comment beginning with `Greptile Summary` (carries `Confidence Score: N/5`, a `Comments Outside Diff (n)` section, and inline PR review comments for in-diff findings).
- **Ignore:** a short `greptile-status` stub ("Automatic reviews are disabled…") is posted on every PR open — it is **not** a review; filter it out (require the `Greptile Summary` marker).
- **First-review completion signal:** the `Greptile Summary` comment appears.
- **Re-review completion signal:** Greptile **edits the existing summary comment in place** — it does NOT post a new one. Detect via `updated_at` advancing **and** the body referencing the new commit SHA / findings clearing. A poller waiting for a *second* summary comment hangs forever.
- **Owner casing:** comment posting is via GraphQL, which is owner-case-sensitive — use `-R PhotaLabs/retina`.

`fix-greptile-review` is the skill that owns Greptile-comment triage.
