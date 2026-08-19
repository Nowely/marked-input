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

**That instruction has been REVERSED.** It used to read "do not attack 1, 2, 5 or 7 as accidental
complexity — they are the invoice for framework-owned DOM". The `react-prosemirror` analogy behind
it is confounded, and the claim did not survive measurement: 3 has been deleted, 2 measured
removable at the cost of exactly one red test in 1492, and 1, 5 and 7 are all removed by
[`../../consigned-surfaces/spec.md`](../../consigned-surfaces/spec.md) **without touching DOM
ownership** — because two of them are the price of re-deriving a fact the framework already holds,
and one is the price of waiting for a paint the framework never had to announce.

The honest floor is **one** concept: a post-paint step for the caret on structural edits, which
even a design that takes DOM ownership outright still has. Attack the rest.

The rest are independent of DOM ownership and were each re-attributed:

- **3** comes from the delta being *accumulated* rather than *derived*. Already specified and
  done 2026-08-18, closed in [`backlog/issues/closed.md`](../../backlog/issues/closed.md);
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
