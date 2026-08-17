# Phase 4 — the concept sweep

Status: needs-info

Blocked by: 03, 04, 05

Recount the eight concepts once the edit is Token-born, and remove whatever is left without a
cause.

## The eight

1. `renderEpoch` as a counter, deliberately not the tree
2. the `pendingStructural` latch, which makes `handle(id)` fail closed
3. the delta accumulator with exact-id cancellation
4. the commit re-entry guard
5. `bind`'s all-or-nothing frame alignment, plus unbind-versus-kill
6. the divergence sweep having to be a `changed` subscriber rather than an inline call
7. Vue's two announcement sites plus its epoch dedupe
8. the ordering rules inside the commit batch

## What is already known about each

**Do not attack 1, 2, 5 or 7 as accidental complexity** — they are the invoice for framework-owned
DOM, proven by the `react-prosemirror` inversion described in the [spec](../spec.md). Attacking
them is attacking ADR-0007.

The rest are independent of DOM ownership and were each re-attributed:

- **3** comes from the delta being *accumulated* rather than *derived*. Already specified and
  parked as [backlog issue 28](../../backlog/issues/28-announce-the-delta-as-a-set-difference.md);
  it is orthogonal and can land at any time.
- **4** is re-entrancy, nothing to do with paint. CodeMirror 6 owns its DOM, has no lag, and still
  throws on re-entry in nearly the same words.
- **6** is the price of having no MutationObserver ([ADR-0006](../../../adr/0006-beforeinput-guard.md));
  its *placement* as a subscriber is the price of `EditController.replace` wrapping the write in a
  batch, so the per-Surface writers have not flushed when `apply` returns. Changing when writers
  flush removes the constraint; closing the paint window does not.
- **8** is intrinsic to batching a transaction — all four major analogs have explicit, load-bearing
  commit ordering.

## What this phase should actually produce

A recount, not a purge. Phases 1–3 dissolve things upstream — `gapWindow`, the echo protocol, the
`#committed` mirror, `filterEmptyText`, the chain — and some of the eight may lose their reason
along with them. List what genuinely went, what survived renamed, and what remains as a stated,
priced cost of the architecture.

## One gap worth closing here

markput has **no flush-and-read escape hatch**. A consumer holding a Token id during a pending
window can only wait it out; Lexical's `editor.read(cb)` defaults to committing first. It is the
one idea from the analog survey shaped like something markput lacks rather than something it
rejected.
