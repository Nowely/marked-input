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

## Comments

**2026-08-25, P2.** The premise changed under this ticket and it is now worse than it reads. With
`'\n'` as the default separator (ADR-0011) Shift+Enter has nothing to insert: the newline it would
write IS a row boundary, so the gesture is unbound rather than invisible. `white-space` is no
longer what stands between the user and the break.

Both halves are still live and they are now two different tickets' worth of work:

- **The representation.** A soft break needs a byte the scanner reads only INSIDE a row's body —
  the design spec names it `softBreak`, scoped to the keymap phase. `RowConfig` is already a record
  rather than a bare separator, so nothing in P2 forecloses it.
- **The visibility**, which is this ticket as filed and is unchanged: whatever a row's body ends up
  holding, HTML collapses a newline in it, and nothing in core sets `white-space`. A raw-bodied
  kind — a fence, the frontmatter, a table line — has newlines in its body today, so the probe page
  still has to set `pre-wrap` itself.
