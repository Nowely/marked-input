# Three published-surface leftovers wanting a maintainer's yes

Type: task
Status: needs-triage
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
