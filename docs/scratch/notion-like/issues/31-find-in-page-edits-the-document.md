# Find-in-page landing inside a closed toggle EDITS the document

Type: task
Status: needs-triage
Blocked by: —

## Problem

Openness became the document's fact (a toggle is two kinds, `▸` and `▾`), which bought authoring,
undo and survival across a cross-parent drop. The cost was declared in the same breath, and it is
the showcase's own comment — verified at
`packages/storybook/src/pages/Notion/notion/options.tsx:456-459`:

> **WHAT THAT COSTS, stated rather than argued: find-in-page landing inside a closed toggle now
> EDITS the document** — `beforematch` opens the row, and opening it is a retype. A consumer who
> would rather a search not dirty the value should not use `until-found`, and then pays the three
> things it buys.

The mechanism is at `:475-485`: a `beforematch` listener whose handler is `node.turnInto(toggleOpen)`.
`outcome.md`'s item 19 records it as the new cost added when openness moved into the document.

The other two costs listed in item 19 are NOT this ticket and should not be re-filed: an arrow from
the title jumping over a closed subtree is the rule now (`map.md:929-936`, *"a collapsed run is
exactly what a person's own ArrowDown skips"*), and a selection dragged across a closed toggle is
[13](13-collapsed-body-lost-on-a-row-cover.md).

## Why it matters here

Ctrl+F is not an edit anywhere else on the web. In a controlled editor it fires the consumer's
`onChange` and lands on the undo stack, from a gesture the user does not think of as typing.

## Shape of a fix

Three candidates, none decided: keep `until-found` and accept it (today); drop `until-found` and
lose search, scroll-to and match-opening inside closed rows; or give core a way to open a row
WITHOUT a document write — which is per-row view state, and is exactly the store
[32](32-no-per-row-view-state.md) says was not built. That link is the reason this is not a
one-line showcase fix.
