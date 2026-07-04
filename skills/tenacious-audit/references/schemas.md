# Schemas — findings are DATA, not prose

Every finder, refuter, and triage judge speaks these shapes. Structured findings are what make the pipeline mechanical: they can be deduped by field, refuted one at a time, counted, and turned into tickets by a script instead of by an LLM re-typing prose.

Emit JSON. One object per finding/verdict/triage-item. Keep `evidence` as a **verbatim quote of real code** — it is the anchor a refuter checks against and the payload a ticket carries.

## `finding` (from every finder)

```json
{
  "title": "unique, human-readable — used later as the join key to tickets",
  "file": "path/relative/to/repo/root.ts",
  "line": 123,
  "severity": "blocker | high | medium | low",
  "type": "bug | security | perf | code-smell | tech-debt | improvement | a11y | test-gap",
  "evidence": "verbatim quote of the offending code",
  "suggestion": "concrete fix",
  "confidence": "high | medium | low"
}
```

`title` MUST be unique across the whole run — §6 joins issues↔findings by it. Prefix with the slice if collisions are likely.

## `verdict` (one per bug/security finding, from a refuter)

The refuter is told to *try to refute* and **lean refuted when uncertain**.

```json
{
  "verdict": "confirmed | adjusted | refuted",
  "reason": "why — for refuted, what makes it a false positive",
  "adjustedSeverity": "present only when verdict=adjusted",
  "adjustedTitle": "present only when verdict=adjusted"
}
```

- **confirmed** → eligible for a ticket.
- **adjusted** → eligible for a ticket, with the corrected severity/title.
- **refuted** → recorded in the inventory, **never a ticket**.

## `triage` (per-slice, for non-bug quality items)

Quality items skip the refuter and go through a triage judge instead.

```json
{
  "kept": [
    { "...finding fields...": "", "effort": "S | M | L", "mergedCount": 1 }
  ],
  "droppedCount": 0,
  "dropRationale": "one line on what class of items was dropped and why"
}
```

`droppedCount` + `dropRationale` exist so drops are surfaced, never silent — the completeness critic (§7) reads them.

## Merged dataset (input to §6)

One JSON array. Every row that should become a ticket — confirmed+adjusted bug/security findings ∪ all `kept` triage items — carries `"status": "ticketed"`, plus its `slice`, its `effort`/`mergedCount` (from triage), and either a `type` or an explicit `phase` (from `landing.md`) so the milestone can be derived. `scripts/build_tickets.py` renders only the `status:"ticketed"` rows and skips everything else. The refuted set is carried in the same array with `"status":"refuted"` (or a separate file) — it feeds the inventory doc only, never a ticket.
