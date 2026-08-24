# No repeatable placeholder, so no table structure

Type: task
Status: needs-triage
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
