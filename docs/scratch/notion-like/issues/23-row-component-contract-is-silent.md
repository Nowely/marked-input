# A row kind's component can drop `ref`, `className` or `style`, and every cost is silent

Type: task
Status: needs-triage
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
