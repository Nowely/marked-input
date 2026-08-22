# Chrome-layer prototype

Type: prototype
Status: resolved

## Question

Re-scoped 2026-08-22, after the maintainer took the chrome-out-of-the-row
direction in [ticket 02](02-one-render-path.md). This was "adapter
convergence, blocked by 01 and 02"; it is now the prototype that validates the
direction those two tickets wait on.

Build the rough thing and measure it: block chrome — grip, drop indicator,
menu — rendered NOT inside each row, but as one per-editor absolutely
positioned layer addressed by row id. React only; the Vue mirror is a
question for afterwards.

What the prototype must answer, because none of it is measured:

1. **Row geometry.** Today `.Block { position: relative }`
   (`styles.module.css:76-77`) is what makes `.SidePanel` and `.DropIndicator`
   free — they are absolute inside it (`:86-87`, `:132-133`). A layer has to
   track row rects instead. Does that survive scroll, resize, wrapped rows, a
   row whose height changes as you type, and rows inside a consumer's own
   `slots.container`?

2. **Render fan-out.** `DropIndicator` is rendered twice per row and each
   instance subscribes to its own row's `dropPosition` (`Block.tsx:56,64`). A
   naive editor-level signal invalidates 2N components per dragover tick
   instead of 2. Measure it; `renderCount.spec.ts` gates exact numbers but has
   no drag gate, so a new one is part of the answer.

3. **Does the row element become its own child-sequence host?** That is the
   prize: it removes A's extra `display:contents` span and A's custom-
   `slots.block` freeze hazard. Confirm on real DOM, not on paper.

4. **Hit-testing and drag.** The grip is a drag source and the row is a drop
   target. With chrome outside the row, what listens where, and does HTML5
   drag still work when the source element is not a descendant of the row?

5. **What actually dies.** Count it: `Block.tsx`, `DragHandle.tsx`,
   `BlockMenu.tsx`, `DropIndicator.tsx` (192 lines React, 198 Vue), the
   per-row `control()` registrations, `BlockStore`'s three cleanup closures
   and its `refs.container` identity guard, `BlockController`'s WeakMap.

Do not land it. Link the prototype as an asset and report measurements. Two
facts to respect while building: `control()`'s `contenteditable` write is not
foldable (verified twice in source), and `refs.container` has exactly two
readers, both inside `BlockStore` — the guard at `:54` and `setDragImage` at
`:121` — while `Block.tsx:42-45` hands the SAME element to `consign(node.id)`
and `attachContainer`, so the registration is a provable duplicate.

## Answer

**CONFIRMED WITH CAVEATS, 2026-08-22.** Nothing refuted the direction. The
asset is branch `prototype/chrome-layer` (`4e041dd0`, committed `--no-verify`
— it carries A/B switches and counters and fails lint by design). Reproduce
with:

```
pnpm exec vitest run --project react \
  packages/storybook/src/pages/ChromeLayerPrototype/ChromeLayerPrototype.react.spec.tsx
```

All numbers are from real Chromium (Vitest browser mode + Playwright).

### 1. Row geometry — survives, drift 0 in every case

Grip centre minus row centre, HEAD as reference: **0px** for a plain row, a
wrapped multi-line row, page scroll +300, the decorated row growing as you
type, a row ABOVE growing +40px with the mouse still, the container narrowed
600→220, and a consumer `slots.container` with `overflow:auto` scrolled 300.

Container-local coordinates (`rect.top − containerRect.top +
container.scrollTop`) are scroll-proof by construction; a `ResizeObserver` on
the container catches the pure-layout push.

Two corrections worth carrying into the spec: **the layer's origin is the
container's PADDING box, so `left: 0`, not `-24`** — the gutter is already
inside it, and `-24` overshot by exactly the gutter and was clipped out of
existence inside an `overflow:auto` consumer container. And `.Container` must
gain `position: relative`; it is always applied via `cx(styles.Container, …)`
so `slots.container` cannot drop it, but a consumer inline
`style={{position:'static'}}` breaks the layer silently.

