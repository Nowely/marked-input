# Remove `replaceAll` from ValueFeature

**Date:** 2026-05-07
**Status:** approved

## Motivation

`ValueFeature.replaceAll(next)` is thin sugar over `this.current(next)` — it
delegates to `replaceRange({start: 0, end: cur.length}, next)`, whose bounds
checks are always trivially satisfied. The only behaviors `replaceAll` adds
over calling `current` directly are:

1. `readOnly` guard — rejects mutations when readonly
2. No-op check — skips if `next === current`

Both can live in `current`'s setter, making `replaceAll` unnecessary.

## Design

### ValueFeature.ts

Move the `readOnly` guard from `replaceRange` into `current`'s setter:

```ts
set: (next, field) => {
    if (next === undefined) return
    if (this.props.readOnly()) return    // moved here from replaceRange
    if (!this.isControlledMode()) field(next)
    this.props.onChange()?.(next)
},
```

Remove the `readOnly` guard from `replaceRange` (now enforced by the
`this.current(next)` call at the end). Bounds validation and no-op check
stay.

Delete `replaceAll` method.

### Call sites (mechanical)

`this.value.replaceAll(x)` → `this.value.current(x)`:
- `DragFeature.ts` (4 sites)
- `keyboard/blockEdit.ts` (5 sites)

`replaceAllContentWith` helper (`keyboard/input.ts`): update body from
`store.value.replaceAll(newContent)` → `store.value.current(newContent)`.
Function name and export stay.

### Tests

- Mechanical: `store.value.replaceAll(x)` → `store.value.current(x)`
- `ValueFeature.spec.ts` readOnly test: assertions stay, guard just moved
- `DragFeature.spec.ts` spy: `vi.spyOn(store.value, 'replaceAll')` →
  `vi.spyOn(store.value, 'current')`, update assertion

### Documentation

Remove `replaceAll` mentions, replace with `current()` or `replaceRange()`,
in:
- `AGENTS.md`
- `packages/core/src/store/README.md`
- `packages/core/src/features/value/README.md` (also flag outdated internal
  flow docs: `#applyLocally`, `#proposeToParent`, etc. don't exist)
- `packages/website/src/content/docs/development/architecture.md`
- `packages/website/src/content/docs/development/how-it-works.md`
- `packages/website/src/content/docs/guides/keyboard-handling.md`
- `packages/core/src/features/caret/SPEC-rethink.md`
- `docs/superpowers/plans/2026-05-07-caret-value-decouple.md`

### Not changed

- `replaceAllContentWith` name stays
- `replaceAllContentWith` public export stays
- `replaceRange` API unchanged (other than dropping its internal `readOnly` guard)

## Verification

```sh
pnpm test
pnpm run typecheck
pnpm run lint:check
```
