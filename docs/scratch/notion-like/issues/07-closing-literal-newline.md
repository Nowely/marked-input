# A markup's closing literal may not begin with a newline

Type: task
Status: resolved — P1 answers it with a row kind (2026-08-25)
Blocked by: —

## Problem

A bounded placeholder compiles to `before([^…]+?)after` where the closing
literal's characters are added to the value's negated character class
(`packages/core/src/features/tokens/parser/core/MarkupDescriptor.ts` →
`createDynamicDefinition`, and `SegmentMatcher.computeDynamicPattern`,
`packages/core/src/features/tokens/parser/core/SegmentMatcher.ts:100-112`). When
the closing literal starts with `\n`, the newline lands in that class and the
value can no longer span a line — so a fence that looks obviously right silently
matches nothing:

| markup | result |
| --- | --- |
| ` ```table\n__value__\n``` ` | no match at all — the whole block stays text |
| ` ```table\n__value__``` ` | matches, whole block captured |
| `---\n__value__\n---` | matches (the `-` characters are not `\n`) |

Probed by real `parseRows` runs, 2026-08-25.

## Why it matters here

This is the difference between a fenced block that works and one that silently
does nothing, and the failing form is the one a markdown author writes first.
The existing preset already carries the scar: its code block is
` '```__meta__\n__value__```' ` with the closing fence pulled up onto the value's
last line (`packages/storybook/src/pages/Nested/MarkdownOptions.ts:77-90`).

## Note

Whether the fix is a parser change or a documented rule is open. At minimum a
markup whose value can never match should be reported the way an invalid one is
(`markupError`, `MarkupDescriptor.ts:161-198`) rather than matching nothing in
silence.

## Answer

Resolved FOR A ROW KIND, at `e0595ca6`. The row scanner finds every literal with `indexOf`, never
with a regex, so a closing literal that begins with `\n` costs nothing:

    markup '```__meta__\n__value__\n```' declared `row`, separator '\n'
    'intro\n```ts\nq\n```\ntail'  ->  paragraph 'intro' + fence meta 'ts' body 'q' + paragraph 'tail'

NOT fixed, and deliberately: the INLINE compiler still folds a closing literal's characters into
the value's negated class (`createDynamicDefinition`), so an inline mark whose closer starts with
`\n` still matches nothing. A markup that means to span lines declares `row`; that is the answer
this effort needed, and the inline limitation is untouched.
