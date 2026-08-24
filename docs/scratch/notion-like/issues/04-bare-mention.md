# A mention must be delimited; bare `@Name` is impossible

Type: task
Status: needs-triage
Blocked by: —

## Problem

Mentions must be written in a closed form — `'@[__value__](__meta__)'`
(`packages/storybook/src/pages/Overlay/Overlay.stories.ts:68`). An open form
such as `'@__value__'` cannot terminate: the markup's trailing gap has no
closing segment, so it runs to the end of the row
(`packages/core/src/features/tokens/parser/core/MarkupDescriptor.ts:144-147`).
There is no word-boundary or stop-set concept.

## Consequence for a document

The document's own text must carry the bracket form. That is fine for a file on
disk, and wrong for what the user sees while editing — in Notion, and in every
tool that copies it, a mention is typed and read as `@Sarah`. The markup form
leaks into the value the user edits.

## Why it matters here

The reference document mentions `@Platform` in prose. Written honestly it is
`@[Platform](team-platform)`, which is what the caret walks through.

## Sketch, not a decision

Either a terminator declaration on the trailing gap (stop at whitespace, at a
character class, at a max length), or an accepted position that mentions are
always bracket-delimited and the notion-like package renders — but never
edits — the sugar form.
