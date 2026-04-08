# Remove `defineEvents` — Replace with Direct Event Declarations

**Goal:** Remove `defineEvents` usage from `Store` and delete the utility entirely. Replace with a plain object literal — types are inferred from `voidEvent()` and `payloadEvent<T>()` return values.

**Architecture:** `defineEvents` is a pure identity function that only provides type inference. Since TypeScript infers `VoidEvent` / `PayloadEvent<T>` from the factory functions, the wrapper adds no runtime or compile-time value. Removing it simplifies the signals API surface and reduces indirection.

---

## Current State

`defineEvents` is used in 1 production site:

1. **`Store.ts`** — wraps 6 event declarations (`change`, `parse`, `delete`, `select`, `clearOverlay`, `checkOverlay`)

It has:

- Dedicated tests: `defineEvents.spec.ts` (185 lines)
- Integration tests in `signals.spec.ts` (lines 501-546)
- Public API export from `core/index.ts`
- Architecture docs reference in `website/`

No external consumers exist — this is an internal utility.

## Change

```typescript
// FROM:
readonly events = defineEvents<{
    change: void
    parse: void
    delete: {token: Token}
    select: {mark: Token; match: OverlayMatch}
    clearOverlay: void
    checkOverlay: void
}>({
    change: voidEvent(),
    parse: voidEvent(),
    delete: payloadEvent<{token: Token}>(),
    select: payloadEvent<{mark: Token; match: OverlayMatch}>(),
    clearOverlay: voidEvent(),
    checkOverlay: voidEvent(),
})

// TO:
readonly events = {
    change: voidEvent(),
    parse: voidEvent(),
    delete: payloadEvent<{token: Token}>(),
    select: payloadEvent<{mark: Token; match: OverlayMatch}>(),
    clearOverlay: voidEvent(),
    checkOverlay: voidEvent(),
}
```

No consumer changes — all `store.events.X()` calls remain identical.

## File Structure

| Action | File                                                            | Purpose                                  |
| ------ | --------------------------------------------------------------- | ---------------------------------------- |
| Modify | `packages/core/src/features/store/Store.ts`                     | Replace `defineEvents` with plain object |
| Modify | `packages/core/src/shared/signals/index.ts`                     | Remove `defineEvents` export             |
| Modify | `packages/core/src/shared/classes/index.ts`                     | Remove `defineEvents` re-export          |
| Modify | `packages/core/index.ts`                                        | Remove `defineEvents` from public API    |
| Delete | `packages/core/src/shared/signals/defineEvents.ts`              | Remove the utility                       |
| Delete | `packages/core/src/shared/signals/defineEvents.spec.ts`         | Remove its tests                         |
| Modify | `packages/core/src/shared/signals/signals.spec.ts`              | Remove `defineEvents()` block and import |
| Modify | `packages/website/src/content/docs/development/architecture.md` | Update event system docs                 |

## Self-Review

- **No placeholders** — all changes are concrete
- **No consumer breakage** — `store.events.X()` API is unchanged
- **Type inference works** — `voidEvent()` returns `VoidEvent`, `payloadEvent<T>()` returns `PayloadEvent<T>`, TypeScript infers the object type
- **Consistent with defineState removal** — same pattern, same approach
