# TokenModel — core architecture

**Historical record.** Generated from the working tree at commit `7f374f33`; every claim was traceable to `packages/core/src/features/tokens/` at that point. Parts have since been superseded — the one-host migration closed cost centre 2, and S2 addressing closed the offset half of cost centre 1. Read it for how the value owner is put together, not as a current-state report. The original rendered document is at `git show f384c5e6:docs/adr/0003-tokenmodel-architecture.html`.

TokenModel is the value owner of markput's core: it holds the token tree, the string boundary that decides commit policy, the transaction verbs that write it, the selection, and the one commit pipeline that puts the result in the DOM. 593 lines, 30 public members, 8 collaborators, 4 write verbs.

## The one fact that explains the rest

**The tree is the source of truth for reads and identity — but not for writes.** Every write still lowers to a _string splice_, gets the whole document _re-parsed_, and then `adopt()` re-derives which nodes survived by walking a window. The tree is a projection of a projection.

That single design choice is what pays for `gapWindow`, `findGap`, the echo protocol, `lastEmitted`, the `#committed` mirror signal and the dev divergence detector. If you ever wonder why a mechanism here is subtle, it is almost always because identity has to be _recovered_ after the fact instead of being _preserved_ by construction.

## Layer map

Three colours in the original: `tree/` is the model with no DOM, `dom/` is DOM I/O, `seam/` is the shell that wires them.

### adapters + store — outside core

|                       |                                                                                                                                                      |                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `Store`               | Assembly root. Constructs host, props, tokens, then the feature controllers in a fixed order — `host.onMounted` callbacks run in registration order. | `store/Store.ts`               |
| `MarkputApi`          | The ref handle: `container` and `focus()`. The v2 read/write verbs were withdrawn — writes ride the `value` prop, mark verbs ride `useMark()`.       | `store/MarkputApi.ts`          |
| React / Vue           | Render `TreeNode` off `nodes()`, re-render on `renderEpoch`, register refs through `control()`/`children()`. Four members total.                     | `packages/{react,vue}/markput` |
| `PropsModel` / `Host` | value, defaultValue, options, Mark, readOnly, layout · container element + mounted/rendered lifecycle signals.                                       | `features/state/`              |

↓ props in · nodes + renderEpoch out ↓

### seam/TokenModel.ts — the single entry point, 593 lines

|                    |                                                                          |                              |
| ------------------ | ------------------------------------------------------------------------ | ---------------------------- |
| `#tree`            | `createTokenTree` — roots signal, value computed, id allocator.          | `seam/TokenModel.ts:417`     |
| `#boundary`        | Commit policy + arrival routing. Owns parse and the echo record.         | `seam/TokenModel.ts:478`     |
| `#tx`              | The write verbs. Lowers everything to one splice + window.               | `seam/TokenModel.ts:499`     |
| `#pipeline`        | One `apply()`, the render epoch, the pending latch, the `changed` event. | `seam/TokenModel.ts:535`     |
| `#dom`             | `DomModel` — all DOM reads/commands, delegated as one-liners.            | `seam/TokenModel.ts:547`     |
| `#selectionDriver` | Selection DOM I/O. Built in the constructor, not as a field.             | `seam/TokenModel.ts:561`     |
| `#nodes`           | `Map<id, TokenHandle>` — the live node layer the pipeline mutates.       | `seam/TokenModel.ts:533`     |
| value state        | `#seed` · `#seeded` · `#restore` · `#controlled` · `#committed`          | `seam/TokenModel.ts:452-476` |

↓ owns and wires ↓

### tree/ — the model; anchors, no offsets escape; 10 modules

