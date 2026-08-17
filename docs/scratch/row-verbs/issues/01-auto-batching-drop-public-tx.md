# Auto-batching: drop `tx` from the public write API

Status: needs-info

`tx` is the one piece of the transaction layer a consumer has to learn, and it exists only so
that two edits land as one commit. If several verbs called in one tick coalesced by themselves,
nothing above `tree/` would need the word.

## What is published today

`MarkputApi.tx(fn)` (`store/MarkputApi.ts:102`) delegates to `TokenModel.tx`, which delegates to
`createTransactions`' `tx` (`features/tokens/tree/transactions.ts:145`). That one buffers
disjoint ops and adopts once with the hull window, so a caller composing two edits does not
commit — and re-parse, and announce — twice. Both `TokenModel.tx` and `MarkputApi.tx` reach the
built `index.d.ts` of both adapters, so removing it is a contract change, not a cleanup.
Acceptable at 0.x, but it has to be called out.

## Why this is `needs-info` and not `ready-for-agent`

**When does the tick close?** A microtask boundary and an end-of-call-stack flush both make the
commit asynchronous, and controlled mode's echo protocol is built on it being synchronous: the
boundary emits the spliced value and waits for the parent to hand it back
(`features/tokens/tree/valueBoundary.ts:74-83`). Core is synchronous end to end today —
`onChange`, `changed`, the caret repair and the DOM bind all land inside one call. Introducing a
timing model is the whole of this ticket, and it has to be decided before anything is designed.

Second-order question that rides along: with auto-batching, what does a verb return? A `boolean`
that means "accepted" is answerable synchronously; one that means "committed" is not.

## Where this came from

The row-verbs design conversation, 2026-08-17. The structural verbs settle on `boolean` returns
and a caret the verb moves itself, which leaves `tx` as the only reason a consumer meets the
transaction layer at all. The row-verbs change deliberately keeps `tx` as-is; this is its
follow-up.
