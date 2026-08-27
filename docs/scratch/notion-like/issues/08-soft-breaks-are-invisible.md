# A soft break is invisible unless the consumer styles the container

Type: task
Status: resolved — the visibility half is false, measured; the representation half is 37
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
`'\n'` as the default separator (ADR-0011) the newline Shift+Enter writes IS a row boundary, so
the gesture SPLITS THE ROW rather than making an invisible break. (An earlier version of this
comment said it was unbound. Measured: `handleRowEnter` returns on `shiftKey`, the
`insertLineBreak` behind it takes the shared table's `'\n'`, and the row splits — minus Enter's
own all-selected and range-keeps-selection rules, since it never reaches that arm. Pinned in
`blockEdit.spec`.) `white-space` is no longer what stands between the user and the break.

Both halves are still live and they are now two different tickets' worth of work:

- **The representation.** A soft break needs a byte the scanner reads only INSIDE a row's body —
  the design spec names it `softBreak`, scoped to the keymap phase. `RowConfig` is already a record
  rather than a bare separator, so nothing in P2 forecloses it.
- **The visibility**, which is this ticket as filed and is unchanged: whatever a row's body ends up
  holding, HTML collapses a newline in it, and nothing in core sets `white-space`. A raw-bodied
  kind — a fence, the frontmatter, a table line — has newlines in its body today, so the probe page
  still has to set `pre-wrap` itself.

## Answered 2026-08-27 (T-D)

**The visibility half is FALSE, and the grep that filed it could not see the rule.** It ran over
`packages/core/src` and `packages/react/markput/src`; the rule is `packages/core/styles.module.css`,
a file at the package ROOT and outside both paths, carrying `.Container span { white-space:
pre-wrap }` since `881cb824` — long before rows existed, and before this ticket was written.

Measured rather than re-read (`7fa8f61f`): a raw closed body holding a newline, mounted with no
consumer CSS at all, paints on TWO lines in both adapters. The kind under test is a plain `<div>` on
purpose, since `<pre>` carries the same declaration from the UA stylesheet and would have passed
whatever core did. Both halves of the assertion were mutated: with core's rule removed the surface's
computed `white-space` is `normal` and the two painted lines collapse to one, in both projects.

The probe page's own `pre-wrap` is therefore redundant rather than load-bearing — it is in
`notion/theme/`, whose comment still claims *"`pre-wrap` is the consumer's job — core sets none"*,
which is now a false claim in prose. Flagged here rather than fixed: that directory is owned
elsewhere.

**The representation half is not this ticket.** It is [37](37-softbreak-stays-unbuilt.md), which is
`wontfix` on a standing deferral: a soft break is a CONTINUATION ROW today, and `softBreak` waits on
a case the continuation cannot carry. Nothing in this ticket asks for one.
