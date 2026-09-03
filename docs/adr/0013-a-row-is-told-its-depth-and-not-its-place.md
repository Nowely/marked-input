# A row is told its depth and not its place

`Rows` used to hand each row its position among its siblings, and `RowProps.index` published that
number. It is gone. A row kind now receives `depth` and its `node`, and a run that wants ordinals
numbers itself with a CSS counter.

**The number could not be both exact and cheap, and that is the whole record.** A sibling position
changes for every row after an insertion, so an always-exact position REQUIRES repainting the tail
of the document on every structural edit. `Row` is memoised on what it is handed, so the shifted
position missed the memo on each of those rows while their content, their node identity and their
own subscriptions were unchanged. There is no delivery mechanism that escapes this: a lazier
channel — a getter, a ref, a context — buys the repaint back by making the number silently stale
for exactly the rows that did not repaint. Either the tail repaints or the number is wrong.

## What it cost, measured

Enter at the top of a 4000-row plain document, Chromium, the Notion showcase mounted controlled,
each gesture awaited to the next frame with the frame cadence subtracted, median of 10:

| caret    | rows after it | before   | row repaints | after    | row repaints |
| -------- | ------------- | -------- | ------------ | -------- | ------------ |
| row 1    | 3999          | 248.3 ms | 4001         | 117.5 ms | 1            |
| row 3998 | 2             | 38.8 ms  | 3            | 43.6 ms  | 1            |

An independent measurement on another machine, driving Chromium through Playwright rather than
Vitest's browser server, read 194.1 / 119.4 / 15.5 ms at three positions and agreed on the shape,
the mechanism and the repaint counts while disagreeing on the absolute numbers. The slope fell from
0.045 to 0.016 ms per following row.

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

**A kind that needs "am I the first of my siblings" asks its node**, which knows: the row's own
verbs and its parent's child list are on `RowNode`, and reading them through the adapter's
subscription hook is already how a kind reads anything else about itself.

## Status

Accepted. `RowRender` in `packages/core/src/features/slots/resolveSlot.ts` carries `depth` alone;
both adapters' `RowProps` drop `index`; `packages/storybook/src/pages/Notion/scale.react.spec.tsx`
pins the repaint count rather than a millisecond budget, and reddens at 401 repaints when the
position is handed down again.
