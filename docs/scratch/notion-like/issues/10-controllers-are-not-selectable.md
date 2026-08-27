# Reaching a controller through `useMarkput` needs an object literal

Type: task
Status: resolved — a third overload, and `readSelected` answers a non-plain object as itself (2026-08-27)
Blocked by: —

## Problem

The obvious spelling does not compile:

    const edit = useMarkput(s => s.edit)
    // TS2769: Type 'EditController' is not assignable to type 'Selectable<unknown>'
    //         … Index signature for type 'string' is missing in type 'EditController'

A selector must answer either a signal or a `Record<string, …>`
(`packages/core/src/shared/readSelected.ts:5-8`), and a class instance is
neither. The working spelling wraps it:

    const {edit} = useMarkput(s => ({edit: s.edit}))

which is what the adapter's own `useOverlay` does
(`packages/react/markput/src/lib/hooks/useOverlay.tsx:19`).

## Why it matters here

`store.edit`, `store.block` and `store.tokens` are the whole imperative surface
a document UI writes against — a slash menu, a block menu, a drag affordance.
Every one of them meets this on the first line, and the error message names
index signatures rather than the actual rule.

## Sketch, not a decision

Either `ObjectSelector` admits an arbitrary object, or the selector overload
admits a non-reactive value and returns it as-is, or the docs show the wrapped
form as THE form. Cheapest honest fix is the third, but the first two remove the
puzzle instead of explaining it.

## Answer (2026-08-27)

**The overload, and the runtime with it.** `useMarkput` gains a third call signature —
`<T extends object>(selector: (store: Store) => T): T` — ordered last, so an object literal of
signals still takes the unwrapping overload above it. `readSelected` grows the matching arm: a
target that is not a PLAIN object (prototype `Object.prototype` or `null`) is answered as it is.

The type half alone would have been a trap. `for…in` skips a prototype's methods, so the key-by-key
copy of a controller arrives with every verb missing and its one signal frozen at a single reading
— a value that type-checks at the call site and throws on the first `moveTo`. Answering the
instance is not the lenient reading, it is the correct one, and an unchanging identity is exactly
what `useSyncExternalStore` compares two snapshots by.

**Why not `ObjectSelector` widening.** Measured, not argued: `RowController.selected` is a
`Computed<readonly number[]>`, so `SignalValues<RowController>` types it as `readonly number[]`
while the runtime hands back the raw computed. The widening makes the hook's return type LIE about
its own value.

**Why not docs alone.** It teaches the puzzle rather than removing it, and the error a consumer
meets first — "Index signature for type 'string' is missing in type 'RowController'" — names a
mechanism rather than the rule.

**Pins.** `packages/core/src/shared/readSelected.spec.ts` for the runtime; deleting the arm reddens
three of four, with `RowsLike {selected: [Function bound computedOper]}` becoming
`{selected: ["row-1"]}` in the diff. The TYPE half is pinned by a sample in
`guides/rows.md`, which the `docs` vitest project compiles against the adapter source: removing the
overload reddens it with the ticket's own TS2769.

**Behaviour changes**, both previously unreachable through the published types: a class instance is
answered rather than copied, and `null` answers `null` rather than the `{}` that `for…in` over it
silently produced. `readSelected`'s published parameter widens from `Selectable | ObjectSelector`
to `object`.
