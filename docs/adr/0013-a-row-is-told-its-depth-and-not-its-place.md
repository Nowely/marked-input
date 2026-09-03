# A row is told its depth and not its place

`Rows` used to hand each row its position among its siblings, and `RowProps.index` published that
number. It is gone. A row kind now receives `depth` and its `node`, and a run that wants ordinals
numbers itself with a CSS counter.

**The number could not be both exact and cheap, and that is the whole record.** A sibling position
changes for every row after an insertion, so an always-exact position REQUIRES repainting the tail
of the document on every structural edit. `Row` is memoised on what it is handed, so the shifted
position missed the memo on each of those rows while their content, their node identity and their
own subscriptions were unchanged.

**The rule is about a PUSHED prop, and stating it wider than that would be false.** No prop handed
down to a memoised row can be both always-exact and invariant under an edit somewhere else: a
lazier push — a getter, a ref, a context — buys the repaint back by making the number silently
stale for exactly the rows that did not repaint. A PULL is a different thing and is not ruled out:
a component that asks for its position at the moment it needs one gets an exact answer and repaints
nobody. What it cannot do is keep that answer on screen without a repaint to refresh it — which is
why the replacement below is a CSS counter, where the browser, not the framework, keeps the run
numbered.

## What it cost, measured

RUN A, and every number in this record comes from it unless it says otherwise: the Notion showcase
mounted controlled over a 4000-row plain document, Chromium under Vitest's browser server, each
gesture awaited to the next frame with the frame cadence subtracted, median of 10. Ticket 45's own
opening table is an OLDER run on another machine and does not line up with this one figure for
figure; that is what re-measuring on the machine that holds the fix costs, and neither table has
been edited to agree with the other.

| caret        | rows after it | before   | row repaints | after    | row repaints |
| ------------ | ------------- | -------- | ------------ | -------- | ------------ |
| first row    | 3999          | 248.3 ms | 4001         | 117.5 ms | 1            |
| next to last | 2             | 38.8 ms  | 3            | 43.6 ms  | 1            |

**The second line got no faster, and may have got slower.** With two rows after the caret there was
never a fan-out to remove, so the fix cannot help there; 38.8 against 43.6 is within what this
harness moves by between runs — the same cell read 41.0, 44.2, 47.2 and 49.2 across the session —
so it is called noise rather than a regression, and named here rather than left for a reader to
notice.

RUN B, an independent measurement on another machine, driving Chromium through Playwright rather
than Vitest's browser server: 194.1 / 119.4 / 15.5 ms at three positions before, with the same
4001 / 2002 / 4 repaint counts, and a slope falling from 0.045 to 0.016 ms per following row. It
agreed on the shape, the mechanism and the counts, and disagreed on every absolute number — which
is the reason a millisecond budget is not what the regression pin asserts.

**A SECOND, SMALLER CAUSE RODE THE SAME PATH and is fixed with it: the row's `ref` callback was
minted fresh on every render.** React detaches and re-attaches a ref whose identity changed, so
each repainted row also unbound and rebound its element — four rebind pulses per row, measured.
Held stable with `useCallback`, that alone roughly halved the slope while `index` was still
changing. It costs no published surface and it still pays whenever a row repaints for any other
reason.

**What remains is not ours.** With no position handed down and one component rendering, Enter at
the top of 4000 rows still costs more than at the bottom — about 0.016 ms per following row. It is
not the parse, not the commit, not the settle pass (1.1 ms), not the DOM (one node inserted, two
attributes), not forced reflow (0.7 ms), not the controlled round trip (the same slope appears
uncontrolled) and not recomputed subscriptions (12 recomputations, position-independent). It is
React's own reconciliation of a keyed sibling list whose head moved, and it goes away only with
windowing. Roughly 27 ms of the top-of-4000 figure is browser layout, and `content-visibility: auto`
on rows removes that much for a consumer who wants it.

## What it costs the consumer

A published field is gone: this is a breaking change for anyone reading `index` in a row kind's
component. The replacement for the case that motivated the field is a CSS counter, which is both
exact and free:

```css
.list {
    counter-reset: item;
}
.item::before {
    counter-increment: item;
    content: counter(item) '.';
}
```

The showcase was already doing this before the field was removed, and its comment says why: a
position among siblings of EVERY kind is not a list ordinal. Two paragraphs before a numbered list
put its first item at `index === 2`, so `index + 1` read "3.". The field answered a different
question from the one every caller actually had.

**And a kind that needs "am I the first of my siblings" has no cheap route to it today**, which is
worth saying plainly rather than implying one. The tree carries no parent pointers — `RowNode.rows()`
answers a row's CHILDREN, and `RowPlacement`'s own record says depth alone cannot say which of two
same-depth parents a row joins — so only a ROOT row can find its neighbours, through
`tokens.nodes()`. A nested row would need a walk that core does not publish. If a real consumer
turns up wanting it, the answer is a verb on the tree, asked at the moment it is needed, and not a
number pushed into every row on the chance that one of them cares.

## Status

Accepted 2026-08-29 by the maintainer, who was shown the measured trade and chose the removal over
keeping the field with a stale value or paying the repaints. `RowRender` in `packages/core/src/features/slots/resolveSlot.ts` carries `depth` alone;
both adapters' `RowProps` drop `index`; `packages/storybook/src/pages/Notion/scale.react.spec.tsx`
pins the repaint count rather than a millisecond budget, and reddens at 401 repaints when the
position is handed down again.

THE REF HALF IS UNPINNED, and that is a known gap rather than an oversight. With no position handed
down, no gesture the harness can drive repaints enough rows for a churning `ref` to be visible at
all — restoring the fresh closure leaves every test green, which was verified rather than assumed.
Pinning it wants a gesture that repaints MANY rows at once; a select-all across rows is the
candidate, and the shared harness has no helper for one.
