# Two tiers of core, and one entry interface for the second

Type: grilling
Status: needs-triage — parked at the maintainer's word, 2026-08-30
Blocked by: —

## The ask

Raised 2026-08-30, as requirements-gathering only; no implementation was requested and none was
done. Verbatim shape of the request:

- Several of today's controllers are, in effect, a plugin: one atomic block of behaviour.
- No such unit should depend on another. `keyboard` should probably not be handed a controller.
- They should share ONE entry interface.
- They must be able to reach the primitives — which means the primitives have to be good.
- So: carve out a true tier-1 core, and build tier-2 (today's `keyboard` and the rest) on it.
- Purpose: let consumers build Notion-shaped editors on markput through one uniform way of
  writing this kind of unit.
- Nearest analogue named: TanStack Table's `withSort`-style composition — as an analogy, not a
  requirement.

Explicit non-goal, stated with the ask: **this is not a plugin system.** Nothing here has to be
published.

## What was measured

Cross-feature edges in `packages/core/src/features/`, production files only, `.spec` and
`__testing__` excluded. Candidates for tier 1 — zero edges to any feature — are `Host`,
`PropsModel` and `TokenModel`.

There are NINE edges, and three of them are invisible in `Store.ts` because they are module
imports rather than constructor arguments:

| # | edge | how | site |
| --- | --- | --- | --- |
| 1 | overlay → edit | constructor | `overlay/OverlayController.ts:90` |
| 2 | clipboard → edit | constructor | `clipboard/ClipboardController.ts:10` |
| 3–6 | keyboard → edit, history, overlay, rows | constructor | `keyboard/KeyboardController.ts:12-20` |
| 7 | keyboard → clipboard | imports `captureMarkupPaste` / `consumeMarkupPaste` | `keyboard/input.ts:6`, `keyboard/beforeInput.ts:3` |
| 8 | overlay → slots | imports `resolveOverlaySlot` | `overlay/OverlayController.ts:11` |
| 9 | rows → overlay | imports `navigateSuggestions` | `rows/RowController.ts:6` |

Three consequences follow from the table, and they are why the job may be smaller than the ask
sounds:

1. **`edit` is the common denominator of 1, 2 and 3.** Move `EditController` into tier 1 and three
   edges disappear by definition rather than by mechanism.
2. **8 and 9 are pure functions, not state.** They belong among the primitives or in `shared/`;
   moved, two more edges disappear. 7 is not a pure function: `pasteMarkup.ts:4` holds a
   module-level `WeakMap` keyed by container — real state with no owner.
3. **After 1 and 2, every remaining edge is `keyboard`'s**: `{history, overlay, rows, clipboard}`.
   That is exactly the node whose construction order `Store.ts:41-43` records as load-bearing
   ("Esc is the one key three features want, and the row-selection arm defers to an open overlay
   or an open row menu by asking each of them").

One more fact about that node: `KeyboardController` is **structurally empty** — a constructor and
nothing else, with `no-extraneous-class` suppressed by hand at `keyboard/KeyboardController.ts:4`.
`store.keyboard` is a field carrying no members. It is not a state owner; it is a wiring site, and
the wiring is the subject of this ticket.

## The seven open questions

Recommendations are the grilling session's, not decisions. Nothing below is settled.

**Q1 — Where is the tier-1 boundary, and is `edit` inside it?**
Uncontested: `Host`, `PropsModel`, `TokenModel`, the reactive primitives, `KeyGenerator`. Contested:
`EditController`. For: three features want it, and folding it into `tokens.replaceBetween` is a
recorded refusal — "the seam IS the contract" (`features/tokens/README.md:578`), so it is already
a standalone write primitive. Against: it carries POLICY, not just mechanism — the controlled-mode
rule D6 lives inside it (`edit/EditController.ts:33`), and policy in the kernel is what a tier-2
unit will one day want to override.
*Recommended:* tier 1 = `{host, props, tokens, edit, signals}`. 32 lines, one verb, and it removes
three edges for free.

**Q2 — Does `Store` stay statically typed, or become a registry?**
The TanStack analogue composes dynamically and assembles the store type from a feature union. The
cost here is measurable rather than aesthetic: `CONTEXT.md` declares the field names public
vocabulary, and after issue `notion-like/10` both adapters' `useMarkput` are constrained literally
to `Store['rows'] | Store['edit'] | Store['tokens']`
(`react/markput/src/lib/hooks/useMarkput.ts:28`, `vue/.../useMarkput.ts:23`) — because
`Store[keyof Store]` was tried and is useless. A dynamic registry breaks precisely that.
*Recommended:* keep `Store`'s explicit typed fields. Unify CONSTRUCTION and CROSS-TALK, not the
store's shape. `withSort`-style assembly is a later and PUBLIC question (doctrine rule 9).

**Q3 — Scope: the constructor edges only, or all nine?**
*Recommended:* all nine. Otherwise the work ships a clean `Store.ts` over the same coupling one
level down, which is the "two places hold one fact" anti-pattern with extra ceremony.

**Q4 — Does this task decompose `TokenModel`?**
2210 lines, but already layered `parser/ → tree/ → dom/ → seam/` under a no-upward-edge rule, and
"core builds the DOM" (O1) is a standing rejection.
*Recommended:* no. Take `TokenModel` as it stands, and test primitive quality by MEASUREMENT: port
the six tier-2 features onto the kernel and record every reach that came out ugly. That list is the
brief for the next task, and it is evidence rather than taste.

**Q5 — Is the seam internal, or pre-public?**
`store.*` is already published, and `notion-like/39` (its own package) is unblocked.
*Recommended:* internal, unpublished. Acceptance is "all six features are written through the
seam", not "a consumer can add one". Design it so the notion package COULD be written against it
later, and record that as a dated non-goal rather than a promise.

**Q6 — Do the missing Notion primitives come along?**
Specifically [`notion-like/32`](../../notion-like/issues/32-no-per-row-view-state.md): there is
nowhere to put per-row view state that is not in the document, which is why the showcase made row
openness a document fact and paid for it with `notion-like/31`.
*Recommended:* out of scope as a build — new published surface with one caller, and doctrine wants a
second. In scope as the ACCEPTANCE CASE on paper: if the proposed seam cannot express "collapsed"
as a tier-2 unit, the seam is wrong. Cheaper than building the store to find out.

**Q7 — Where does the answer live?**
*Recommended:* here, in `core-layers/`, which already covers this ground (01 host ownership, 03 the
store union, 04 what moves into core). If the design outgrows a ticket it graduates to its own
directory rather than forking the map on day one.

## Unresolved in the ask itself

"Очень красные примитивы" was not decoded — beautiful (clean shape), sturdy (holds up under any
consumer), or rich (covers everything a unit might come for). It changes Q4's answer: the first is
about form, the third about completeness, and they are different pieces of work.

## What would close this

A `spec.md` in this directory that answers Q1–Q7, plus the ported-features measurement Q4 asks
for. Round 2 of the grilling — not run — was to cover the mechanism inside `keyboard` (key
registry vs event bus vs declared priorities), the Esc arbitration, and what replaces the
load-bearing construction order.
