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
Row's default component? Where do the block row controls (grip, menu, drop indicator)
enter that path — default components, slot layers, or consumer overrides?

Note the published contract: `slots.block` / `slotProps.block` are published
names and the glossary marks them "not a rename target" — a change here is a
declared breaking change, listed per the map's behavior-change rule.

## Direction taken 2026-08-22 — the row controls leave the row

The crux inside this ticket turned out to be a question no proposal asked:
**do the block row controls live inside the row element at all?** The maintainer's
answer is **no** — grip, drop indicator and menu move out of the row into one
per-editor layer. The final render path is settled after [ticket 04](04-adapter-convergence.md)
prototypes that layer, which is why this ticket is now blocked on it rather
than blocking it.

Why this and not the measured alternative (A', where the row consigns the block
wrapper and its children go through a registered child-sequence host): four of
the six adversarial passes in round 1 independently proposed hoisting them —
two on this ticket, two on [01](01-per-node-state.md) — and none of the eight
proposals contained it. Hoisting dissolves problems the other options pay for:

- A's one extra `display:contents` span per row, and with it the 12 story
  snapshot re-baselines
- A's new hazard, where a custom `slots.block` that does not render children
  inside its own element registers no host, so `applyEditableState`'s
  value-only arm (`bind.ts:271-273`) writes `contenteditable=false` on the
  WHOLE row — measured `null` at HEAD, `'false'` under A, and no test covers a
  custom `slots.block`
- what killed option B: the controls sitting inside the caret's own host
- 01's keying question entirely — with no controls in the row there is no per-row
  record to key
- most of this map's remaining adapter duplication

**It is a hypothesis, not a measurement.** The prototype must answer: row
geometry (today `.Block { position: relative }` at `styles.module.css:76-77` is
what makes `.SidePanel`/`.DropIndicator` free; a layer must track rects
instead), and the render fan-out — `DropIndicator` is rendered twice per row
and each instance subscribes to its own row's `dropPosition`
(`Block.tsx:56,64`), so a naive singleton invalidates 2N components per
dragover tick and no drag gate exists in `renderCount.spec.ts`.

**BEHAVIOR CHANGE to declare once, here, not per ticket:** the row controls become
addressed by position rather than by row identity. ADR-0007 §3 named exactly
this case for the drag controls and decided against it, so this needs a narrow,
explicit ADR amendment. Note `.Popup` is already `position: fixed`
(`styles.module.css:38-39`), so the menu is viewport-positioned today.

Settled independently of the layer, under every surviving option:
`control()`'s `contenteditable` write stays. Verified twice in source —
`TokenModel.control():123-128` ("a menu opening off a block-store signal never
sees a re-bind, and would stay editable until some unrelated commit happened to
repaint") and `bind.ts:146`'s own comment. Both lenses measured the open popup
as editable without it. Any approach premised on folding `control()` away is
dead.

## The component surface — PAUSED 2026-08-23, direction taken, not executed

**Status: parked by the maintainer. Do not start this without reopening the
discussion.** The direction below is settled; the design around it is not, and
two sub-questions are open at the bottom.

### The reframe, and why the first decision was wrong

On 2026-08-22 this ticket recorded "the slot registry lands": `slots: {container,
text, mark, row}` with mirrored `slotProps`, killing `props.Mark` and
`props.Span`. That decision was reached from the INSIDE — two resolvers, a
`throw` on `RowNode`, broken typing — and it silently let internals dictate the
shape of the public API.

The maintainer rejected it on API grounds (2026-08-23): `<Markput Mark={Tag} />`
is minimal and pleasant, and burying the most-used prop in a registry makes the
common case worse to fix an uncommon inconsistency.

**Measured across the storybook and both demo apps:** `Mark=` as a prop appears
**73** times, `Span` 13, and `slots=` **9**. The flat prop is used an order of
magnitude more than the registry.

**And flat IS the house convention already.** Component-shaped props at top
level: `Mark`, `Span`, `Overlay`. In `slots`: `container`, `block`. The registry
is the minority. "Unify on the registry" meant pulling the majority into the
exception.

### The boundary `slots` was meant to draw — and why it no longer holds

The maintainer's account of the original intent: `slots` was for overriding
markput's own INTERNAL components — `container`, the element markput runs
inside — as opposed to the content components a consumer supplies.

That is a real category, but the code does not honour it. **`Overlay` is an
internal-component override and it is already a flat prop** — its own docblock
reads "Global component used for rendering overlays (fallback for
`option.Overlay`)", i.e. the consumer replacing what markput draws its
suggestion popup with. By the stated rule it belongs in `slots`. It never went
there.

