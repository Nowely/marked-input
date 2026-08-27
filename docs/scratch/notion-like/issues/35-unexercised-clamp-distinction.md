# `rowSelectionText`'s original-vs-clamped distinction: delete it or pin it

Type: task
Status: needs-triage
Blocked by: —

## Problem

Round ten wrote a rule, round eleven flagged that nothing exercises it, and the coverage audit
reproduced the flag. `map.md:1220-1224`:

> **WHAT I COULD NOT MAKE REDDEN, stated plainly.** Round ten wrote "the row selection is read from
> the ORIGINAL pair, which is what keeps round nine's refusal". Feeding it the CLAMPED pair instead
> is green over the whole suite AND identical on the running page across six gestures (chip, board
> card and toc entry x type/Backspace). The distinction the comment documents is real in the code
> and unexercised by anything; the code is left as it is and the claim is flagged rather than
> trusted.

`insights.md:373-381` puts it the same way and costs it:

> line 489 feeds `contentSpan` the clamped pair, line 491 asks `rowSelection` the ORIGINAL pair, and
> the comment says that is what keeps round nine's refusal. Feeding it the clamped pair is
> **2232/2232 green** and identical on the running page across six gestures. … **Cost:** one line,
> and a maintainer's word — doctrine A.8's "zero callers is not dead code" does not apply (this is
> internal, not published), but doctrine E.6's "does your pin redden" says a distinction nothing can
> exercise is not a distinction. Two reads with no measurable difference are a deletion candidate,
> not a pin.

Verified at `52ef65ae`, `packages/core/src/features/tokens/seam/TokenModel.ts:488-499`: the two
reads are still there and still differ — `contentSpan(…, this.#offBlockInterior(anchors))` at
`:489`, `this.rowSelection(anchors)` at `:491`.

## Why it matters here

`insights.md:221-227` counts six decorative pins this effort shipped, and one of them *"asserted the
defect itself as the contract"*. An unexercised distinction is the same hazard one layer down: it
reads as load-bearing and nothing proves it is.

## The fork

Either a pin that reddens when the clamped pair is fed to `rowSelection`, or the deletion. Not both,
and not neither. Note the counter-example the record insists on (`insights.md:216-220`):
`#enterRow`'s `into === 0` fork was ALSO green when deleted and turned out to be load-bearing, found
by a probe that typed a character rather than asserting an offset — so a probe belongs before the
deletion.
