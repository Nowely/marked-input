# Remove enable/disable from Feature interface

## Motivation

All 11 features currently implement `enable()`/`disable()` and are called in batch
on mount/unmount. Three features have empty implementations that exist only to
satisfy the interface. No feature is ever selectively toggled at runtime — even
conditionally useful ones (drag, overlay, parsing) use internal gating instead of
skipping enable/disable.

## Design

### 1. Feature interface

Drop `enable()` and `disable()` from `Feature`. No feature is required to
implement lifecycle methods.

`Store.ts` drops the `features[]` array and the batch calls:

```ts
// REMOVED:
const features: Feature[] = [...]
watch(this.lifecycle.mounted, () => features.forEach(f => f.enable()))
watch(this.lifecycle.unmounted, () => features.forEach(f => f.disable()))
```

### 2. Always-on features

caret, keyboard, clipboard, value, dom, slots — each subscribes to lifecycle
events in its constructor. No `enable()`/`disable()` methods.

LifecycleFeature drops its empty stubs; continues emitting mounted/unmounted/rendered events.
SlotsFeature drops its empty stubs; already fully reactive via computed signals.

### 3. Conditional features

Each watches gating props in its constructor and calls enable/disable reactively.
When disabled, the feature cleans up its scope. When enabled, it sets it back up.

**DragFeature** — watches `layout` and `draggable` props.
  - `enable()`: subscribes to `store.drag.action` event via an effect scope.
  - `disable()`: tears down the scope.

**OverlayFeature** — watches `showOverlayOn` and whether any option has `overlay.trigger`.
  - `enable()`: sets up effect scope with value change, selection change, ESC key,
    outside click, and overlay selection watchers.
  - `disable()`: tears down the scope, closing any open overlay.

**ParsingFeature** — watches `store.mark.enabled` computed signal.
  - `enable()`: calls `sync()`, subscribes to `reparse` event and watches `parser` computed.
  - `disable()`: tears down the scope, clearing token index.

**MarkFeature** — drops empty stubs. Keeps `enabled` computed signal (driven by
`props.Mark` and per-option `Mark`). No enable/disable methods needed since it has
no subscriptions.

### 4. Cleanup

No manual unmount lifecycle wiring. If the Store and its features become unreachable,
unused effect scopes are GC'd. `disable()` already has a guard
(`if (this.#scope) { ... }`) making it safe to call when already disabled.
