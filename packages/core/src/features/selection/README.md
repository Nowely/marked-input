# Selection Feature

`store.selection`, and nothing more. Since the S2.2 split this directory holds
no state, no listener and no policy — the substance lives in the token layer,
in two modules that are documented there
(`packages/core/src/features/tokens/README.md`):

| what                                                                        | where                           |
| --------------------------------------------------------------------------- | ------------------------------- |
| stored anchors, derived `isAllSelected`, `repair`                           | `tokens/tree/selection.ts`      |
| DOM listeners, caret application, the mouse-sweep flag, the editable policy | `tokens/dom/SelectionDriver.ts` |

`SelectionController` composes the pair because `Store` constructs the selection
while `TokenModel` keeps its tree private: the state module takes its three tree
reads as closures over `TokenModel`'s public surface, and the driver takes the
state module plus the model's DOM verbs. When `TokenModel` takes ownership
(S2.9) this shell, its barrel and this file go.

## Delegation table

| member                                      | forwards to                                         |
| ------------------------------------------- | --------------------------------------------------- |
| `isAllSelected`                             | `Selection`'s computed, assigned in the constructor |
| `isUserSelecting`                           | `SelectionDriver.isUserSelecting`                   |
| `select`, `selectAll`, `anchors`, `repair`  | `Selection`                                         |
| `focusFirst`, `domAnchors`, `placeAtHandle` | `SelectionDriver`                                   |

`anchors()` + `repair()` are the `SelectionPort` `TokenModel` is constructed
with: the pre-adoption capture and the post-adoption application. The capture is
anchors, not offsets, so the coordinate reading happens inside `adopt` — see
`TransactionResult.selectionAfter`.

## Spec

Split: S2 D10. Anchors-not-offsets and the capture-before-adoption rule: S1 D7.