|                         |                                                                                                                                         |                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `tree.ts`               | `TokenTree`: roots, `value = joinNodes(roots)`, `buildNode`. Plus `findNode`, `rootIndexOf`, `siblingOf`, `sliceNodes`.                 | `tree/tree.ts`          |
| `transactions.ts`       | `applyRange` · `applyText` · `applyStructural` · `tx`. Sorts ops, builds next, computes the hull window. Nothing here mutates the tree. | `tree/transactions.ts`  |
| `valueBoundary.ts`      | `sink.commit` (adopt now vs emit and wait), `arrive`, `reparse`. Owns `lastEmitted`.                                                    | `tree/valueBoundary.ts` |
| `adopt.ts`              | Fold a fresh parse back into persistent nodes: agreement keeps the object, and therefore the id. Returns `TransactionResult`.           | `tree/adopt.ts`         |
| `anchors.ts`            | `anchorAt` · `offsetOfAnchor` · `adjacentMark` · `stepAnchor` · `anchorEquals`. The only legal place to form a number.                  | `tree/anchors.ts`       |
| `selection.ts`          | Stored anchors, `isAllSelected`, `caretAnchor`, `select`/`selectNode`/`selectAll`/`clear`, `repair(result)`.                            | `tree/selection.ts`     |
| `gapWindow` / `findGap` | Derive a minimal splice window from two strings — the fallback when an arrival is not an exact echo.                                    | `tree/gapWindow.ts`     |
| `types.ts`              | `TreeNode` · `NodeAnchor` · `Anchors` · `Window` · `TransactionResult` · `CommitSink` · `MarkCommands`.                                 | `tree/types.ts`         |

### dom/ — bind, patch, select, place the caret; 9 modules

|                                         |                                                                                                                                                                             |                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `bind.ts`                               | One DOM+tree walk: resolves `tokenElement` / `textElement` / `rowElement` / `childSequenceHost` per node, applies mount-time editable state, returns element-keyed lookups. | `dom/bind.ts`            |
| `commit.ts`                             | `createCommitPipeline`: apply, onRendered, renderEpoch, changed, pending, bound, byElement, isControlRoot. Plus the dev divergence detector.                                | `dom/commit.ts`          |
| `TokenHandle.ts`                        | A node's DOM record: bindings + the single per-surface effect that mirrors `node.text()`. Holds no model data.                                                              | `dom/TokenHandle.ts`     |
| `DomModel.ts`                           | `handleAt` · `anchorFor` · `selection` · `selectedContent` · `placeCaret` · `selectRange`.                                                                                  | `dom/DomModel.ts`        |
| `SelectionDriver.ts`                    | Listeners, DOM→anchor sync, caret application, the mouse-sweep flag, and the editable policy.                                                                               | `dom/SelectionDriver.ts` |
| `editableState.ts`                      | The only production write of `contentEditable` in the workspace, plus tabindex on mark roots.                                                                               | `dom/editableState.ts`   |
| `caret` / `textOffsets` / `domBoundary` | Caret placement, text length and offset math, DOM boundary resolution.                                                                                                      | `dom/`                   |

### parser/ — string → Token[], reached only by the boundary

|                      |                                                                                               |                 |
| -------------------- | --------------------------------------------------------------------------------------------- | --------------- |
| Parser + TreeBuilder | Markup patterns → `Token[]`. Full document, every commit — incremental parsing was deleted.   | `parser/`       |
| utils                | `annotate` · `denote` · `toString` · `filterEmptyText` (block mode only) · `createTextToken`. | `parser/utils/` |

### Ownership rules that hold

Only `adopt()` writes tree nodes. Only the transaction layer refuses a write (readOnly, dead node, out-of-range, overlapping ops). Only the commit pipeline mutates the handle map. Only `tree/` may form a numeric offset — everything above it speaks `NodeAnchor`. Adapters touch four members: `nodes`, `renderEpoch`, `control`, `children`.

## Write path

One keystroke, end to end. The controlled-mode branch splits at step 6 and rejoins at step 8 when the parent echoes the value back.

### 1. A verb is called — `seam/TokenModel.ts`

Four write verbs exist, and every one of them ends in the same place: _replaceBetween_ (cross-node, anchor-addressed), _applyText_ (node-local), _tx_ (buffer several, commit once) and the private _#applyStructural_ (whole-node — the mark verbs' path). `setValue` is just `replaceBetween('start','end', …)`.

```ts
replaceBetween(from: NodeAnchor, to: NodeAnchor, text: string): NodeAnchor | undefined
```

### 2. Materialize the tree if it is cold — `#ensureSeeded`

The write path materializes on first use rather than waiting for mount, because specs edit unmounted stores. These reads are deliberately _tracked_, where every other read on this path is `untracked` — wrapping them would drop a subscription a reactive writer on an unseeded store currently gets.

```ts
if (this.#seeded()) return
this.#onExternalValue(this.props.value())
```

### 3. Lower the anchors to a splice — tree coordinates

