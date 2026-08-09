# Tree Core — Roadmap S1.4 → S1.7 (the rest of the rewrite)

**Date:** 2026-08-09 · **Branch:** `b0` · **Spec:**
`2026-08-08-markput-s1-tree-core-v2.md` (v2.1, Reviewed)

**S1.7 is the last phase.** After it, the tree core is the shipped core and
the old surface lives behind a compat entry with a stated sunset. Remaining
order: **S1.4 → S1.5 → S1.6a → S1.6b → S1.6c → S1.6d → S1.7.**

## Why this is a roadmap and not seven finished plans

Each phase gets its own task-level plan written immediately before execution,
because the plans are only as good as the facts available when they are
written — and those facts keep changing under us. Evidence from the phases
already shipped:

- S1.3's plan shipped a counterexample that turned out to be **inert** — it
  could not detect the defect it existed to guard.
- S1.3's own code contained a **latent output-equivalence bug** (missing
  descriptor pairing) that only surfaced when someone tried to implement it.
- S1.4's plan, written yesterday against a completed S1.3, was verified by an
  adversarial pass that **implemented it and ran every snippet**: two hard
  stops and three of five "load-bearing" mutations that silently survived,
  plus a decision (`D-c`) resting on a false premise.

Writing S1.6c's tests today, against a boundary and a view contract that do
not exist yet, would produce more of exactly that. What follows is the scope,
the decisions each phase must make, and the risks — enough to see the whole
path and to schedule it, without pretending to details we cannot yet know.

## Status

| Phase | Scope | State |
| --- | --- | --- |
| S1.1 | Types & contracts | ✅ `12ead317`, `9d7abb29` |
| S1.2 | TokenTree, projection, snapshot | ✅ `453813fa`…`ad755172` |
| S1.3 | gapWindow, adoption, transactions | ✅ `13fc4c38`…`6fbe8e88` |
| S1.4 | String boundary | plan written & verified |
| S1.5 | View contract | roadmap only |
| S1.6a–d | Cutover (staged) | roadmap only |
| S1.7 | Public API v2 & compat split | roadmap only |

Everything through S1.3 is **built alongside** the live pipeline: the tree
module still has zero consumers outside its own directory, and the only
change to existing code is one added barrel export. The live editor is
untouched and shipping.

---

## S1.4 — String boundary

**Plan:** `2026-08-09-tree-core-s1-4-plan.md` (verified, ready to execute).

Commit policy (uncontrolled: adopt now; controlled: emit and wait for the
echo), arrival routing with the `value`/`base` validity checks, the
`lastEmitted` record, parser resets. One new module, built alongside.

**Decisions already taken:** `base` needs no new parameter (the tree is
unmutated at commit time); `selectionBefore` stays unimplemented (recorded
channel, no caller yet); a parser reset uses `gapWindow(v, v)` because
adoption is equality-driven and a full window would wreck `map`;
`filterEmptyText`/`isBlock` arrivals are deferred to S1.6a.

**Open for the executor:** whether a no-op edit still fires `onChange`
(today it does — suppressing it is a user-visible change requiring a
call-out).

---

## S1.5 — View contract

**Scope.** Make the commit pipeline consume `TransactionResult` instead of
`ReconcileResult`; `TokenHandle` becomes a node-backed view holding
bind-generation positions; the `changed` event gains its payload;
`BlockController` migrates off the `removedIds()` side channel; compat
snapshot invalidation rides the same feed.

**Why it is bigger than it looks.** The spec sizes this by touch surface, not
net-new: ~680 production lines adapted (`commit.ts` 227 + `bind.ts` 257 +
`TokenHandle.ts` 196) plus ~1,670 lines of pipeline specs pinned to the old
`ReconcileResult` shapes. Behaviors that must survive intact: the fold guard,
self-heal escalation, `assertAligned`, mount/editable seeding, control roots,
block rows.

**Decisions this phase must make.**
1. **Snapshot memoization** (D9) was deliberately deferred here from S1.2.
   Today `snapshot()` materializes fresh objects every call; the compat
   renderer memoizes on object identity, so without per-node reuse every
   structural commit re-renders every mark. Needs a per-node memo invalidated
   from the `TransactionResult` delta, applied synchronously at adoption.
2. **`shifted` ordering is unspecified** (measured: suffix run reverse-doc
   order, then middle in doc order). If the DOM refresh depends on order, pin
   it; otherwise document that it is unordered.
3. **Where the result feed lives.** It currently hangs off
   `createUncontrolledSink`'s `onResult`. The controlled path produces its
   result later, at echo adoption — so S1.5's consumer must subscribe to
   both. Consider hoisting the feed to the dispatcher.

**Risk.** Highest-effort phase after S1.3, and the one whose estimate has
been questioned twice. Budget by touch surface, not by net-new lines.

---

## S1.6a — Wire cutover (jsdom)

**Scope.** Store wiring; `beforeinput` → verbs (including the `isAllSelected`
branch rewrite); the `EditController.replace` compat shim lowering global
ranges to `applyRange`; `MarkController` onto `applyStructural`; selection
capture hook; **then** delete the old watch wiring. Two commits inside one
change: wire, then delete. Flip the jsdom core suite to the new core.

