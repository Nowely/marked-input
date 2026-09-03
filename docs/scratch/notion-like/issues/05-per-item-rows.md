# One separator per editor, so a list item cannot be a row

Type: task
Status: resolved — P2 makes a line a row (2026-08-25)
Blocked by: —

## Problem

`separator` is one editor-level string (`packages/core/src/features/state/PropsModel.ts:36-45`),
applied to the whole document. A document therefore gets one answer to "what
splits a block", and every construct in it must live with that answer.

The reference document needs both at once:

- `'\n\n'` between blocks, so a paragraph may hold a soft line break — which is
  what Shift+Enter inserts today (`packages/core/src/features/keyboard/beforeInput.ts:82`);
- `'\n'` inside a bullet list, so each item is its own row: its own drag grip,
  its own row menu, its own drop target.

The existing `TodoList` story picks the second and pays the first: it sets
`separator: '\n'` for the whole editor
(`packages/storybook/src/pages/Drag/Drag.stories.ts:96`).

## Decision taken for the probe

`'\n\n'`, the default (maintainer, 2026-08-25). The accepted cost is that a
tight list is ONE row: it drags, reorders and menus as a whole, so "move this
item up" — a plain Notion gesture — has no expression.

## Sketch, not a decision

Either a mark declares that it splits rows at its own delimiter (which makes
the separator per-construct rather than per-editor), or nested rows arrive and
a list becomes a row containing rows — deferred by ADR-0009. Both are the same
question in different clothes: does the row model have exactly one level?

## Answer

Resolved by P2's default flip (ADR-0011). `separator` is the whole row model now — `layout` is
deleted and the default is `'\n'` — so a line IS a row, and the probe's `list` option became a row
kind in the same phase. The reference document's risk list and decision log are four and three
sibling rows, each with its own grip, its own row menu and its own kind's component
(`Notion.react.spec.tsx`, "gives every risk-list item a row of its own").

The decision recorded above ("`'\n\n'`, the default, maintainer 2026-08-25") is superseded: it was
taken while `'\n\n'` WAS the default, and it accepted "a tight list is one row" as the price of a
soft break inside a paragraph. P2 takes the trade the other way and pays the price this ticket
named as the alternative — under `'\n'` a soft break has no representation at all, which is
[08](08-soft-breaks-are-invisible.md).

The sketch is answered too, and by neither of its two branches: the row model still has exactly one
level, and no markup declares its own delimiter. What changed is which single delimiter the editor
is configured with.