Anchors become numbers _here and nowhere above_. The offsets are formed against `#tree.value()` — not `value()`, which is props-first and outruns the tree mid-flight. A whole-value op is re-derived through `gapWindow`: a full window would make both adoption walks inert and re-pair every row by index, moving per-row state onto the wrong row.

```ts
const a = offsetOfAnchor(roots, from),
    b = offsetOfAnchor(roots, to)
const start = Math.min(a, b),
    end = Math.max(a, b)
if (start === 0 && end === value.length) window = gapWindow(value, text)
```

### 4. Validate, or refuse — `tree/transactions.ts`

One refusal rule for the whole layer: the refusing call answers `false` at once, and inside a `tx` it also _poisons the batch_, so a caller's intent is never half applied. readOnly, out-of-range, a dead node, overlapping ops in one tx — all refuse.

```ts
if (isReadOnly()) return refuse()
if (op.start < 0 || op.end < op.start || op.end > currentValue().length) return refuse()
if (pending.ops.some(other => overlaps(op, other))) return refuse()
```

### 5. Build the next string and the hull window — dispatch

Ops are sorted by `start`, then by `end` — and that tie-break is load-bearing: on `start` alone a zero-length op at the head of a range op can sort first, drive the cursor backwards and re-emit the span it just deleted. The window is the hull: first start, last end, and the total length delta.

```ts
for (const op of sorted) {
    next += value.slice(cursor, op.start) + op.text
    cursor = op.end
}
next += value.slice(cursor)
window = {start, end, insertedLength: end - start + (next.length - value.length)}
```

### 6. Commit policy — the fork — `tree/valueBoundary.ts`

_Uncontrolled:_ fold now, then emit. Emission follows adoption, because an `onChange` consumer that reads the tree must not be called before the commit lands.

_Controlled:_ record the emission and return — the parent owns the value. A controlled verb reports success on the _emission_, not on a commit that may never come; anything else would read as a refusal.

```ts
if (controlled()) {
    lastEmitted = {base: tree.value(), value: next, window}
    onChange(next)
    return true
}
fold(next, window)
onChange(next)
return true
```

### 7. …the echo comes back (controlled only) — `arrive()`

The parent re-renders with a new `props.value`, the mount watch fires, and `arrive` decides the window. The recorded one is used only if this really is that emission's echo _and_ the tree still holds the base it was spliced from. Anything else — a transform, a stale echo, an external value — falls back to `gapWindow`.

```ts
const emission = lastEmitted
lastEmitted = undefined
fold(value, echoWindow(emission, value, current) ?? gapWindow(current, value))
```

### 8. Capture the selection, parse, adopt — `fold()`

The single funnel every adoption runs through — commit, arrival and reparse alike. The selection is read _before_ `adopt`, because adoption repairs it through `onResult`. In block mode the parse is filtered of empty top-level text tokens.

```ts
const selectionBefore = deps.selection?.()
const parsed = parseValue(deps.parser(), next)
const tokens = isBlock() ? filterEmptyText(parsed) : parsed
const result = adopt(deps.tree, window, tokens, selectionBefore)
```

### 9. Recover identity — `tree/adopt.ts`

The heart of it. A fresh parse of the whole document is folded back into the persistent nodes: _nodes the parse agrees with keep their object, and therefore their id_. Prefix and suffix walks are bounded by the window; the middle re-pairs. Selection offsets are formed _pre_-mutation, because the batch below rewrites positions in place and a later reading would be shifted twice.

```ts
const beforeOffsets = selectionBefore && {
    anchor: offsetOfAnchor(prev, selectionBefore.anchor),
    head: offsetOfAnchor(prev, selectionBefore.head),
}
// → TransactionResult {structural, render, added, removed, updated, selectionAfter, map}
```

### 10. One batch, three writes, in this order — `onResult`

Order is load-bearing and the `batch` is what makes it observable. `#committed` is written _after_ `pipeline.apply` — publishing it first hands subscribers a new string over a stale token view. `repair` runs last, so an imperative post-edit caret lands later in the same batch and wins by design. `changed` is an _event_: at batch depth 0 it flushes its subscribers inside `apply`, ahead of both writes.

```ts
batch(() => {
    this.#pipeline.apply(result)
    this.#committed(this.#tree.value())
    this.selection.repair(result)
})
```

