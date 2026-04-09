# Event-Driven Features Architecture

## Status: Approved

## Problem

The current controller/feature/lifecycle architecture has compounding issues:

1. **KeyDownController is a 929-line God Controller** (56% of all controller code) handling 8+ responsibilities
2. **Lifecycle bypasses FeatureManager** — directly calls `overlay`, `contentEditable`, and `focus` controllers
3. **OverlayController and DragController are not in coreFeatures** — incomplete lifecycle management
4. **Framework layers directly access `store.controllers`** — leaky abstraction
5. **Vue calls `sync()` twice per token change**, React once — behavioral inconsistency
6. **BlockStore (shared layer) imports DragController (features layer)** — inverted dependency
7. **KeyDownController imports from 5 other feature directories** — hidden coupling
8. **DragController is a service masquerading as a controller** — empty enable/disable, imperative API
9. **Duplicated code** — `#createRowContent()` and `isTextTokenSpan()` in two places each
10. **No consistent controller public interface** — each exposes different methods beyond enable/disable

### Root cause

"Controller" means too many things: lifecycle-managed features, externally-orchestrated features, service objects, event bus subscribers, and DOM managers. The `Feature` interface (`enable()`/`disable()`) is too narrow, so Lifecycle does real orchestration by reaching directly into controllers.

---

## Design: Event-Driven Features

### Core principle

Every feature implements exactly one interface:

```ts
interface Feature {
  enable(): void
  disable(): void
}
```

All cross-feature communication goes through `store.events` or `store.state`. No feature references another feature. No lifecycle hooks. No imperative cross-calls.

### Why events, not hooks

- **Maximum decoupling** — features never reference each other; impossible to create hidden coupling
- **Simplest feature contract** — `enable()`/`disable()` is the only requirement
- **Consistent with existing patterns** — the codebase already uses `store.events` for controller communication
- **Ordering is natural** — JS events are synchronous, so `emit('sync')` then `emit('recoverFocus')` guarantees order
- **Easy to extend** — new features subscribe to existing events without modifying any other code

### Ordering guarantee

Event emission in JS is synchronous. When Lifecycle emits events sequentially:

```ts
store.events.sync.emit()
store.events.recoverFocus.emit()
```

All `sync` subscribers complete before `recoverFocus` subscribers begin. No race conditions, no coordination needed.

---

## Feature Decomposition

### KeyDownController → 3 features

| New Feature | Directory | Responsibility | ~Lines |
|---|---|---|---|
| **InputFeature** | `features/input/` | Non-drag span editing: beforeInput, paste, mark deletion, applySpanInput, replaceAllContentWith, handleMarkputSpanPaste | ~350 |
| **BlockEditFeature** | `features/block-editing/` | Drag-mode keyboard ops: enter, delete, arrow keys + raw DOM<->value position mapping (getCaretRawPosInBlock, getDomRawPos, setCaretAtRawPos, etc.) | ~350 |
| **KeyNavFeature** | `features/keynav/` | Thin arrow dispatch: shiftFocusPrev/Next, selectAllText | ~50 |

### Existing controllers → features (renamed)

| Old Name | New Name | Directory | Changes |
|---|---|---|---|
| `OverlayController` | `OverlayFeature` | `features/overlay/` | Standard enable/disable. Self-manages trigger detection + close behavior via reactive subscriptions. No more 4-method API. |
| `FocusController` | `FocusFeature` | `features/focus/` | Subscribes to `recoverFocus` event instead of being called directly. |
| `ContentEditableController` | `ContentEditableFeature` | `features/editable/` | Subscribes to `sync` event instead of being called directly. |
| `SystemListenerController` | `SystemListenerFeature` | `features/events/` | No structural changes. Already event-driven. |
| `TextSelectionController` | `TextSelectionFeature` | `features/selection/` | No structural changes. |
| `CopyController` | `CopyFeature` | `features/clipboard/` | No structural changes. |
| `DragController` | `DragFeature` | `features/drag/` | Subscribes to `dragAction` event. No more imperative methods. BlockStore emits events instead of calling methods. |

### Total: 10 features (up from 8 controllers)

---

## New Events

```ts
readonly events = {
  // Existing (unchanged):
  change: event(),
  parse: event(),
  delete: event<{token: Token}>(),
  select: event<{mark: Token; match: OverlayMatch}>(),
  clearOverlay: event(),
  checkOverlay: event(),

  // New lifecycle events:
  sync: event(),                                          // "DOM attributes need syncing"
  recoverFocus: event(),                                  // "focus needs recovery"

  // New drag events:
  dragAction: event<DragAction>(),                        // "drag operation requested"
}
```

### DragAction type

```ts
type DragAction =
  | {type: 'reorder'; source: number; target: number}
  | {type: 'add'; afterIndex: number}
  | {type: 'delete'; index: number}
  | {type: 'duplicate'; index: number}
```

---

## Detailed Feature Changes

### OverlayFeature

**Before**: 4 methods (`enableTrigger`, `disable`, `enableClose`, `disableClose`) called by Lifecycle.

