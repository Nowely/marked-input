# A cross-row write takes the rows a collapsed toggle hides

Type: bug
Status: resolved — the clip went to `rowSelectionText`, and the paste path was made to ask it
Blocked by: —

## Problem

Ticket [13](13-collapsed-body-lost-on-a-row-cover.md) established the rule — *a write may not take
content nobody can see* — and it is enforced in two places: `TokenModel.replaceRows` (which puts
every hidden subtree back and takes the rest) and `rowSelectionText` (which shrinks a span to the
first hidden subtree, via `#visibleEnd`). Both read `TokenModel.#hiddenWithin`.

`splitPlan`'s crossing arm is a THIRD write path over multiple rows and consults neither.
`writeRowsFromInput` (`rowKeys.ts`) hands the verb the RAW event anchors, and the plan consumes
every pre-order line between the two ends.

**Measured** (review, 2026-08-27, on the showcase's own collapsed-toggle harness): `'▸ head⏎⇥body⏎after'`
with the toggle collapsed, a plain sweep from `he|ad` to `af|ter`, then the browser's paste sequence
carrying `'one⏎two'`:

```
value → "▸ heone⏎twoter"     // the hidden "⇥body" is gone, nothing on screen having shown it
```

Re-run with `siblings.ts` and `TokenModel.ts` at `da03807d~1`: **identical bytes**. So this is
**pre-existing** — the raw splice did the same thing — and the widening neither caused nor fixed it.

## Why it is worth doing now rather than later

The widening deliberately moved this gesture off "the ordinary splice, which wrote bytes in nobody's
language" and onto a plan that speaks the row language. The exclusion belongs in a plan, not in a
splice: doing it before would have been a patch, doing it now is one clause in a function that
already walks the lines.

## The shape a fix would take

`tree/` cannot ask the question — whether a row paints a box is a DOM fact — so the gate belongs at
the seam, in `TokenModel.writeRows`, beside the two doors that already read `#hiddenWithin`.
**Refusing** the plan rather than truncating it is the shape to try first: 13's own history is that
truncating a span was wrong twice.

## Its sibling

[40](40-copy-projects-what-the-write-excludes.md) is the same asymmetry read from the other side —
a COPY projects what the write excludes. Whoever takes one should read the other.

## What the property cannot say about it

`writeRows.property.spec.ts` has no hidden-row oracle and cannot grow one as it stands: its stores
never paint, so `rowPaint` is never `'boxless'`.


## Resolved, 2026-08-27 (T-E)

**The ticket was right about the defect and wrong about its extent, and the extent is what decided
the shape.** Driven on the showcase before anything was changed, `'▸ head⏎⇥body⏎after'` with the
toggle closed and a plain sweep from `he|ad` to `af|ter`:

```
type 'Z'         → '▸ heZter'          the hidden body gone
Backspace        → '▸ heter'           gone
Delete           → '▸ heter'           gone
paste 'one'      → '▸ heoneter'        gone
paste 'one⏎two'  → '▸ heone⏎twoter'    gone
```

Five gestures, and `splitPlan`'s crossing arm — the one place the ticket named — is the door only
the LAST of them reaches. Refusing the plan there would have fixed one line of that table.

**Why every gesture leaked.** 13's rule lives on two doors: `replaceRows` puts each hidden subtree
back, and `rowSelectionText` clips a resolved span at the first one. Both answer a row COVER, which
is the shape `contentSpan` resolves; a MID-ROW sweep is the shape it deliberately calls ordinary
text and hands back untouched, so `rowSelectionText` answered `undefined` and the RAW pair went to
the write. Typing and deleting reach that owner and got `undefined`; a paste, a drop and an
autocorrect replacement never asked it at all.

**So the fix is at the owner, not at the plan** — a clip on the raw span too, reported only when it
actually shrinks, so `undefined` keeps meaning "ordinary text, the event's own bytes stand" — plus
one line in `handleBeforeInput` making the paste arm ask the same question typing has asked since
`488ab0a5`. Two commits, `3b551e78` and `861ecaf9`.

**The paste half closed a data-loss defect nobody had filed.** A sweep from a paragraph into a
fence's interior, pasted over: `'heonede⏎```⏎plain'` — the ` ```js ` opener gone and the closing
literal left standing as prose — where typing over the identical span already emitted
`'heZ⏎```js⏎code⏎```⏎plain'`. That is exactly the defect `#offBlockInterior` was written for,
surviving on the one door that did not consult it.

**Refusing was NOT the shape**, and the ticket's reason for preferring it does not apply here. It
argued from 13's history — truncating a span was wrong twice — but both of those were `replaceRows`,
where an anchor pair cannot say "all of this except the middle" and truncation leaves visible rows
standing. On the anchor-pair path the clip IS the house answer and has been since `#visibleEnd`
shipped; the fix makes one door agree with the two beside it rather than inventing a third rule. A
refusal would also have had to be a CONSUMPTION at the keyboard layer, because a refused plan falls
through to the ordinary splice, which does the identical damage.

**What it costs, declared.** The write is now shorter than the paint on a mid-row sweep across a
closed toggle: `'▸ heZ⏎⇥body⏎after'` keeps the `ter` of `after` that the browser had highlighted.
That is [44](44-painted-selection-outruns-the-write.md), which used to need a fence to reproduce and
now has a second shape — measured there, with the paint counted.

Pinned in `Notion.react.spec.tsx` by two cases, and the mechanism was seen to redden: putting
`if (!span) return undefined` back gave `expected '▸ heZter' to be '▸ heZ⏎⇥body⏎after'`, and handing
`writeRowsFromInput` the raw pair again gave `expected 'heonede⏎```⏎plain' to be
'heone⏎```js⏎code⏎```⏎plain'`.

## Reopened for one shape, and closed on it, 2026-08-27

Two of three reviewers drove the same sweep one character further and found the clip degenerating.
Filed and fixed here rather than on 44, because it is the clip's own rule failing, not the paint
outrunning it.

**The shape.** `'▸ head⏎⇥body⏎after'`, toggle closed, swept from the **END** of `head` to `af|ter`.
Everything of that span before the hidden body is the title's own line, and the pair starts after
it — so the first visible stretch is EMPTY, and an empty stretch reported is a COLLAPSED pair.
Three writers each read one as a caret:

| gesture | before | what was wrong |
| --- | --- | --- |
| type `Z` | `'▸ headZ⏎⇥body⏎after'` | inserted at a POINT; the painted selection not replaced |
| paste `one` | `'▸ headone⏎⇥body⏎after'` | the same |
| `Delete` | `'▸ headbody⏎after'` | `anchorsForDelete` expanded the collapsed answer onto the separator that HIDES the body — the toggle destroyed and its hidden text promoted into a visible line, by the clip written to stop exactly that |

**The fix is one qualifier: the first NON-EMPTY visible stretch** (`TokenModel.#visibleRun`,
replacing `#visibleEnd`). It is still only ever a shrink of the pair, and for every span whose first
stretch is non-empty — which is every case this rule already had — it is the same answer as before,
measured: 30 driven gestures over six ordinary sweep shapes and the whole suite unchanged. The
sweep above now writes over the `af` it holds in `after`: `Z` gives `'▸ head⏎⇥body⏎Zter'` and Delete
`'▸ head⏎⇥body⏎ter'`.

