# The row separator is structural, and a Row is a node

Block rows used to be markups that carried their own delimiter (`'# __slot__\n\n'`,
`'__slot__\n\n'`), and two defects were measured to be unfixable inside that shape. A markup
whose single segment is a _leading_ marker satisfied the same count predicate as a trailing
delimiter, so the parser's repair chain (`resolveSlotLeadingMatches`) extended `'# __slot__'`
BACKWARDS and handed it the previous row's text. And a registered `\n\n` entered the segment
alternation, where the longest-first sort let it eat another markup's `\n` literal — whole rows
lost, with nothing mis-registered. Both were violations of the parser's standing goal: decisions
inferred from a coincidence of shape, not declared.

Decided (2026-08-20, `docs/scratch/token-born-edit/issues/08`): the separator belongs to the
tree, not to any markup. One editor-level setting (`separator`, default `'\n\n'`), applied in
block layout only. Its precedence is local and declared: a matched `__value__`/`__meta__`
interior hides its separators (a code fence's internal blank line never splits), a separator
beats plain text, and an open TRAILING gap closes forward — at the next row boundary in block
layout, at end of input inline. A markup may not begin with a placeholder: the leading-gap shape
is invalid rather than repaired, which is the validation rule that replaced the chain.

`RowNode` is block layout's only root kind: a span between separator occurrences, its inline
tokens as children, its `position` INCLUDING the consumed separator so rows keep tiling the
document. A paragraph is a Row with no markup, no option and no Mark component. The piece after
the final separator is a row even when empty, so Enter at the document end always yields a
visible row. Enter inserts the separator; merge deletes the first row's separator and reparse
decides — a paragraph Backspaced at a heading boundary is absorbed into the heading's trailing
slot. Adoption pairs rows on KIND alone (no descriptor exists), and the pairing gate compares a
row pair on children only, because a reorder legally flips `terminated` on the two rows entering
and leaving the final position.

The row's DOM element is the block wrapper the adapter already renders — core still builds no
row DOM, so [ADR-0007](0007-row-identity-travels-with-the-row.md)'s boundary is untouched; only
the consignment key moved from the top-level token's id to the Row's id, and the separate
`rowElement` registry died with it. A separator span has no DOM and is unanchorable — a boundary
inside it fails closed to the row's own edge, exactly as the trailing `\n\n` always had.

**Partly superseded by [ADR-0010](0010-the-block-skeleton-is-scanned-first.md).** The separator
is still structural and still one editor-level setting, and a Row is still block layout's only
root kind. What changed: a Row is TYPED by its own opener rather than by a mark hidden inside it,
the separator is no longer stored on the Row (the projection joins Rows with it), and the row
derivation is a linear scan rather than a fixpoint — so "a matched interior hides its separators"
now reads "a row kind's RAW body keeps its own newlines", and an inline match can no longer cross
a row boundary at all. The pairing gate's row arm survives, for the span-length reason rather
than for a stored `terminated` flag.

Accepted scope boundaries: nested rows inside slots are deferred (a separator inside a CLOSED
slot interior does not split; only a trailing open slot closes at the row boundary), and the
separator does not apply in inline layout — the same value parses to a different tree per
layout, which was already true under the block-only empty-text filter, and a layout flip is a
reparse.

Full record: the decision, evidence and rejected alternative (mark==row with a structurally
formed paragraph option) are in `docs/scratch/token-born-edit/issues/08-the-separator-is-structural.md`.
The terms are in [`CONTEXT.md`](../../CONTEXT.md).