### 11. Route: repaint or announce — `dom/commit.ts`

If the result says `render` — or a structural pass is already pending — latch, bump the epoch and return; the announcement waits for the paint. Otherwise this was text-only: the DOM was already written by the per-surface effects, so all that is left is the announcement.

```ts
if (result.render || pendingStructural) {
    pendingStructural = true
    renderEpoch(++epoch)
    return
}
changed(drainDelta(pendingDelta))
```

### 12. Text reaches the DOM without the pipeline — `dom/TokenHandle.ts`

One writer per surface, armed by `bind`, subscribed to that node's own `text` signal. The equality check is not an optimization: on a _split_ surface — two Text children, which `splitText` and the browser's own editing leave behind — writing the same string collapses them into one and drops the caret from 4 to 0.

```ts
this.#disposeText = effect(() => {
    const text = node.text()
    if (surface.textContent !== text) surface.textContent = text
})
```

### 13. Bind, then announce — adapter → `onRendered`

The adapter re-renders on `renderEpoch`, the host's `rendered` signal fires, and the pipeline does one DOM+tree walk onto the node layer: handles get their elements, text effects are re-armed, editable state is applied to new surfaces. Then the accumulated delta drains and `changed` fires — once, merged, with the DOM already consistent.

```ts
const result = bind({container, roots, nodes, controlElements, childSequenceHostsFor, isBlock, editable})
byElement = result.byElement
controlRoots = result.controlRoots
const delta = drainDelta(pendingDelta)
pendingStructural = false
changed(delta)
```

## Read path

### The two reads everything else derives from

**`value: Computed<string>`** — the string projection. Props-first, so in controlled mode it can run _ahead of the tree_ while an emission is in flight.

```ts
props.value() ?? (#seeded() ? #committed() : #seed())
```

**`nodes: Computed<readonly TreeNode[]>`** — THE render read, live root nodes. A `Computed` field and not a method, so an adapter selector can subscribe to it; a plain method would be handed to the renderer uncalled.

```ts
computed(() => #tree.roots())
```

### These two disagree on purpose

`value` is props-first; the tree holds the last _arrival_. They diverge exactly while a controlled parent's value is ahead of the last echo. That is why every write verb lowers its offsets against `#tree.value()` and never against `value()` — and why `setValue` addresses `'start'`/`'end'` rather than `{0, value().length}`.

_Source: TokenModel.ts — replaceBetween, setValue, #offsetOf_

### Why `#committed` exists at all

`adopt()` writes `tree.roots` inside its own `batch`. That batch flushes _before_ the pipeline applies, so a subscriber reading `#tree.value()` would get the new string over a stale token view. `#committed` is written by `onResult` _after_ `pipeline.apply`, so the string and the nodes publish together. One writer, and its content is the tree's own projection read at that instant — so drift is unrepresentable.

### Node shape

```ts
// tree/types.ts — one structure; adoption is the only writer
type TextNode = {kind: 'text'; id; text: Signal<string>; position; range()}
type MarkNode = {
    kind: 'mark'
    id
    descriptor
    markup
    value: Signal
    meta: Signal
    children: Signal<TreeNode[]>
    slotRange
    position
    slot()
    range()
    update(patch)
    remove()
}

// the addressing model — no offsets above tree/
type NodeAnchor = {node: TextNode; offset} | {before: TreeNode} | {after: TreeNode} | 'start' | 'end'
```

A mark's interior is addressed through its slot _text_ children — never by an offset into the mark. `position` is a plain field, rewritten in place by adoption, so a moved node produces no signal and reaches no change feed; whole-tree correctness for positions is held by the snapshot oracle in the property suite.

## Value state

### Five fields, and what each one is actually for

| field         | what it is for                                                                                                                                                                                | shape                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `#seed`       | The lazily-materialized default, so a `defaultValue` set after the first read stays a no-op.                                                                                                  | `signal({initial: () => props.defaultValue() ?? ''})` |
| `#seeded`     | One-shot: the tree holds a value. A _signal_, not a flag — `value` routes on it, and a plain field would leave that computed permanently subscribed to `#seed` and blind to the first commit. | `signal({initial: false})`                            |
| `#restore`    | Where an uncontrolled fallback returns to. Re-recorded per arrival until control is taken; frozen on entering controlled mode.                                                                | `string \| undefined`                                 |
| `#controlled` | Edge detector for uncontrolled→controlled. A field, not watch's `previous`, so a container swap cannot make a remount look like a fresh edge.                                                 | `boolean`                                             |
| `#committed`  | `join(tree)` as of the last _completed_ commit. One writer, written after `pipeline.apply`.                                                                                                   | `signal({initial: ''})`                               |

