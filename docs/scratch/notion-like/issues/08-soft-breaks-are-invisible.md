# A soft break is invisible unless the consumer styles the container

Type: task
Status: needs-triage
Blocked by: —

## Problem

Shift+Enter inserts a literal `'\n'` inside the row
(`packages/core/src/features/keyboard/beforeInput.ts:82`), and nothing in core
or either adapter sets `white-space` — grep for `whiteSpace` across
`packages/core/src` and `packages/react/markput/src` returns nothing. HTML
collapses that newline, so the break the user just typed does not appear until
the consumer sets `white-space: pre-wrap` on the container themselves.

The probe page has to do exactly that
(`packages/storybook/src/pages/Notion/Notion.stories.react.tsx`), or its table,
frontmatter and tight list all render as one long line.

## Why it matters here

The editor owns what Shift+Enter does but not whether its result is visible.
That is a split contract: a consumer who never reads this file gets an editor
where a keystroke appears to do nothing.

## Sketch, not a decision

Either core's container carries `white-space: pre-wrap` by default (a published
visual change, so it is a declared behavior change), or the docs say plainly
that the consumer must set it. The second is cheap and honest; the first
matches what every other editor does.
