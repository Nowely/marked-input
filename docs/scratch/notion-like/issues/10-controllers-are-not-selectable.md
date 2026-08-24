# Reaching a controller through `useMarkput` needs an object literal

Type: task
Status: needs-triage
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