So today's split is accidental, not principled: an internal component outside
(`Overlay`), two internal components inside (`container`, `block`), and content
components outside (`Mark`, `Span`). There is no rule that predicts which is
which — that is why the distinction was never written down anywhere.

### Direction taken: flat props

`slots` and `slotProps` dissolve. `container` → `Container`, `block` → `Row`,
`slotProps.container` → `containerProps`. `Mark={Tag}` is untouched, and with it
73 of the 82 live call sites.

The internal-vs-content distinction survives — it moves out of the SHAPE and
into the NAME plus the glossary, the same way `*Model` and `*Controller` carry
role here. `Container`, `Row`, `Overlay` are self-evidently the editor's
internals; `Mark` and `Span` are what the consumer supplies. `CONTEXT.md` has no
entry about slots at all today, which is precisely how the original rule got
lost; a **Slot** entry should record it when this work lands.

### Open sub-questions, both to settle before any code

- **`Row` or `Block`?** The glossary says the unit is a **Row**, but the
  published contract carries the wider word (`slots.block`, `slotProps.block`,
  `isBlock`, and `CONTEXT.md:110` calls those "not a rename target"). This
  collision has to be decided out loud, not inherited.
- **Does `Overlay` get renamed** now that the internals sit beside each other?
  It is already flat, so nothing forces it — but leaving it is a choice too.

### What the internal half changes, under ANY outward shape

This part was never in dispute and can be done independently of the API
decision: one resolver with an arm per node kind instead of `resolveSlot` +
`resolveMarkSlot`; the `throw` on `RowNode` disappears; `slots: unknown` and its
`as`-casts go through the existing `SlotRegistry` augmentation; `CoreSlotProps`
gets exported. Vue gains typing it does not have today.

### The damage that is already shipped

Verified by typecheck probes, and true right now: **`slotProps.block` typechecks
on NEITHER adapter**, and `slots.block` only on React — Vue declares its own
`Slots`/`SlotProps` in `packages/vue/markput/src/types.ts` extending neither core
type, with `container` alone. React's `Slots extends CoreSlots` but its
`SlotProps` is declared from scratch, also `container` alone. Meanwhile
`architecture.md:504` documents `block: MyCustomBlock` to consumers.
`packages/core/index.ts` exports `CoreSlots` but not `CoreSlotProps`, and
`resolveSlot` is forced to take `slots: unknown` and cast, with an
oxlint-disable and a comment blaming Vue `Ref<T>` compatibility.

### Three things this work must not lose, whatever shape it takes

Found in round 1 and still true: it drops `resolveOptionSlot` (the published
function-form `option.mark` transform) and must decide whether
`convertDataAttrs` applies to any new arms; `TokenModel`'s `#hasMark` gates
whether a `Parser` is constructed AT ALL, so moving `Mark` anywhere moves the
parse gate with it; and `CoreSlotProps` must actually be exported, not merely
declared.

### Blast radius, for whenever this resumes

~42 files touch `Mark=`/`Mark:`, 14 touch `Span`, plus the storybook, the
website docs, both demo apps and a typedoc regeneration. Under the flat-props
direction the `Mark`/`Span` sites do NOT move — only the 9 `slots=` sites and
their types do — so the break is far smaller than the registry version implied.
[Ticket 06](06-is-a-row-a-token.md) stays blocked on this only because of the
`Row`-versus-`Block` naming question above.
