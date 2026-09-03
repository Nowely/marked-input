# A markup cannot be anchored to the start of a row

Type: task
Status: resolved — P1 answers it with a row kind (2026-08-25)
Blocked by: —

## Problem

Every markup matches anywhere in a row. `SegmentMatcher.search()` runs
`text.matchAll(regex)` over the whole text with no start-of-row assertion
(`packages/core/src/features/tokens/parser/core/SegmentMatcher.ts:114-181`), so
with the markdown preset registered (`'# __slot__'`,
`packages/storybook/src/pages/Nested/MarkdownOptions.ts:21-38`) a paragraph row
reading `Load test at 5# peak` or `budget # 5 apples` takes a heading mark in
the middle of the row.

In markdown — and in every Notion-shaped document — `#`, `##`, `-`, `>` are
line-anchored by definition. A document fixture can dodge this by never writing
those characters mid-line, but a real editor cannot ask that of its user.

## Why it matters here

This is the difference between "markdown-ish marks" and markdown. A
notion-like package registers a dozen line-anchored markups; without anchoring,
each one is a landmine inside ordinary prose.

## Sketch, not a decision

An option-level flag — the markup matches only at offset 0 of a row (block
layout) or after a `'\n'` inside one. Rejected-by-default alternative: teach
consumers to escape, which pushes markdown's own problem onto them.

Note the interaction with [02](02-variadic-placeholders.md) and with the
`'\n'`-inside-a-row model: anchoring must mean "row start OR after a literal
newline inside the row", or a multi-line list inside one row loses its items.

## Answer

Resolved by P1's scan-first parse (ADR-0010). A markup declared `row` is recognised at a row's
OWN start and nowhere else — `RowScanner.tryKind` tests `value.startsWith(opener, at)` — while a
markup left undeclared keeps matching anywhere, which is what an inline mark should do.

Probed at `e0595ca6`, markup `'# __slot__'` declared `row`, separator `'\n'`:

    'load 5# peak\n# Real'  ->  paragraph 'load 5# peak' + kind '# __slot__' body 'Real'

Pinned by `parseRows.spec.ts` and by the row-locality property in `parseRows.property.spec.ts`,
which reddens when the opener is matched anywhere instead of at a row start.
