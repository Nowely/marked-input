# A mention must be delimited; bare `@Name` is impossible

Type: task
Status: resolved — a terminator declaration is refused, and the ticket's own consequence is false at HEAD
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

## Answered 2026-08-27 (T-D)

Two findings, and the second is the one that closes it.

**A TERMINATOR DECLARATION DOES NOT BELONG IN THE MARKUP LANGUAGE, and the row world is the reason
rather than the counterexample.** Rows DO have a terminator — `RowKind.ts:60` gives every row kind
`trailingGap: Slot`, closed by the separator — and what makes that safe is exactly what a stop-set
would give up: the separator is STRUCTURAL and EDITOR-LEVEL (ADR-0009, ADR-0011), one declaration
for the whole document, and no byte a user types inside a row can move it. A stop-set on an inline
trailing gap is the mirror image: a mark's extent would depend on a byte OUTSIDE the mark, so typing
a space inside a mention's name would silently end the mark and change the document's structure with
nothing said. That is the class of thing the separator was lifted out of markups to remove, and it is
the class [29](29-refusal-is-silent.md) exists for. It also has nowhere to put the id — a mention is
`value` AND `meta`, and a bare `@Name` carries one of the two.

**AND THE CONSEQUENCE THIS TICKET WAS FILED FOR IS ALREADY FALSE.** *"That is what the caret walks
through"* was true when the ticket was written and is not true now. A value-only mark — one with no
`__slot__`, which is every mention — is bound `contenteditable="false"` and is ATOMIC by
construction (`bind.ts:259`): the caret steps over the whole thing in one press and never enters the
brackets. The component paints whatever it likes, and the showcase's already paints `@{value}`
(`notion/marks.tsx:20`), so `@Platform` is what is on screen and what the caret meets. The bracket
form appears in exactly one place — the stored value — which this ticket itself calls *"fine for a
file on disk"*.

So the answer is the second sketch, and it costs nothing to take: **mentions are always delimited,
and the sugar is the consumer's component.** Nothing is left for a notion-like package to add here.
