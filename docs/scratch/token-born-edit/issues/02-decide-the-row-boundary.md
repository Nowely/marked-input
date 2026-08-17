# Phase 0 — decide the Row boundary

Status: needs-info

Type: research

What ends a Row, and how a Row with no marker is bounded. Every later phase changes shape with the
answer, so nothing downstream starts before it lands.

## The maintainer's spec

> I do not think it is right that we baked the newline character in as row separation. It should
> be simpler: a Mark IS a row (in the corresponding mode), and the next Mark is another row.

> `'__slot__\n\n'` was needed to display text blocks as marks. Again, the reference is markdown.
> There, every line of text with an Enter is its own block. We need to work out what will be
> better for us, more optimal, more efficient. `'__slot__\n\n'` was born as a stopgap to make it
> work at the moment without global changes. And now is the time for changes.

Note that "every line with an Enter is its own block" is **editor** behaviour, not CommonMark
parsing — CommonMark needs a blank line to end a paragraph. Design to what was said.

## What is already established

The shipped fixtures already disagree about the separator, and only one shape needs the chain:

| Markup | segments | chain? |
| --- | --- | --- |
| `'- [__value__] __slot__\n'` — Todo item, one newline | 3 | no |
| `'\t- [__value__] __slot__\n'` — Todo nested by a tab | 3 | no |
| `'# __slot__\n\n'` — heading | 2 | no |
| `'- __slot__\n\n'` — list item | 2 | no |
| `'__slot__\n\n'` — **bare paragraph** | 1 | **yes** |

`PatternMatcher.isSlotLeading` is exactly `segments.length === 1 && hasSlot`, and
`resolveSlotLeadingMatches` then treats that single segment as a *trailing* delimiter. So the
newline is baked into the predicate, not merely into the fixtures — and the Todo fixture is a
shipped, working demonstration of one-line rows with nesting that never touches the chain.

Consequence to settle by execution: a Markup whose single segment is a *leading* marker — say
`'# __slot__'` with no terminator — also satisfies the predicate, and the chain would extend its
start backwards, handing it the previous Row's text as its Slot.

## Candidates under evaluation

1. **A Row is a line** — the boundary is the newline, a lexical property of the document; a Row's
   type is an inline question inside the line, so a marker-less paragraph is free.
2. **A Mark is the Row** — no separator in the Value at all; adjacency suffices because Marks are
   self-delimiting. Every Row type, paragraph included, must carry a marker.
3. **The separator belongs to the tree** — the Value still reads like markdown, but no Markup
   mentions the separator; the split is structural.

## Deliverable

The exact `Value` string for one three-row document under each candidate and under today's
behaviour, plus measured parse cost at 10 / 100 / 500 rows against a baseline established for the
purpose. The maintainer decides on that comparison.
