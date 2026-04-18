# Feature-Owned Events

## Summary

Move single-producer events from the flat `store.event` bus to the features that semantically own them. Each feature declares a `readonly event` namespace object. Multi-producer and lifecycle events remain on `store.event`.

## Motivation

1. **Discoverability** — see which feature owns which events by looking at the feature class
2. **Encapsulation** — features expose only their own events, not the full flat bus
3. **Type safety** — cannot accidentally emit events from unrelated features

## Event Mapping

### Feature-owned events (5 events, 4 features)

| Event | Old location | New location | Feature |
|---|---|---|---|
| overlayClose | `store.event.overlayClose` | `store.feature.overlay.event.close` | OverlayFeature |
| overlaySelect | `store.event.overlaySelect` | `store.feature.overlay.event.select` | OverlayFeature |
| sync | `store.event.sync` | `store.feature.contentEditable.event.sync` | ContentEditableFeature |
| drag | `store.event.drag` | `store.feature.drag.event.action` | DragFeature | Renamed to avoid `drag.drag` redundancy
| reparse | `store.event.reparse` | `store.feature.parse.event.reparse` | ParseFeature |

**Note on naming convention**: the feature name prefix is dropped from event names (e.g. `overlayClose` → `close`, `overlaySelect` → `select`) to avoid redundancy since the feature namespace already identifies the owner.

### Store-level events (5 events, unchanged)

| Event | Reason it stays on store.event |
|---|---|
| `mounted` | Lifecycle — framework adapter emits, Store consumes |
| `unmounted` | Lifecycle — framework adapter emits, Store consumes |
| `change` | Multi-producer — InputFeature, MarkHandler, deleteMark |
| `markRemove` | Single producer (MarkHandler) but no MarkFeature exists |
| `rendered` | Framework lifecycle — Container emits after DOM commit |

## API

### Feature declaration

```typescript
class OverlayFeature {
    readonly event = {
        close: event(),
        select: event<{mark: Token; match: OverlayMatch}>(),
    }
}

class ContentEditableFeature {
    readonly event = {
        sync: event(),
    }
}

class DragFeature {
    readonly event = {
        action: event<DragAction>(),
    }
}

class ParseFeature {
    readonly event = {
        reparse: event(),
    }
}
```

Features without semantically-owned events (InputFeature, ArrowNavFeature, CopyFeature, TextSelectionFeature, BlockEditFeature, FocusFeature, SystemListenerFeature) have no `event` property.

### Cross-feature subscription

```typescript
// Before:
watch(this.store.event.sync, () => { ... })

// After:
watch(this.store.feature.contentEditable.event.sync, () => { ... })
```

### Framework adapter usage

```typescript
// Before:
store.event.overlaySelect({mark, match})

// After:
store.feature.overlay.event.select({mark, match})
```

### Self-subscribing features

ParseFeature both emits and subscribes to `this.event.reparse`. This is intentional — external triggers (SystemListenerFeature emits `store.feature.parse.event.reparse()`) and internal triggers (reactive deps) go through the same path.

## Store.event after refactor

```typescript
readonly event = {
    mounted: event(),
    unmounted: event(),
    change: event(),
    markRemove: event<{token: Token}>(),
    rendered: event(),
}
```

## Affected consumers

### Core features

| Feature | Changes |
|---|---|
| OverlayFeature | Remove `overlayClose` from store.event, declare `event.close`, subscribe to own event |
| ContentEditableFeature | Declare `event.sync`, subscribe to own event |
| DragFeature | Remove `drag` from store.event, declare `event.action`, subscribe to own event |
| ParseFeature | Remove `reparse` from store.event, declare `event.reparse`, subscribe to own event |
| FocusFeature | Change `store.event.sync()` emit to `store.feature.contentEditable.event.sync()` |
| SystemListenerFeature | Change `store.event.reparse()` emit to `store.feature.parse.event.reparse()` |

### Framework adapters (React)

| File | Change |
|---|---|
| `useOverlay.tsx` | `store.event.overlayClose()` → `store.feature.overlay.event.close()`; `store.event.overlaySelect(...)` → `store.feature.overlay.event.select(...)` |

### Framework adapters (Vue)

| File | Change |
|---|---|
| `useOverlay.ts` | `store.event.overlayClose()` → `store.feature.overlay.event.close()`; `store.event.overlaySelect(...)` → `store.feature.overlay.event.select(...)` |

### Drag wiring

| File | Change |
|---|---|
| `BlockStore.ts` | Receives `DragActions['drag']` callback — caller must wire it to `store.feature.drag.event.action` |
| React `Block.tsx` / Vue `Block.vue` | Update `actions.drag` to reference `store.feature.drag.event.action` |

### Non-feature emitters

| Module | Change |
|---|---|
| `MarkHandler` | No change (emits `store.event.change` and `store.event.markRemove`) |
| `deleteMark()` | No change (emits `store.event.change`) |

## Known considerations

1. **FocusFeature → ContentEditableFeature dependency**: FocusFeature emits `store.feature.contentEditable.event.sync()`. This creates a runtime dependency on ContentEditableFeature existing. Both features are always present, so this is acceptable.

2. **Disabled feature events**: Events are created as class field initializers (in the feature constructor, executed when Store instantiates the feature at `new Feature(this)`), not in `enable()`. Emitting an event on a disabled feature still propagates through the reactive graph. Safe because subscribers inside `effectScope()` are cleaned up on `disable()`.

3. **Framework adapter coupling**: Framework code now accesses `store.feature.overlay.event.select` instead of `store.event.overlaySelect`. Tighter coupling but more discoverable.

4. **overlayClose is multi-source**: OverlayFeature emits `overlayClose` internally (ESC key, outside click), but `useOverlay` hooks also emit it after selection. Both paths converge on `store.feature.overlay.event.close()`, which is acceptable since all callers are semantically closing the overlay.

## Files to modify

- `packages/core/src/store/Store.ts` — remove 5 events from `store.event`
- `packages/core/src/features/overlay/OverlayFeature.ts` — add `event` property
- `packages/core/src/features/editable/ContentEditableFeature.ts` — add `event` property
- `packages/core/src/features/drag/DragFeature.ts` — add `event` property
- `packages/core/src/features/parsing/ParseFeature.ts` — add `event` property
- `packages/core/src/features/focus/FocusFeature.ts` — update sync emit path
- `packages/core/src/features/events/SystemListenerFeature.ts` — update reparse emit path
- `packages/core/src/store/BlockStore.ts` — update `DragActions['drag']` wiring
- `packages/react/markput/src/lib/hooks/useOverlay.tsx` — update overlayClose and overlaySelect paths
- `packages/vue/markput/src/lib/hooks/useOverlay.ts` — update overlayClose and overlaySelect paths
- `packages/react/markput/src/components/Block.tsx` — update drag action wiring
- `packages/vue/markput/src/components/Block.vue` — update drag action wiring
- `packages/core/src/store/Store.spec.ts` — remove assertions for moved events
- `packages/website/src/content/docs/development/architecture.md` — update event path references in flow diagrams
- `packages/core/src/features/drag/README.md` — update `store.event.drag` references
- Related test/spec files for all above
