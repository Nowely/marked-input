# One render path for any root node

Type: grilling
Status: open
Blocked by: —  (04 resolved; slot-registry sub-question still open here)

## Question

`Container` forks per layout: `isBlock ? nodes.map(Block) : nodes.map(Token)`
(`Container.tsx:34-39` ≡ `Container.vue:49-54`). Rows render through
`slots.block` + the adapter's Block wrapper; marks resolve through
`options[descriptor.index].Mark`; `resolveMarkSlot` throws on a RowNode
(`slots/resolveSlot.ts:72-75`). `SlotName` is `'container' | 'block'` — there
is no `'mark'` slot name.

What is the single resolution path that renders any root node, and what is a
Row's default component? Where does block chrome (grip, menu, drop indicator)
enter that path — default components, slot layers, or consumer overrides?

Note the published contract: `slots.block` / `slotProps.block` are published
names and the glossary marks them "not a rename target" — a change here is a
declared breaking change, listed per the map's behavior-change rule.

## Direction taken 2026-08-22 — chrome leaves the row

The crux inside this ticket turned out to be a question no proposal asked:
**does block chrome live inside the row element at all?** The maintainer's
answer is **no** — grip, drop indicator and menu move out of the row into one
per-editor layer. The final render path is settled after [ticket 04](04-adapter-convergence.md)
prototypes that layer, which is why this ticket is now blocked on it rather
than blocking it.

Why this and not the measured alternative (A', where the row consigns the block
wrapper and its children go through a registered child-sequence host): four of
the six adversarial passes in round 1 independently proposed hoisting chrome —
two on this ticket, two on [01](01-per-node-state.md) — and none of the eight
proposals contained it. Hoisting dissolves problems the other options pay for:

- A's one extra `display:contents` span per row, and with it the 12 story
  snapshot re-baselines
- A's new hazard, where a custom `slots.block` that does not render children
  inside its own element registers no host, so `applyEditableState`'s
  value-only arm (`bind.ts:271-273`) writes `contenteditable=false` on the
  WHOLE row — measured `null` at HEAD, `'false'` under A, and no test covers a
  custom `slots.block`
- what killed option B: chrome sitting inside the caret's own host
- 01's keying question entirely — with no chrome in the row there is no per-row
  record to key
- most of this map's remaining adapter duplication

**It is a hypothesis, not a measurement.** The prototype must answer: row
geometry (today `.Block { position: relative }` at `styles.module.css:76-77` is
what makes `.SidePanel`/`.DropIndicator` free; a layer must track rects
instead), and the render fan-out — `DropIndicator` is rendered twice per row
and each instance subscribes to its own row's `dropPosition`
(`Block.tsx:56,64`), so a naive singleton invalidates 2N components per
dragover tick and no drag gate exists in `renderCount.spec.ts`.

**BEHAVIOR CHANGE to declare once, here, not per ticket:** chrome becomes
addressed by position rather than by row identity. ADR-0007 §3 named exactly
this case for drag chrome and decided against it, so this needs a narrow,
explicit ADR amendment. Note `.Popup` is already `position: fixed`
(`styles.module.css:38-39`), so the menu is viewport-positioned today.

Settled independently of the layer, under every surviving option:
`control()`'s `contenteditable` write stays. Verified twice in source —
`TokenModel.control():123-128` ("a menu opening off a block-store signal never
sees a re-bind, and would stay editable until some unrelated commit happened to
repaint") and `bind.ts:146`'s own comment. Both lenses measured the open popup
as editable without it. Any approach premised on folding `control()` away is
dead.

## The slot registry — taken 2026-08-22, sequenced after the layer

**Decision: the slot registry lands** — `slots: {container, text, mark, row}`
with mirrored `slotProps`, killing `props.Mark`, `props.Span`, `slots.block`
and the `'block'` special case. `options[i].Mark` stays the only per-option
override.

**But as its own PR, after the chrome layer.** Mixing the two puts two
breaking changes in one diff, and they break different things for different
reasons — one moves chrome out of rows, the other renames the consumer-facing
slot surface.

This is the largest declared break in the effort: ~42 files touch `Mark=`/
`Mark:`, 14 sites touch `Span`, plus the storybook, the website docs, both
demo apps and a typedoc regeneration. It renames what `CONTEXT.md:110` calls
"not a rename target", so that glossary entry is reopened deliberately, and
[ticket 06](06-is-a-row-a-token.md) is unblocked only once this lands.

The state it is repairing is worse than "published API being renamed" — the
pair is already half-broken, both verified by typecheck probes: **`slotProps.block`
typechecks on NEITHER adapter**, and `slots.block` only on React, because Vue
declares its own `Slots`/`SlotProps` extending neither core type. Meanwhile
`architecture.md:504` documents `block: MyCustomBlock` to consumers. Vue
consumers gain slots typing they do not have today.

Three things the registry work must not lose, all found in round 1: it drops
`resolveOptionSlot` (the published function-form `option.mark` transform) and
must decide whether `convertDataAttrs` applies to the new `text`/`mark` arms;
`TokenModel.ts:406-413`'s `#hasMark` gates whether a `Parser` is constructed at
all, so moving `Mark` into the registry moves the parse gate with it; and
`CoreSlotProps` is not exported from `packages/core/index.ts`, so "publish it
for real" also means a new core export.