**This is the first phase that touches the live editor.** Everything before
it is additive.

**Decisions this phase must make.**
1. **`selectionBefore`'s channel** — the recorded decision is dispatcher →
   `commit` → `adopt`, with an injected `selection` dep on
   `createTransactions`. Four mechanical sites. Do it here, at the moment it
   gains a caller.
2. **`filterEmptyText` / block mode** — deferred from S1.4. The filter is
   applied nowhere in the tree core; block wiring needs it, and whole-value
   block ops must route through gap-derived adoption so identity survives
   rather than through a bare tree replacement.
3. **The initial seed and the controlled→uncontrolled fallback** — named in
   S1.4's decision D-d as this phase's responsibility. Today, dropping
   `value` falls back to `defaultValue`; `join(tree)` alone would report the
   last arrived value.

**Rollback unit:** revert this change and the old wiring is restored.

---

## S1.6b — Browser suite flip

Storybook suites (React + Vue) against the new core via compat; manual smoke
including an **IME parity spot-check** — composition handling was descoped
(spec D10), so the bar is "matches today's behavior", not "works well".

Small phase, but it is where DOM-level divergences surface, because jsdom
does not exercise real selection or contenteditable.

---

## S1.6c — Selection swap

**Scope.** Node-anchored selection in `SelectionController`; delete
`#preferredHandle` and the clamp arithmetic; caret repair through
`selectionBefore` + `map`.

**The decision that must be made BEFORE this phase starts.** `map` currently
uses LEFT affinity at an insertion point, where spec D7 calls right affinity
canonical: typing `X` at offset 5 of `abcde` maps a pre-edit caret at 5 to 5,
not 6. That is deliberate and pinned by a property — but **one `map` cannot
serve both a selection anchor (wants left) and a post-insertion caret (wants
right)**. Either add an affinity parameter or a second entry point. Decide it
in design, not mid-implementation.

Also inherited: an N→1 re-tokenization (mark break) keeps the id of the
*leading empty text node* while the node holding the user's visible text
dies. Correct per the algorithm, and inside the best-effort region — but it
is the shape caret repair will meet.

---

## S1.6d — Deletions & ledger

Delete the six mechanisms on the spec's §4.6 checklist: the consume-once hint
protocol, `tokenIdentity.ts` + its ~1,160-line suite (key fixtures already
ported in S1.3), the reparse-watch edit path, the handle write-latch and
captured-token fallback, `#preferredHandle` + clamp arithmetic, and the
`removedIds()` side channel.

The **checklist is the gate**, not a line count. Mechanical phase; the risk
is deleting something with a surviving caller, which the checklist plus a
green suite catches.

---

## S1.7 — Public API v2 & compat split (last)

**Scope.** The §2.3 surface becomes the product: `MarkputApi` host, live node
reads with always-present ids, model-centric write verbs (`mark.update`,
`insertMark`, `replaceText`, `replaceRange`, `setValue`, `tx`), node-anchored
selection, a `changed` event with a payload. The export-disposition table is
executed: signal primitives, `MarkupDescriptor`, `TokenPath` and raw DOM
nodes leave the root export; positional `Token[]` snapshots and
`replace(range, …)` move to `@markput/core/compat`, frozen and documented for
removal next major. Storybook suites migrate off compat shapes; website docs
updated.

**Note the two lifetimes** (spec D8): the *public compat entry* sunsets next
major, while the *internal offset shim* survives until the block-rows
follow-up. They are separate artifacts.

**Decisions this phase must make.** Whether exported node types narrow their
signal fields to `() => T` (zero runtime cost, blocks userland writes at the
type level) — the maintainer chose one node structure with writes-by-
convention, and this is the residual type-level question. Also the final
naming pass on the verbs; semantics are fixed, names are not.

**Gate** includes the website build.

---

## Cross-cutting things that must not get lost

1. **Declared deviations from the spec**, each documented in code with its
   measured cost: unbounded index pairing in slot recursion (§4.2's
   gap-derived slot-local window not implemented — in-slot repeated-content
   deletion can kill the wrong sibling); `map`'s left affinity vs D7; no
   composition/IME handling; snapshot memoization deferred to S1.5.
2. **One ungated mutation.** Dropping the suffix window bound is caught by a
   single named fixture and by no property — proven structural, not a
   coverage gap. Both sides carry cross-references; do not delete that
   fixture as "covered by the property suite".
3. **A pre-existing parser defect**: some inputs do not round-trip
   (`toString(parse(s)) !== s`). Every generator gates on the fixpoint. Worth
   its own issue, out of scope for this rewrite.
4. **After the rewrite lands**: regroup `features/tokens/` into `tree/` (pure
   core), `dom/` (the contenteditable adapter), `parser/`. Wanted, explicitly
   not a goal of any S1.x phase (spec §9).

## Process that has been working

Per phase: write the plan → verify it adversarially **by implementing it**
(this has caught a hard stop or a false premise every single time) → execute
subagent-driven with a fresh implementer plus separate spec and quality
reviewers → fold the review findings back before the next phase starts. Every
review so far has found a real defect; two found bugs that would have shipped
silent data corruption.
