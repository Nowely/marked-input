# A row kind's component can drop `ref`, `className` or `style`, and every cost is silent

Type: task
Status: resolved — the proposal taken for `ref` alone, refused for `className`/`style` (2026-08-27)
Blocked by: —

## Problem

`insights.md:40-47`:

> **2. A row kind's component must spread `ref`, `className` and `style` onto one element.** All
> three are declared `?:` optional in `RowProps` (`packages/react/markput/src/types.ts:60-62`), so
> dropping any of them type-checks. The doc comment is the whole enforcement. The costs are all
> silent and all different: drop `ref` and the row is unbound, so the caret cannot resolve into it;
> drop `className` and you lose `.Row`'s `position: relative` — which is the containing block
> `.RowSelected::after` needs, so the editor's row-selection overlay stops painting — plus the
> `.Row >`-scoped empty-row line-box rule (`styles.module.css:133`) and `outline: none`, which puts
> the UA focus ring back.

Verified at `52ef65ae`: `RowProps.ref/className/style` are optional at
`packages/react/markput/src/types.ts:58-63`, the doc comment above them is the enforcement, and
both dependent CSS rules are where the record says (`styles.module.css:133`, `:146`).

**What is left of the `rows`-prop half of the same class**, from `outcome.md`'s item 2 and
`insights.md:29-38`: core now REPAIRS it — `TokenModel.#settleRows` lifts children out of a kind
that paints no child-rows host, in the same undo step as the write that produced the shape — but
*"a value merely HANDED to the editor is left alone, deliberately, since rewriting a consumer's own
bytes on mount would emit an edit nobody made."* So a document authored with children under such a
kind still paints without them until an edit touches it.

## Why it matters here

`insights.md:117-120` is the effort's own generalisation, and this is the one member of the class
with no answer yet:

> at a consumer boundary, ask if you can, repair if you cannot, and never rely on the consumer
> remembering.

Types cannot help: *"A required prop cannot force a spread onto an element, and making them
non-optional only moves the mistake into `{...props}`."*

## Proposal, not a decision (`insights.md:48-54`)

> Core already owns the right channel and the right doctrine for this: `reportBadProp` refuses and
> carries on at the props boundary (doctrine A.7, censused over 13 bad prop values), and `bind`
> already knows that a consigned row id received no element. Proposal, not a decision: **one
> `reportBadProp` when a mounted row's consignment is never called.** Nothing like it exists today
> — `console.error` appears in core exactly once outside a bench, in `reportBadProp` itself.

That diagnostic catches the dropped `ref` only. Whether a dropped `className` deserves one too — it
is detectable the same way, from `bind`'s side — is part of the decision.

## Answer (2026-08-27)

**The proposal is taken, in its narrow form: one `reportBadProp`, for the dropped `ref` only.**
`TokenModel.rowPainted(node)` reads its own consignment registry and reports a row that has no
element, naming the kind's markup — or `slots.paragraph` for a row with no kind.

**It could not live in `bind`, and that is the correction to the proposal's own reasoning.** `bind`
runs on the COMMIT, a frame before the paint, so "a consigned row id received no element" is there
the ordinary case of an element that has not arrived yet — a report from that walk would fire on
every structural commit. "The component mounted and its ref never fired" is answerable only by the
caller that rendered it. So the RULE and the CHANNEL stay in core and each adapter hands over the
one fact core cannot derive, from the hook that runs after refs attach: React's effect, Vue's
`onMounted`. That is doctrine B.10's shape — stop re-deriving a fact the framework already holds.

**`className` and `style` get no diagnostic.** The line is what the editor can survive: without
`ref` the row binds to nothing, holds no anchors and the caret cannot resolve into it; without the
other two the row still works and looks wrong. Detecting a dropped `className` would also mean
inspecting the consumer's own element after paint, which is a DOM guess about their markup.

**No bookkeeping.** One report per mounted row, not per kind: saying "per kind" takes a Set, and a
document full of one broken kind is a document whose author is about to fix it.

**The Vue half is a different mistake.** Vue's `RowProps` declares no `ref` at all — the editor's
ref resolves through the component instance — so the prop cannot be dropped there. What reaches the
report in Vue is a component that paints no element, and that case used to CRASH: `unwrapEl`
trusted `$el`, which for a null-rendering component is a Comment, and consigning it threw
`tokenElement.removeAttribute is not a function` out of Vue's own patch. Pre-existing, measured at
the parent commit, fixed alongside — such a component now registers nothing, which is the truth
about it.

**Pins, both seen red.** `TokenModel.rowPainted.spec.ts` for the rule (flip the registry test: 3 of
4 red). `pages/Base/rowKinds.spec.ts`, which both projects run, for the wiring end to end: deleting
the React effect and the Vue `onMounted` reddens it in both, `expected [] to deeply equal
[ Array(1) ]`.

**False positives, measured rather than argued:** the whole browser suite, both frameworks, 113
files and 2271 tests, emits exactly TWO `[markput]` reports — one per project, both from the test
that provokes one on purpose.

## What this ticket does NOT close

The `rows`-prop half quoted above is unchanged: a value merely HANDED to the editor whose rows sit
under a kind that paints no child-rows host still paints without them until an edit touches it.
`#settleRows` repairs what a WRITE produces, deliberately, and rewriting a consumer's own bytes on
mount would emit an edit nobody made.