### Controlled vs uncontrolled — the whole difference

**uncontrolled** — the sink _adopts immediately_, then calls `onChange`. The tree moves on the spot; the caret answer from `replaceBetween` is real.

```ts
fold(next, window) → onChange(next) → true
```

**controlled** — the sink _emits and waits_. It records the emission and returns `true` on the emission, not on a commit that may never come. The tree has not moved, so the returned anchor describes the _pre-edit_ tree and callers use it only as a success flag.

```ts
lastEmitted = {base, value, window} → onChange(next) → true
```

### The echo protocol

When the value comes back from the parent, `arrive()` has to decide which window to adopt it through. The record is consumed by the _first_ arrival whether it matches or not, so a stale echo can never stay armed.

```ts
const emission = lastEmitted
lastEmitted = undefined
const current = tree.value()
fold(value, echoWindow(emission, value, current) ?? gapWindow(current, value))

// echoWindow returns the exact recorded window only when BOTH hold:
//   emission.value === value   ← this really is that emission's echo
//   emission.base  === current ← the tree still holds what the splice was computed from
```

Both branches are continuity-preserving, so the check buys _identity precision_, not correctness: on repeated content the two windows disagree about which repeat survived. Gap-derivation also makes an arrival equal to the current projection an inert no-op rather than a rebuild.

### Changed in the session that produced this record

`#restore` used to be written only on the uncontrolled→controlled edge. A container re-attach rebuilds the mount scope and re-runs the watch's immediate arm, which has no `previous` — so it fell back to `#seed()` and silently reset an uncontrolled editor to `defaultValue`. It now re-records on every arrival while no parent owns the value, and freezes on entering controlled mode. An uncontrolled edit made _before_ mount now survives mounting too. Both are pinned in `TokenModel.value.spec.ts`.

## Commit pipeline

### One entry, one question: must the renderer run?

`apply(result)` routes on the producer's own `render` bit. Text no longer travels through the pipeline at all — `bind` arms a per-surface effect on every bound text node, so a text-only commit reaches the DOM off that node's own signal and `apply` is left with nothing but the announcement.

**text-only path** — no re-bind, no renderer. The per-surface effect writes `textContent`; the pipeline drains the delta and fires `changed`.

```ts
changed(drainDelta(pendingDelta))
```

**structural path** — latch `pendingStructural`, bump `renderEpoch`, and _return_. The announcement waits for the adapter to paint and call `onRendered`.

```ts
pendingStructural = true
renderEpoch(++epoch)
```

### The pending latch — a fail-closed window

Between a structural apply and its bind, the node layer is one generation stale. While the latch is up, `handle(id)` answers `undefined`, so nothing can act on a tree the DOM never showed. _Every_ apply that lands in that window folds into the pending pass and announces with it — a consumer pruning off `removed` cannot miss a wave.

```ts
if (result.render || pendingStructural) {
    pendingStructural = true
    renderEpoch(++epoch)
    return
}
changed(drainDelta(pendingDelta)) // text-only

// foldDelta is exact because ids are never reused within an input instance:
// added-then-removed before the paint never existed for a consumer.
```

### The delta contract

| field     | granularity       | why                                                                                                                                                                              |
| --------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `added`   | subtree-inclusive | A born mark contributes every descendant id. Roots-only `added` folded against subtree-inclusive `removed` would announce removals for ids the consumer was never told existed.  |
| `removed` | subtree-inclusive | Already flattened by adoption.                                                                                                                                                   |
| `updated` | per node          | An id is listed iff that node's own content changed. A mark whose _projection_ changed while its own fields did not stays out; a consumer needing the subtree re-reads the tree. |

### The divergence detector

A dev-only sweep, registered as a `changed` subscriber rather than called inline — because a caller that wraps the edit in `batch` defers the per-surface effects until that outer batch closes, well after `apply` returned. It walks the whole tree, not just the node a commit touched: an effect that was never armed never runs, so a check folded into the effect could not see its own failure.

