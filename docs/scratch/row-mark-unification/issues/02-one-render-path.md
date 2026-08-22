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

Still open here after the prototype: the slot registry (option D — `slots:
{container, text, mark, row}`, killing `props.Mark`, `props.Span`,
`slots.block` and the `'block'` special case). It is independent of the chrome
question and is the one option that renames what `CONTEXT.md:110` calls "not a
rename target", so [ticket 06](06-is-a-row-a-token.md) waits on it. Facts it
needs, both verified by typecheck probes: `slotProps.block` typechecks on
NEITHER adapter, and `slots.block` only on React — Vue declares its own
`Slots`/`SlotProps` extending neither core type — while `architecture.md:504`
documents `block: MyCustomBlock` to consumers.
