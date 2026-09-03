# No repeatable placeholder, so no table structure

Type: task
Status: resolved — P9 answers it with a row kind that carves its own body (2026-08-25)
Blocked by: —

## Problem

A markup may carry at most two `__value__`, one `__meta__` and one `__slot__`
placeholder (`packages/core/src/features/tokens/parser/core/MarkupDescriptor.ts:181-191`).
A markdown table row has N cells, N unknown until the text is read, so no
markup can describe one:

    | Task | Status | Owner | Due |

There is no repeatable or variadic placeholder form.

## Consequence for a document

A table can only enter the document as an opaque blob — one mark whose single
`__value__` is the raw table text, parsed by the mark component itself. That
costs the editor everything structural: no cell is a token, so no cell is
editable in place, no cell can hold a mention, and caret motion through the
table is caret motion through one atomic mark
(`packages/core/src/features/dom/bind.ts:244-260`).

## Why it matters here

Tables are not a Notion garnish; the reference document's launch-task table is
its densest region and every cell in it is exactly the kind of place a mention
or a status chip belongs.

## Sketch, not a decision

Either a repeatable placeholder (`__value__*` splitting on a declared
delimiter), or a way for a mark to declare that its interior is re-parsed as
its own token sequence — which is the same machinery nested rows would want and
which ADR-0009 explicitly defers.
Both are large; the ticket exists to record the wall, not to pick a way through.

## Answer

Resolved by P9, and by neither branch of the sketch. There is still no repeatable placeholder and
no mark whose interior is re-parsed: what changed is that a ROW KIND may declare
`split: {at, as}`, and the parse takes that kind's own body apart at the literal. Each piece is an
ordinary Row of the option `as` names, so a cell is not a new node kind and the DOM layer has no
branch for one — its structural bytes are the delimiter it was carved at, held in `lead` exactly as
an indent run is, and the round trip is concatenation.

Every cost this ticket listed is closed. A cell IS a token, so it is editable in place, holds
ordinary inline marks (a mention typed into one parses as a mark among that cell's children), takes
the caret, and Tab walks to the next cell because a piece is a Row in its parent's own child list —
nothing declares that. `as` may name an option carrying `row` with no markup at all: an anonymous
kind, which nothing scans and which exists only as a carve's target.

What the delimiter model costs, declared rather than papered over: a piece cannot contain its own
delimiter (an escape scoped to a cell body is the named follow-up); a body holding N delimiters is
N+1 pieces including the empty ones a leading, doubled or trailing delimiter produces, so a markdown
line's trailing `' |'` belongs to the last cell's text; and the carve goes one level, so a kind
naming itself terminates.