It shipped _enabled_ to consumers until the session that produced this record — the guard was `import.meta.env?.DEV ?? true`, which fails open in any bundler without `import.meta.env`. Now `?? false`.

**DELETED 2026-08-19.** Once every commit began binding, `bindElements` re-armed every per-surface writer on every commit and the re-arm's first run healed the surface — inside `bind`, ahead of anything that could observe the divergence. The class this was written for became unreachable, so the check came out along with `VERIFY_DOM` and the whole-tree walk it cost per commit. What replaced it is the heal itself, pinned in `commitPipeline.spec.ts` and `TokenModel.spec.ts`. The paragraphs above describe the state before that.

_Source: dom/commit.ts — VERIFY_DOM, assertAligned (both removed)_

## Members

### Consumer reads

| member       | access | what it is for                                                                                                                                                |
| ------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `changed`    | public | Fires once per commit, after the DOM is consistent, carrying `{added, removed, updated}` ids. Applies folded into one pending pass announce one merged delta. |
| `handle(id)` | public | Id → live handle, or undefined. Fails closed while a structural apply awaits its bind. Carries no data — content and positions come from the node.            |
| `selection`  | public | The stored anchors and their derivations, DOM-free. Built from a bag of closures, which is the only reason it may be declared above `#tree`.                  |

### Adapter SPI

| member              | access | what it is for                                                                                                                      |
| ------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `renderEpoch`       | public | Bumped ⇔ the renderer must run. Not a data read: a counter, because roots stays reference-equal for in-slot and value-only changes. |
| `control()`         | public | Ref callback for a control element (overlay, drag handle). Element-only — nothing asks which token owns a control.                  |
| `children(ownerId)` | public | Ref callback for a token's child-sequence host. Keyed per registration; the owner rides in the value, named by stable id.           |

### Engine SPI

| member                            | access   | what it is for                                                                                                                          |
| --------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `value`                           | public   | THE value read. Controlled → props; uncontrolled → the last committed projection.                                                       |
| `nodes`                           | public   | THE render read — live root nodes. A `Computed` field so adapters can subscribe.                                                        |
| `replaceBetween(from,to,text)`    | internal | THE text write, anchor-addressed and normalized. Returns the caret anchor the edit's natural post-state wants, or undefined if refused. |
| `setValue(text)`                  | internal | Whole-value replacement over the document EDGES — not `{0, value().length}`, which the tree outruns mid-flight.                         |
| `applyText(node,range,text)`      | internal | Text replacement in a node's own coordinates. No spec gates its seed call.                                                              |
| `tx(fn)`                          | internal | Buffer several verbs, commit once, adopt once with the hull window. A refusal poisons the whole batch.                                  |
| `adjacentMark(anchor,dir)`        | public   | The mark whose end (−1) or start (+1) coincides with the anchor — the Backspace/Delete swallow test.                                    |
| `step(anchor,dir)`                | public   | One character back or forward.                                                                                                          |
| `valueBetween(from,to)`           | public   | The projection restricted to a window — the clipboard's markup serialization.                                                           |
| `find(id)`                        | public   | Stable id → live node.                                                                                                                  |
| `rootIndexOf(id)`                 | public   | Index of the root whose subtree contains the id — the block row index.                                                                  |
| `siblingOf(id,dir)`               | public   | Previous or next sibling within the node's own parent.                                                                                  |
| `anchorAt(offset)`                | public   | Global offset → node anchor, right affinity. Seeds, because an unmaterialized tree answers 'end' for every offset.                      |
| `handleAt(node)`                  | public   | DOM node → handle, 'control' if inside a control root, or undefined if outside the container.                                           |
| `anchorFor(node,offset,affinity)` | public   | DOM boundary → node anchor. The DOM→model direction of the selection sync.                                                              |
| `domSelection()`                  | public   | One snapshot of the live window selection.                                                                                              |
| `domAnchors()`                    | public   | DOM truth as anchors.                                                                                                                   |
| `focusFirst()`                    | public   | Move focus and the caret into the first root token. Reached from the public `api.focus()`.                                              |
| `placeAtHandle(handle,boundary)`  | public   | Place the caret at a bound handle's start or end.                                                                                       |
| `isUserSelecting`                 | public   | Mouse-sweep flag; the driver's editable policy reads it.                                                                                |
| `selectedContent()`               | public   | Current selection serialized for the clipboard.                                                                                         |
| `placeCaret(anchor)`              | public   | Collapsed caret at a node anchor.                                                                                                       |
| `selectRange(anchor,head)`        | public   | Select between two anchors, in either order.                                                                                            |
| `setEditable(options)`            | internal | Scoped editable-state application over every bound handle. `SelectionDriver` owns the policy.                                           |

