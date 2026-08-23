# Row-controls-layer prototype

Type: prototype
Status: resolved

> **On the word "chrome" below.** It is banned in this repo — it collides with
> Chromium, which nearly every measurement here cites, and `block` was already
> the glossary's word. The prose has been swept. What survives is five literal
> CITATIONS to artifacts that exist outside this tree, on branch
> `prototype/chrome-layer` (`4e041dd0`): that branch's name, its
> `ChromeModel.ts` and `ChromeLayer.tsx`, its
> `ChromeLayerPrototype.react.spec.tsx`, and a render-counter label the
> prototype emitted. They are quoted as they are on that branch, with line
> references into it; renaming them would make the citations false. The shipped
> names are `BlockController` and `BlockControls`.

## Question

Re-scoped 2026-08-22, after the maintainer took the controls-out-of-the-row
direction in [ticket 02](02-one-render-path.md). This was "adapter
convergence, blocked by 01 and 02"; it is now the prototype that validates the
direction those two tickets wait on.

Build the rough thing and measure it: the block row controls — grip, drop indicator,
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
   target. With the controls outside the row, what listens where, and does HTML5
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
node contains itself), and in `applyEditableState` the control walk terminates
immediately because `host === root`. The bind change is **one self-gating
line**, leaving HEAD bit-for-bit unchanged:

```ts
if (node.kind !== 'row' || bindings.childSequenceHost) applyMountState(bindings, previous)
```

Measured row markup with the controls removed: `<div class="Block"><span>Row number
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
not indicator churn but an editor-level signal read inside `Block`, which re-renders
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
2. ~~The pin cannot use a `document` mouse listener
   (`SelectionDriver.spec.ts:339`).~~ **WITHDRAWN — see "The pin releases
   itself" below.** The prototype inferred the rule from a failing test, and a
   failing test is not a reason. Investigated and measured 2026-08-22: the rule
   is vestigial as written, the scope the prototype shipped instead is
   measurably broken, and the correct answer attaches no listener at all.
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
   renaming to `edge`. The controls layer's vocabulary must dodge
   `position`/`slotRange`, or the gate needs narrowing.

### Two decisions handed back, both taken 2026-08-22

- **The layer lives INSIDE the container** — as the prototype built it. The
  alternative, a new wrapper element in `MarkedInput`, is a published DOM
  change imposed on every consumer for internal convenience. The cost of this
  choice is that `childrenOf(host)` stops meaning "the rows": both
  `Drag.spec.ts:39` and `renderCount.spec.ts:26` define `rowsOf` that way and
  need a filter. Two test helpers, reversible.
- **`alwaysShowHandle: true` is redefined** as "one grip, on the row nearest
  the pointer". At HEAD every row renders its own always-visible grip (201
  buttons at N=200) and one layer can show one, so today's meaning is not
  reproducible. **BEHAVIOR CHANGE on a published option — declare it.** The
  rejected alternative was letting rows keep rendering their own grip under
  this flag, which would preserve exactly the duplicated branch this whole
  effort exists to delete.

## The pin releases itself — investigated 2026-08-22

The prototype wrote a rule it had invented: `ChromeModel.ts:74-77`, "a live
invariant that mounting an editor attaches no document mouse listener", citing
`SelectionDriver.spec.ts`. The maintainer sent it back: a failing test is not a
reason. Three agents investigated; the maintainer was right, and the answer is
better than either option under discussion.

### The rule as written is vestigial, and already false in shipped code

There is **no stated reason anywhere** for a general ban — searched every
commit body on every branch, all nine ADRs, `docs/records/`, `CONTEXT.md`, the
website docs. What exists is a reason for deleting the FLIP, not for forbidding
document listeners.

"The flip" was `SelectionDriver.#trackUserSelecting`: three document mouse
handlers feeding `#applyEditablePolicy`, which wrote `contenteditable=false` on
EVERY per-token host for the duration of a mouse sweep.
`docs/records/one-host-migration.md:125`: "The entire `isUserSelecting` sweep
flip (~64 production lines + 14 spec references) exists to let a drag escape the
host it started in. One host has nothing to escape." The assertion is a
**deletion pin, written in the same commit (`9f824829`) that performed the
deletion** — its own name says so: "the sweep tracker's document listeners went
WITH THE FLIP".

