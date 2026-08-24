# A row-level markup re-matches inside its own slot, so repeats nest

Type: task
Status: needs-triage
Blocked by: —

## Problem

A markup with a trailing `__slot__` closes at the row boundary, so its slot
holds the whole rest of the row — and that slot is re-tokenized against the
same option list. A construct that repeats per line therefore matches itself
inside itself, one level deeper per repeat.

Bullet list, markups `['- __slot__']`, one row of three items:

    1.1: MARK "- Vendor SLA unsigned↲- EU region…↲- Support headcount at 60%"
      1.1.0: TEXT "Vendor SLA unsigned↲"
      1.1.1: MARK "- EU region capacity unconfirmed↲- Support headcount at 60%"
        1.1.1.0: TEXT "EU region capacity unconfirmed↲"
        1.1.1.1: MARK "- Support headcount at 60%"

Blockquote, markups `['> __slot__']`, two quoted lines in one row: same shape —
the second line becomes a quote nested inside the first.

Both are visible in the probe page's snapshot
(`packages/storybook/src/pages/__snapshots__/stories.react.spec.tsx.snap`,
`Notion stories > Story MarkdownPreset`): the preset's `paddingLeft` per level
turns the risk list into a staircase.

## Why it matters here

Every list in a Notion document is a repeat, and so is every multi-line quote.
The repo's existing workaround is to write lists LOOSE — a blank line between
items, so each becomes its own row (`shared/lib/sampleTexts.ts:1-7`). That is a
change to the document's own text, which an exporter will not make.

## Note

Distinct from [01](01-row-start-anchoring.md): anchoring stops `- ` matching
mid-sentence, but a list item's `- ` IS at the start of its line, so anchoring
alone still produces this nesting. What is missing is a way to say "this markup
repeats at sibling level within its row", or nested rows (deferred, ADR-0009).