### Internals

| member                                        | what it is for                                                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `#parser`                                     | Computed `Parser`, or undefined when no markup or no `Mark` component is configured.                                                          |
| `#tree`                                       | THE tree, and the only representation of the value.                                                                                           |
| `#applyStructural(target,text)`               | Whole-node replacement — the mark verbs' write path. Private since the session that produced this record.                                     |
| `#offsetOf(anchor)`                           | Anchor → absolute offset. The ONE place a coordinate is formed. Private since the session that produced this record.                          |
| `#markCommands`                               | `node.update(patch)` / `node.remove()`, lowered onto `#applyStructural`.                                                                      |
| `#boundary`                                   | Commit policy, arrival routing, and the `onResult` batch.                                                                                     |
| `#tx`                                         | The transaction layer, wired to the boundary's sink.                                                                                          |
| `#onExternalValue(value)`                     | One router for every external value: the props watch and `#ensureSeeded`.                                                                     |
| `#ensureSeeded()`                             | The tree's materialization point.                                                                                                             |
| `#nodes`                                      | `Map<id, TokenHandle>` — the live node layer, mutated only through the pipeline.                                                              |
| `#pipeline`                                   | The one commit pipeline.                                                                                                                      |
| `#dom`                                        | `DomModel` — all DOM reads and commands, delegated as one-liners.                                                                             |
| `#selectionDriver`                            | The selection's DOM half. Built in the constructor: a field initializer would read `this.host` (TS2729) and `#pipeline` (silently undefined). |
| `#pendingControls` / `#pendingChildSequences` | Ref registries keyed by a per-registration token, read by `bind`.                                                                             |
| `#editable` / `#editableState()`              | Last state written by `setEditable`; until then derived from props at bind time.                                                              |

## Cost centres

Two systems carried most of the remaining complexity at the time of writing. Neither was a bug; both were places where the design paid interest on every change.

### 1 · Block rows still live in the old address space

A row _is_ a top-level node — that is the whole model. But `features/block/operations.ts` computes on _string offsets_ against `tokens.value()`, which is props-first, so it can slice string A at positions taken from string B whenever a controlled parent runs ahead. Its caret derivation reads `previousRows.at(i).position` — an offset into the _pre_-edit string — applies it to the _post_-edit string and hides the error with `Math.min`.

Two owners with different rules: `BlockController` gates on `isBlock() && draggable()`, `keyboard/blockEdit.ts` on `isBlock()` alone — so with `draggable` falsy the grip renders, the menu opens, and every action is swallowed. Seven independent derivations of "which row is this".

_Source: features/block/operations.ts · keyboard/blockEdit.ts_

### 2 · Every text token is its own contenteditable host

One line does it — `dom/editableState.ts` sets `contentEditable` on each bound text surface. The container carries no `contenteditable` attribute at all, so mark atomicity is a _side effect_ of "my parent is not an editing host", never an explicit contract.

Downstream: `blockEdit` keys five call sites off `document.activeElement`; `DomModel.selectRange` refuses any Range endpoint that is not a text surface, so `{before: mark}` selections are silently never drawn while `TokenHandle.placeCaret` can place a caret there. Collapsing to one host is a −185/+90..170 trade with three unprobed browser unknowns — worth measuring, not worth assuming.

_Source: dom/editableState.ts · dom/DomModel.ts · keyboard/blockEdit.ts_

This one was taken: see `one-host-migration.md` and `docs/adr/0002-one-contenteditable-host.md`.

### 3 · The published bundle is not the built bundle

`pnpm run build` runs `vite build && node prepack.js`, and prepack re-bundles through rolldown — overwriting Vite's minified, env-substituted output. The shipped `dist/index.js` is 211 kB unminified with `import.meta.env` intact, versus 97 kB from Vite alone. That is why the detector's guard had to be correct _unsubstituted_.

_Source: packages/react/markput/prepack.js — not fixed, worth its own issue_
