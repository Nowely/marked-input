# One separator per editor, so a list item cannot be a row

Type: task
Status: needs-triage
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
