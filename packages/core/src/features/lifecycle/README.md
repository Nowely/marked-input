# Lifecycle Feature

Owns the three framework→core lifecycle events:

| Event       | Fired by                                            | Listened by                                              |
| ----------- | --------------------------------------------------- | -------------------------------------------------------- |
| `mounted`   | Framework adapter on initial mount                  | `Store` constructor (calls `enable()` on every feature)  |
| `unmounted` | Framework adapter on unmount                        | `Store` constructor (calls `disable()` on every feature) |
| `rendered`  | Framework `Container` component after render commit | `DomFeature` (DOM indexing and pending caret recovery)   |

Access: `store.lifecycle.{mounted,unmounted,rendered}`.

The feature has no reactive state or computed values — it is a pure event carrier.