### 2. The row becomes its own child-sequence host — confirmed, and it is the strongest result

The row registers the SAME element via `tokens.consign(id)` and
`tokens.children(id)`. `bindingsFor`'s `element.contains(host)` accepts it (a
node contains itself), and in `applyEditableState` the chrome walk terminates
immediately because `host === root`. The bind change is **one self-gating
line**, leaving HEAD bit-for-bit unchanged:

```ts
if (node.kind !== 'row' || bindings.childSequenceHost) applyMountState(bindings, previous)
```

Measured row markup with chrome removed: `<div class="Block"><span>Row number
0</span></div>` — one element child, the text token's own surface, **no
`display:contents` wrapper**, `contenteditable` attribute `null`.

The freeze hazard that option A introduced is dissolved rather than avoided:
with a custom `slots.block` rendering children into an INNER div — the shape
that breaks option A — the row's `contenteditable` is still `null` and typing
lands. Self-registration cannot fail, because the row's own ref is markput's,
not the consumer's.

Blast radius, with self-hosting on inside the UNCHANGED `Block.tsx`: React
282 passed, core 1001/1001, Vue 233/233, typecheck green across 7 packages.

### 3. Render fan-out — the ticket's fear is refuted, at HEAD too

Per dragover tick, measured with an `await` between ticks (without it React
batches six ticks into one pass and you measure dirty components, not
renders):

| | N=50 | N=200 |
| --- | --- | --- |
| HEAD | `DropIndicator: 4` | `DropIndicator: 4` |
| Layer | `ChromeLayer: 2` | `ChromeLayer: 2` |

Both O(1) in N. Nothing invalidates 2N. Where the layer wins is **mount**:

| N=200 | HEAD | Layer |
| --- | --- | --- |
| mount | 44 ms | **18 ms** |
| component renders | 1007 | 204 |
| DOM nodes in host | 1005 | **403** |
| grip buttons in DOM | 201 | **0** (1 when hovered) |
| control roots (`ce=false`) | 201 | **1** |
| DOM listeners | 1608 | 7 |

**The one new cost:** HEAD hit-tests by DOM containment
(`mouseenter`/`mouseleave`, free); the layer hit-tests by rect on every
`mousemove`. Binary search over vertically tiled rows keeps it logarithmic —
10 `getBoundingClientRect()` per tick at N=50, 14 at N=200. Over 1000
synthetic mousemoves: HEAD 2.5 ms, layer 12.4 ms (N=50) / 14.3 ms (N=200).
Worst case, mousemove interleaved with DOM writes so each rect read forces a
reflow: HEAD 0.6 ms, layer **7.7 ms at N=200** (≈38 µs/tick, 15×). Still 0.2%
of a frame, but it scales with N and the spec should state a budget.

The drag gate the ticket asked for is expressible with the existing
`countRenders` helper — the regression a naive editor-level signal causes is
not indicator churn but a chrome signal read inside `Block`, which re-renders
every row and therefore every consumer `Mark`/`Span`. Measured today,
`Token` renders per dragover tick = 0 under both architectures, so the gate is
green at HEAD and pins the property the layer must not lose.

### 4. Drag — where it nearly died, and the cause was new

HTML5 drag with the source outside the drop target is fine; that half of the
worry was unfounded. `setDragImage` still needs the row element and reaches it
through `tokens.handle(id)?.element()` — the same registry `bind` reads — so
`BlockStore.refs.container` needs no replacement.

But the first prototype produced **zero native drag events**. Between mousedown
and Chromium's `dragstart` the pointer travels a few pixels; an unpinned layer
re-points the grip at whatever row that lands in, **the grip walks out from
under the pointer, and no drag ever starts.** Inside the row this is
structurally impossible — the grip moves with its row.

Pinning the hovered row on the grip's own `mousedown` and releasing on
container `mouseup`/`dragend` gives `{dragstart, dragover, drop, dragend,
dragenter}` all 1, the same reordered value and the same single `onChange` as
HEAD.