**After**: Standard enable/disable.
- `enable()`: subscribes to `change` + `checkOverlay` events for trigger detection; watches `overlayMatch` signal to auto-register close handlers when overlay appears; subscribes to `clearOverlay` to dismiss
- `disable()`: unsubscribes everything

Lifecycle no longer touches overlay. The feature self-manages via reactive subscriptions and events.

### FocusFeature

**Before**: `recover()` called directly by Lifecycle.

**After**: Subscribes to `recoverFocus` event.
- `enable()`: subscribes to `store.events.recoverFocus`
- Handler: same logic as current `recover()` — reads `store.state.recovery`, resolves target, focuses, clears recovery

### ContentEditableFeature

**Before**: `sync()` called directly by Lifecycle and Vue useCoreFeatures.

**After**: Subscribes to `sync` event.
- `enable()`: subscribes to `store.events.sync`; also watches `readOnly` and `selecting` reactively (same as current)
- Handler: same `sync()` logic — walks container children, syncs contentEditable attributes and textContent

### DragFeature

**Before**: Imperative methods (`reorder`, `add`, `delete`, `duplicate`) called directly by BlockStore. Empty `enable()`/`disable()`.

**After**: Subscribes to `dragAction` event.
- `enable()`: subscribes to `store.events.dragAction`
- Handler: switches on `action.type` — same logic as current methods
- `disable()`: unsubscribes

### InputFeature (from KeyDownController)

Owns all non-drag keyboard input:
- `beforeinput` event handler (non-drag branch)
- `paste` event handler (non-drag branch)
- `handleMarkputSpanPaste`
- `applySpanInput`
- `replaceAllContentWith`
- Mark deletion (non-drag branch of `handleDelete`)
- Subscribes to `change` event? No — emits `store.events.change` after mutations, same as current

Moves duplicated code into shared location:
- `#createRowContent()` → shared utility in `features/editing/` or `features/drag/`
- `isTextTokenSpan()` → shared utility in `features/editable/` or `shared/`

### BlockEditFeature (from KeyDownController)

Owns all drag-mode keyboard operations:
- Drag-mode delete/merge (from `handleDelete` drag branch)
- Drag-mode enter (from `handleEnter`)
- Drag-mode arrow keys (`handleArrowUpDown`, `handleBlockArrowLeftRight`)
- Raw position mapping functions (`getCaretRawPosInBlock`, `getDomRawPos`, `getDomRawPosInMark`, `setCaretAtRawPos`, `setCaretInMarkAtRawPos`)

These form a self-contained subsystem — all position mapping functions are only consumed by `handleBlockBeforeInput`.

### KeyNavFeature (from KeyDownController)

Thin dispatch feature:
- Arrow key event listener
- Dispatches to `shiftFocusPrev`/`shiftFocusNext` (from `features/navigation/`)
- `selectAllText` (from `features/selection/`)
- ~50 lines, mostly wiring

---

## Store Shape Change

```ts
// Before:
readonly controllers = {
  overlay: new OverlayController(this),
  focus: new FocusController(this),
  keydown: new KeyDownController(this),
  system: new SystemListenerController(this),
  textSelection: new TextSelectionController(this),
  contentEditable: new ContentEditableController(this),
  drag: new DragController(this),
  copy: new CopyController(this),
}

// After:
readonly features = {
  input: new InputFeature(this),
  blockEditing: new BlockEditFeature(this),
  keynav: new KeyNavFeature(this),
  overlay: new OverlayFeature(this),
  focus: new FocusFeature(this),
  system: new SystemListenerFeature(this),
  textSelection: new TextSelectionFeature(this),
  contentEditable: new ContentEditableFeature(this),
  drag: new DragFeature(this),
  copy: new CopyFeature(this),
}
```

---

## Lifecycle Changes

### Before

```ts
class Lifecycle {
  enable() {
    const features = createCoreFeatures(store)
    features.enableAll()
    this.#scope = effectScope(() => {
      this.#subscribeParse()
      if (options?.getTrigger) this.#subscribeOverlay(options.getTrigger)
    })
  }

  recoverFocus() {
    store.controllers.contentEditable.sync()   // direct call
    if (!store.state.Mark.get()) return
    store.controllers.focus.recover()           // direct call
  }

  #subscribeOverlay() {
    store.controllers.overlay.enableTrigger(...)  // direct call
    watch(overlayMatch, match => {
      if (match) store.controllers.overlay.enableClose()   // direct call
      else store.controllers.overlay.disableClose()         // direct call
    })
  }
}
```

### After

```ts
class Lifecycle {
  enable() {
    const features = createCoreFeatures(store)
    features.enableAll()
    this.#scope = effectScope(() => {
      this.#subscribeParse()
    })
  }

  recoverFocus() {
    store.events.sync.emit()
    if (!store.state.Mark.get()) return
    store.events.recoverFocus.emit()
  }

  // #subscribeOverlay() is removed entirely — OverlayFeature handles it
}
```

