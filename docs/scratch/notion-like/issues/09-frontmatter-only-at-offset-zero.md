# A `\n`-delimited fence matches only at the start of the document

Type: task
Status: needs-triage
Blocked by: —

## Problem

`'---\n__value__\n---'` matches the document's frontmatter when it is the FIRST
block and never anywhere else. Probed, 2026-08-25:

    at offset 0:   MARK "---↲type: Product Launch↲…↲---" [0-63]  ✅
    after a row:   TEXT "---↲a: 1↲---" [3-15]                    ❌ no mark

Cause, from the segment dump: the markup compiles to segments
`["---\n", "\n---"]`, and when a separator precedes the block its second `\n`
starts the CLOSING segment before the opening one is read — the closer matches
first and the pair never forms.

The probe page depends on the accident that its frontmatter is at offset 0
(`packages/storybook/src/pages/Notion/options.tsx`). Move it down one row and
the properties panel silently disappears.

## Why it matters here

Silent is the problem. A markup that works in one position and vanishes in
another, with no error and no warning, is a trap for exactly the consumer who
writes a fence and tests it at the top of a file.

## Note

Related to [07](07-closing-literal-newline.md) — both are the parser treating a
`\n` in a literal as ordinary text while the row layer treats it as structure.
The position-independent alternative `'---__value__---'` was probed and is
worse: any two lone `---` rows in the document pair into one mark and swallow
everything between them.