**The pin's first implementation broke a live core invariant:**
`listen(document, 'mouseup', …)` fails `SelectionDriver.spec.ts:339` ("the
sweep tracker's document listeners went with the flip"), which asserts that
mounting an editor attaches NO document mouse listener. Scoping the pin to the
grip's own mousedown plus a container mouseup fixes it and is more precise
anyway — pinning on any container mousedown would freeze hover during text
selection.

Also fine: hovering the grip does not extinguish hover (the layer is inside the
container, so mousemove still bubbles); gutter dragover works and the indicator
lands within 1px of HEAD; the menu opens off the grip and deletes the right
row, inheriting `isContentEditable === false` from the layer's single
`control()` root — which is what the 201→1 control-root reduction means, and
which makes the layer element itself load-bearing for freezing.

### 5. What dies — the concepts, not the lines

Code lines only, blanks and comments stripped, prototype scaffolding
subtracted.

**Dies in core (~129):** `BlockStore.ts` whole (122) — `refs.container` + the
identity guard, three cleanup closures, `attachContainer`/`attachGrip`/
`attachMenu`, `wireListeners`, five per-row signals, eight DOM handlers — plus
`BlockController.#stores` + `get()` and its rationale docblock (~7).

**Dies in React (~125):** `DragHandle.tsx` 46, `BlockMenu.tsx` 41,
`DropIndicator.tsx` 22, and `Block.tsx` 53→37.

**Added:** `ChromeModel.ts` ~160 production, `ChromeLayer.tsx` ~136,
`BlockLean.tsx` ~37.

**Net for React alone: core +31, React +11 — roughly flat, slightly up.** The
geometry that `.Block { position: relative }` did for free has to be written.
The reduction lands on the SECOND adapter: Vue's 198 lines collapse to one
`ChromeLayer` over the same `ChromeModel`, and the 8 `store.block.get(node)`
call sites × 2 frameworks go to zero. **That number is a projection — the Vue
mirror was not built.** The PR must say the code reduction is not there in one
adapter, and make its case on the runtime numbers and the concept count.

### Requirements this produces, for the spec

1. The drag source must not move between mousedown and dragstart. Not
   optional — without the pin, drag does not work at all.
2. The pin cannot use a `document` mouse listener (`SelectionDriver.spec.ts:339`).
3. `.Container` needs `position: relative`; the layer's origin is the padding
   box (`left: 0`).
4. A per-mousemove hit-test cost where HEAD had none: ~12 µs/tick steady, ~38
   µs/tick with a dirty layout at N=200.
5. `BLOCK_MENU_ITEMS.run: (store: BlockStore) => void` is **forced** open, not
   merely open — with no per-row store there is nothing to pass. The published
   signature must change. The map listed this as "after 04"; this is the
   answer.
6. ADR-0003's address-space grep matches on `.position` — a `drop.position`
   field tripped `addressSpace.spec.ts` as a false positive, cleared by
   renaming to `edge`. The chrome layer's vocabulary must dodge
   `position`/`slotRange`, or the gate needs narrowing.

### Two decisions this hands back to the maintainer

- **Where does the layer live?** The prototype put it inside the container,
  the only element markput reliably owns a class on. Consequence:
  `childrenOf(host)` stops meaning "the rows", and both `Drag.spec.ts:39` and
  `renderCount.spec.ts:26` define `rowsOf` that way, so both need a filter.
  The alternative is a new wrapper element in `MarkedInput` — a published DOM
  change. Neither branch is free.
- **`alwaysShowHandle` cannot be reproduced.** At HEAD every row renders its
  own always-visible grip (201 buttons at N=200). One layer can show one grip,
  so `alwaysShowHandle: true` under the layer means "one grip, on the row
  nearest the pointer" — a different feature from what ships. This is the one
  place the layer cannot match HEAD's behavior.

### Behavior changes measured, beyond those already declared

- Hover semantics change from DOM containment to geometric Y: the 24px gutter
  left of a row now hovers that row, and a point in the vertical gap between
  rows snaps to the nearest row where HEAD showed nothing.
- `alwaysShowHandle` as above.
