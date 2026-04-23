# Lifecycle Feature

Owns the three framework→core lifecycle events:

| Event       | Fired by                                              | Listened by                                                             |
| ----------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `mounted`   | Framework adapter on initial mount                    | `Store` constructor (calls `enable()` on every feature)                 |
| `unmounted` | Framework adapter on unmount                          | `Store` constructor (calls `disable()` on every feature)                |
| `rendered`  | Framework `Container` component via `useLayoutEffect` | `FocusFeature` (post-render caret work), `DomFeature` (via `reconcile`) |

Access: `store.feature.lifecycle.emit.{mounted,unmounted,rendered}`.

The feature has no reactive state or computed values — it is a pure event carrier.
