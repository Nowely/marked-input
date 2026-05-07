# Lifecycle Feature

Owns the three framework→core lifecycle events:

| Event       | Fired by                                            | Listened by                                               |
| ----------- | --------------------------------------------------- | --------------------------------------------------------- |
| `mounted`   | Framework adapter on initial mount                  | `Store` constructor (calls `enable()` on every feature)   |
| `unmounted` | Framework adapter on unmount                        | `Store` constructor (calls `disable()` on every feature)  |
| `rendered`  | Framework `Container` component after render commit | `DomController` (DOM indexing and pending caret recovery) |

Access: `store.lifecycle.{mounted,unmounted,rendered}`.

The feature is an event carrier for framework→core lifecycle events.
`onMounted(setup)` registers a reactive subscription using `watch()`
that runs `setup` in an `effectScope` when the editor is mounted.
Inner watchers are automatically disposed on unmount and re-created
on remount.
