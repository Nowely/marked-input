# A Markup cannot match its own neighbours

Status: needs-triage

Two adjacent occurrences of the same Markup share the delimiter between them. The first consumes
it, the second has nothing left to start with, and it is dropped. Line-oriented syntaxes are built
entirely out of adjacent same-shaped constructs, so this is not an edge case for them — it is the
common case.

The [spec](../spec.md)'s violations table already carries a neighbouring symptom: a registered
`\n\n` eating *another* Markup's `\n` terminator. That one is a collision **between two Markups**,
resolved by literal length. This is a Markup losing **its own** repetitions, with nothing else
registered. They may share a cause; they are not the same measurement.

## Measured

Method: `denote()` from `packages/core/dist/index.js` (built 2026-08-17 17:08).
`git log --since` reports no commit touching `packages/core/src/features/tokens/parser/` after that
build, so the grammar under test is current.

| Markups | Input | Result |
| --- | --- | --- |
| `['\n- __value__\n']` | four `- item` lines, no blank lines | **1** mark — only the last |
| `['- __value__\n\n']` | the same four, blank line between each | 4 marks — all |
| `['\n__value__: __meta__\n']` | six-field YAML frontmatter | **3** marks — `type`, `description`, `tags`; exactly the odd ones |
| `['|__value__|\n']` | GFM table, four rows | 4 marks, each capturing only the row's **last cell** |
| `['\n|__value__|\n']` | the same table | **1** mark |
| `['\n\|__slot__\|\n\n']` | the same table | **1** mark — the last row |

The alternation in row 3 is the mechanism stated plainly: field *n* eats the `\n` that field *n+1*
needs as its opening segment, so every other field survives. Row 1 is the degenerate form of the
same thing — with the delimiter on both ends, only one occurrence can ever win.

This is already known and worked around in the tree without being written down:
[`sampleTexts.ts:1-7`](../../../../packages/storybook/src/shared/lib/sampleTexts.ts) tells the
reader to use loose-list format "because the markput parser requires an unambiguous `\n\n`
terminator to delimit each list mark". The comment describes the workaround, not the rule.

### A second, separable finding

Registering one Markup per reserved field — `'\ntype: __value__'`, `'\ntitle: __value__'`, and so
on — matched all six fields, but every `value` came back as the Markup's own static segment
(`"\ntype: "`) rather than the field's content.

That is explained by
[`Match.ts:44-56`](../../../../packages/core/src/features/tokens/parser/core/Match.ts): a
single-segment pattern auto-completes and sets its gap to the *segment's* range. The site carries
`//TODO need review it. before it was only value gap type`. A Markup whose only static segment
leads and whose placeholder trails has no terminator, and the gap it reports is the marker, not the
content. Related to `isSlotLeading = segments.length === 1 && hasSlot`, already in the spec's table,
but this is the value branch rather than the slot branch.

## Why it lands here

The [spec](../spec.md) records the standing goal: a universal parser able to handle "any custom
syntax and something typical like XML or markdown", with a simple set of markup rules and no
inferred priority. Neither named syntax exercises this. XML nesting is delimiter-balanced and
markdown's inline marks are self-delimiting; both leave the newline alone.

**OKF is proposed as the third conformance syntax**, for exactly that reason. It is a directory of
markdown files with a YAML frontmatter block, published by Google Cloud 2026-06-16, and it is
line-oriented throughout: `key: value` per line in the frontmatter, `| … |` per row in a schema
table. It is the smallest real-world format that fails on this and nothing else.

What does work today, cleanly and worth keeping as the positive case:
`'---\n__value__\n---\n\n'` matches the whole frontmatter block as one value, with no collision
against `'- __slot__\n\n'` despite sharing the `-` trigger.

## The open decision

Whether a delimiter belongs to one occurrence or is shared by both is a language rule, not a bug
report. It needs deciding before anything is written:

- **Defect** — a Markup should match all of its own neighbours, and the shared delimiter is
  something the matcher must handle. Then it belongs in the violations table and gets fixed with
  the rest.
- **Declared rule** — a delimiter is consumed, adjacency requires an unambiguous terminator, and
  loose format is the answer. Then it is documented, `sampleTexts.ts`'s comment stops being folklore
  and becomes a reference to a stated rule, and the glossary may need a word for it.

Nothing gets a name in [`CONTEXT.md`](../../../../CONTEXT.md) until this is settled — naming a
defect would write it into the language.

## Proposed next step

A characterisation test, which fixes what is true now without committing to either branch. The spec
already asks for one in the same shape and notes it does not exist: *permuting the Options must not
change the tree*. The cases above are ready to be that test's first fixtures.

## Deferred: the storybook story

An OKF story was the origin of this and is intentionally not part of it. Settled in the session, so
it does not need re-deciding:

- The story lands on the **Nested** page, next to `ComplexMarkdown`.
- The sample is trimmed — frontmatter, a heading, prose. **No table**: it renders as raw text with
  pipes, and snapshotting that would legitimise it.
- The frontmatter mark is atomic and cannot be otherwise. A value-only mark root is
  `contenteditable=false`
  ([`editableState.ts:9`](../../../../packages/core/src/features/tokens/dom/editableState.ts)),
  and the slot route is closed from both sides: field Markups registered inside the slot did not
  nest — they matched at top level with `value` `": "` — and adjacent fields alternate regardless.
- Rendering is the existing two-tab harness: a card in Preview, the raw string in a plain field in
  Write. The card parses its own YAML by hand in the fixture; no YAML dependency.
- The Markups live in a new `OkfOptions.ts` rather than in `MarkdownOptions.ts`. Frontmatter is not
  markdown, and `MarkupPreset` carries `{markup, style?}` only — a mark component does not fit
  through it, and the shape is read by three importers.
- The story gets an explicit assertion in `Nested.spec.ts` beyond the automatic HTML snapshot: one
  mark, six lines intact, not swallowed by the list Markup.

## Noticed in passing, unrelated

- `blockLevelMarkdownOptions` in
  [`MarkdownOptions.ts`](../../../../packages/storybook/src/pages/Nested/MarkdownOptions.ts) has no
  importer anywhere in `packages/`. Its docstring says "use in drag mode"; `Drag.stories.ts` imports
  `markdownOptions`. `defaultMarkdownTheme` and `MarkupPreset` are exported but used only in-file.
- `Drag.stories.ts` reaches into another page's folder for that import — a page fixture that has
  quietly become a shared resource.
- [`parser/README.md:172`](../../../../packages/core/src/features/tokens/parser/README.md) documents
  `match.labelStart` / `labelEnd`, which exist nowhere in `packages/core/src`. The Position
  Semantics section is stale; the code uses `gaps` keyed by `GapType`.
