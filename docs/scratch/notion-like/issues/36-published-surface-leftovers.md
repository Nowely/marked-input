# Three published-surface leftovers wanting a maintainer's yes

Type: task
Status: resolved — 1 changed, 2 answered no, 3 kept with its reason (2026-08-27)
Blocked by: —

> Three one-line items from `outcome.md`'s list (24, 25, 26). Filed together because each is a
> published change of the same kind — a rename or a removal that a consumer can see — and none is
> worth a round of its own.

## Problem

**1. The grip's `aria-label` still says "Block options".** `outcome.md`'s item 25 — user-visible
text, so changing it is a behaviour change rather than part of the block→row rename. Verified at
`52ef65ae`: `RowControls.tsx:122` and `RowControls.vue:123` both spell
`draggable ? 'Drag to reorder or click for options' : 'Block options'`.

**2. `Store` carries an open rename TODO and is published.** `outcome.md`'s item 26. Verified:
`packages/core/src/store/Store.ts:12` — `//TODO rename to Markput, Core, Engine, Editor?` — and
`packages/core/index.ts:4` exports it. (Its OTHER open question, that neither adapter re-exports it,
is the probe's [03](03-row-node-not-nameable.md).)

**3. `RowProps.index` has no consumer reader and is kept.** `outcome.md`'s item 24: *"it is
published surface with its own generated API page. Measured removable: typecheck 0, suite green."*
Verified at `52ef65ae`: both adapters compute and pass it (`Row.tsx:88`, `Row.vue:70`, declared at
`react/src/types.ts:51` and `vue/src/types.ts:32`), and nothing in the showcase or the specs reads
it off `RowProps`.

## Why it matters here

The block→row rename shipped in one pass and these three are what it did not take. Left alone they
are exactly the drift AGENTS.md warns about — code, docs and vocabulary disagreeing quietly.

## Cost

1 is one string and a spec line, and it is a behaviour change (announced text) rather than a rename.
2 is a published rename with a DTS diff and a docs pass. 3 is a deletion of published surface, which
AGENTS.md forbids doing preemptively — *"don't remove published API unless that contract is the
agreed change"* — so it needs the yes, not the measurement, which is already done.

## Answer (2026-08-27) — one each

**1. The grip's `aria-label` now reads "Row options".** Taken as the behaviour change it is: the
announced word was the last place this API still said "block", and CONTEXT.md's own glossary puts
that word on the avoid-list. The `draggable` label is untouched. `Drag.spec.ts` locates the grip by
this label in a non-draggable editor and moved with it — reverting the string reddens it in both
projects with `Cannot find element with locator: … {name: 'Row options'}`, which is what proves the
locator is a pin rather than a spelling. CONTEXT.md's rename record stops declaring the leftover.

**2. `Store` keeps its name, and the TODO becomes the doc comment the class never had.** All four
candidates the TODO listed — `Markput`, `Core`, `Engine`, `Editor` — name the product or the
package rather than this object's role; `MarkputHandle` already carries the product name for the
thing a consumer holds; and `Store` is `useMarkput`'s selector parameter, so a rename lands in the
first line of every consumer that reaches the imperative surface. Against no defect and no better
name that is churn, which is what AGENTS.md's naming rule asks to weigh. The name is also now
published from BOTH adapters (see [03](03-row-node-not-nameable.md)), which makes the rename more
expensive than it was when the TODO was written, not less.

**3. `RowProps.index` is KEPT, and the doc now says what for.** "Measured removable" was never the
question — zero in-repo callers is not dead code for a published symbol, which is the reasoning
that kept `api.focus()` and `SelectionSnapshot.anchor`. The prop also earns its place on its own
terms: a row's node sees only itself, so a numbered list's ordinal is exactly the fact only the
parent that mapped the siblings can supply. Both adapters' doc comments carry the decision, so the
next audit meets it instead of re-measuring removability and stopping there.