**The ban is already violated in production core**, verified by code read:
`BlockStore.ts:80` `attachMenu(el)` calls `wireListeners(document, {mousedown,
keydown})`, wired by both adapters. `OverlayController.ts:117-133` attaches a
capture-phase document `click` while a match is live. A lazily attached,
interaction-scoped document mouse listener is an ESTABLISHED shipped pattern
here. The mount-time spy simply cannot see one.

**And the assertion encodes a call shape, not a property.** Measured with three
probes: `document.addEventListener('mouseup', fn, undefined)` fails it, but
`(…, {capture: false})` and the two-argument form both walk straight past. A
real mount-time `listen(document, 'mouseup', fn, {capture: false})` was patched
into `SelectionDriver.ts` and the spec file ran 22 passed / 0 failed. An
invariant satisfiable by adding an empty options object is not an invariant.

### What survived, narrower

Two properties, both real, neither previously asserted:

1. **Mount takes no page-wide pointer stream.** Measured on a document-level
   release: every mounted editor's handler runs on every mouseup anywhere,
   forever — the cost scales with editor count. Harmless for this particular
   handler (an unpinned model's release is a no-op; two editors measured, the
   uninvolved one's handler fires but does nothing) but it is coupling with no
   expiry, and it is exactly what made the deleted sweep flip damaging.
2. **Unmount gives back what mount took.** Upheld today by `Host.onMounted`'s
   `effectScope` — and never tested. The old assertion could not see a leak at
   all; a raw leaked `document.addEventListener('keyup', fn)` at mount passes it.

### The scope: the pin releases itself, attaching nothing

Six scopes were measured across eleven cases in real Chromium (98 tests). The
winner attaches **no listener anywhere**: the pin is armed by the grip's own
mousedown and expires inside the one handler that reads it, plus `endDrag()`.

```ts
#frozen(e: MouseEvent): boolean {
    // The pin is gesture state, so it expires with the gesture, not with the editor: the
    // only reader of `#pinned` is a container mouse handler, and it clears the pin the
    // first time it sees an event with no button held. A press that never becomes a drag
    // and never releases inside the container therefore heals on re-entry instead of
    // wedging the layer (measured: draggable:false, release on BODY).
    if (this.#pinned && e.buttons === 0) this.release('buttons-idle')
    return this.#pinned
}
```

`endDrag()` already calls `release('dragend')` for the drag path, where
Chromium delivers no mouseup at all — measured event order:
`pointerdown, mousedown, dragstart, pointercancel, drop, dragend`.

**The scope the prototype actually shipped — container `mouseup` — is
measurably broken**, and the test had nothing to do with it. Deciding case:
`draggable: false`, press the grip, leave the container, release on `BODY`.
Container-scoped and dragend-only both **wedge permanently**
(`hoverAfterReenter: 1` — the layer is stuck on the pressed row forever). The
self-healing pin reports `pinnedAtRelease: true` but `pinnedAfterReenter:
false`, hover correct on the next move.

Ranked behind it: a one-shot document mouseup armed on press is correct in
every case and is the established lazy pattern, but leaks one closure past
unmount. Pointer capture is correct and is the platform primitive, but
retargets compat mouse events to the grip for the whole press — a real side
effect next to a `contenteditable` — and its release fires mid-drag, correct
only while the mousemove handler stays gated on `dragging() !== null`.

**`SelectionDriver.spec.ts:328-343` is amended, not loosened** — the
replacement was written and run: green at HEAD, red against a mount-time
`{capture:false}` listener the old form passes, red against a leaked `keyup`
the old form cannot see. It asserts on the event NAME (no options-object escape
hatch) that mount attaches no `mouse*`/`pointer*`/`drag*`/`touch*` handler to
`document`, and that unmount removes exactly the handlers mount added.

**Residual risk, stated rather than buried:** the pin can be stale — `true`
after the physical release, until the next container mouse event. Unobservable
by construction today, because the only reader is the handler that clears it
first. But that is a discipline, not a mechanism: a second reader that is not a
container mouse handler (a keyboard path, a render-time read, a `dragstart`
guard) would see a pin belonging to a gesture that ended, and nothing asserts
otherwise. Also unfixed, though not a regression since every scope shares it:
while the pointer is outside the editor with the pin set, the grip stays painted
on the pressed row until the pointer returns.

### Behavior changes measured, beyond those already declared

- Hover semantics change from DOM containment to geometric Y: the 24px gutter
  left of a row now hovers that row, and a point in the vertical gap between
  rows snaps to the nearest row where HEAD showed nothing.
- `alwaysShowHandle` as above.