Overlay trigger configuration (`getTrigger`) moves to store state (a new signal) so OverlayFeature can read it reactively instead of receiving it via Lifecycle method call.

---

## BlockStore Changes

### Before

```ts
// BlockStore receives DragController directly
attachContainer(el, blockIndex, dragCtrl) {
  this.#dragCtrl = dragCtrl
  // ...
  onDrop: dragCtrl.reorder(sourceIndex, targetIndex)
}

addBlock() { this.#dragCtrl.add(this.#blockIndex) }
deleteBlock() { this.#dragCtrl.delete(this.#blockIndex) }
```

### After

```ts
// BlockStore receives store.events
attachContainer(el, blockIndex, events) {
  this.#events = events
  // ...
  onDrop: events.dragAction.emit({type: 'reorder', source: sourceIndex, target: targetIndex})
}

addBlock() { this.#events.dragAction.emit({type: 'add', afterIndex: this.#blockIndex}) }
deleteBlock() { this.#events.dragAction.emit({type: 'delete', index: this.#blockIndex}) }
```

BlockStore no longer imports from the features layer — dependency inversion is fixed.

---

## Framework Layer Changes

### React

- `Block.tsx`: pass `store.events` to `blockStore.attachContainer(el, blockIndex, store.events)` instead of `store.controllers.drag`
- `DragHandle.tsx`: pass `store.events` to `blockStore.attachGrip(el, blockIndex, store.events)` instead of `store.controllers.drag`
- `useCoreFeatures`: no direct controller/feature calls — `sync` event handles it; just call `store.lifecycle.recoverFocus()` in useLayoutEffect

### Vue

- `Block.vue`: same change as React Block.tsx
- `DragHandle.vue`: same change as React DragHandle.tsx
- `useCoreFeatures`: remove the direct `store.controllers.contentEditable.sync()` watcher — `sync` event handles it via `lifecycle.recoverFocus()`

### Result

Both frameworks have **zero direct feature access**. All communication goes through `store.events`, `store.state`, and `store.lifecycle`.

---

## Deduplicated Code

| Duplicated Code | New Location |
|---|---|
| `#createRowContent()` (in KeyDownController + DragController) | `features/drag/utils.ts` or `features/editing/createRowContent.ts` |
| `isTextTokenSpan()` (in ContentEditableController + KeyDownController) | `features/editable/isTextTokenSpan.ts` or `shared/utils/` |

---

## Migration Path

1. Rename `store.controllers` → `store.features`, rename all `*Controller` → `*Feature`
2. Add new events (`sync`, `recoverFocus`, `dragAction`)
3. Convert OverlayFeature to standard enable/disable with self-managed subscriptions
4. Convert FocusFeature to subscribe to `recoverFocus` event
5. Convert ContentEditableFeature to subscribe to `sync` event
6. Convert DragFeature to subscribe to `dragAction` event
7. Update BlockStore to accept `store.events` instead of DragController
8. Update Lifecycle to emit events instead of calling features directly
9. Decompose KeyDownController into InputFeature + BlockEditFeature + KeyNavFeature
10. Deduplicate shared code
11. Update framework layers (React/Vue) to use `store.events` instead of `store.features.drag`
12. Remove `store.controllers` and all `*Controller` names

Steps 1-8 are mechanical renames + wiring changes. Step 9 is the substantive decomposition. Steps 10-12 are cleanup.

---

## Problems Solved

| # | Problem | How Solved |
|---|---|---|
| 1 | God Controller (929 lines) | Decomposed into 3 features (~350 + ~350 + ~50) |
| 2 | Lifecycle bypasses FeatureManager | Lifecycle only emits events, never calls features directly |
| 3 | Overlay/Drag not in coreFeatures | All 10 features registered in FeatureManager |
| 4 | Framework accesses store.controllers | Framework only accesses store.events + store.lifecycle |
| 5 | Vue calls sync() twice | Both frameworks use same event-driven path through recoverFocus() |
| 6 | BlockStore inverted dependency | BlockStore depends on store.events (shared layer), not features |
| 7 | KeyDownController imports from 5 directories | Each new feature imports from relevant subset; InputFeature doesn't import drag ops |
| 8 | DragController is a service | DragFeature is a real feature with enable/disable that subscribes to events |
| 9 | Duplicated code | Extracted to shared utilities |
| 10 | Inconsistent controller interfaces | All features implement identical Feature interface |

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Event chains harder to debug than direct calls | Events are synchronous and named descriptively. Call stack still shows full chain. IDE "find usages" works on events. |
| Adding many new events increases store.events surface | Only 3 new events. Each has a clear purpose and single emitter. |
| Performance of event dispatch vs direct call | Negligible — synchronous event dispatch is functionally identical to a method call (just iterating a subscriber array). |
| OverlayFeature needs trigger config that was passed via Lifecycle method | Add `getTrigger` to store state as a signal. OverlayFeature reads it reactively. |
| Decomposing KeyDownController might miss edge cases | Comprehensive test coverage exists. Tests migrate with the code. |