**Two answers were tried first and are recorded so they are not tried again.** Refusing the empty
clip (`end <= held.start → undefined`) puts the RAW pair back on the write and is 43's original data
loss. Teaching `anchorsForDelete` not to expand a pair the owner resolved reddens two shipped pins —
`deletes one character when Backspace follows that double-click` and `leaves a fence its opener when
a sweep ends inside its body ({Backspace})` — because that collapse-then-expand is the margin
double-click's own behaviour. The distinction the delete path would need is "the owner clipped this
to nothing" versus "the content span is empty at this position", which `Anchors | undefined` cannot
carry; making the clip not produce an empty answer avoids needing it.

Pinned by `writes the visible half of a sweep that starts at a collapsed toggle's title END`, and
seen to redden: with `#visibleRun` reverted to the first-stretch rule, `expected '▸ headZ⏎⇥body⏎after'
to be '▸ head⏎⇥body⏎Zter'`, and it is the only case in the file that fails.

**Shape B was checked and is NOT a defect.** A sweep from a row ABOVE a closed toggle across it
(`'top⏎▸ head⏎⇥body⏎after'`, `to|p`→`af|ter`) deletes the visible `▸ head` and leaves `⇥body`
standing at depth 1 under `top`. That is the same answer `replaceRows` gives and has given since
13 — `takes every visible row a cover spans across two collapsed toggles` pins exactly it,
`'before⏎▸ one⏎⇥b1⏎▸ two⏎⇥b2⏎after'` → `'⇥b1⏎⇥b2⏎after'` — so the orphaning is the house rule
applied consistently on a second path, not a new loss.
