# ValueFeature Current Signal Design

## Goal

Refactor `ValueFeature` so `current` is the canonical internal serialized value signal and controlled `props.value` is the source of truth.

## Original Problem

Serialized value ownership was split between parser diff state, internal edit state, and controlled props. That made controlled value flow hard to reason about and let internal edits optimistically update tokens even when `props.value` was controlled.

## Desired Behavior

`store.value.current` is a writable signal containing the editor's accepted serialized value.

Controlled mode is exposed as `store.value.isControlledMode()` and means `store.props.value() !== undefined`.

In controlled mode:

- internal edits call `onChange(nextValue)`
- `current` and `parsing.tokens` update only when the parent passes `nextValue` back through `props.value`
- local token mutations caused by DOM editing must not become the accepted state unless echoed by props

In uncontrolled mode:

- internal edits update `current`
- tokens update immediately
- `onChange(nextValue)` still fires

## Architecture

`ValueFeature` owns serialized value synchronization.

`ParsingFeature` owns token parsing helpers, parser selection, and string-to-token parsing through `store.parsing.parseValue(value)`, but no longer owns serialized value state. It must not watch `props.value` directly after this refactor. `ValueFeature` is the only feature that reacts to accepted serialized value changes from props or internal value commands.

`ParsingFeature` may still reparse when the parser/options shape changes, but it must reparse from `store.value.current()` rather than from `props.value` or focused UI content. This avoids a race where both `ValueFeature` and `ParsingFeature` parse the same prop change.

`computeTokensFromValue` must not read or write value feature state. For this refactor it should either be removed or become a pure full-parse wrapper around an explicit `value` argument used by `ParsingFeature.parseValue(value)`. The previous incremental diff path can be reintroduced later only if it no longer reads stale token content or value state.

## State Model

`ValueFeature` exposes:

- `current: Signal<string>` canonical accepted serialized value
- `isControlledMode: Computed<boolean>` true when `props.value` is present
- `next: Signal<string | undefined>` internal full-value edit command
- `change: Event<void>` DOM/token mutation change event

Initial `current` is `''`, then set on enable from:

```typescript
props.value ?? props.defaultValue ?? ''
```

## Data Flow

### Initial Enable

On enable, `ValueFeature` initializes `current` from controlled value, default value, or empty string. Tokens are parsed from that same value.

### Controlled Prop Change

When `props.value` changes to a string:

- compare against `current`
- parse the new value via `store.parsing.parseValue(newValue)`
- batch update `parsing.tokens(newTokens)` and `current(newValue)`

When `props.value` changes from a string to `undefined`, preserve the current accepted value and continue in uncontrolled mode. Do not reinitialize from `defaultValue` after mount.

### Internal Full-Value Edit

When `value.next(newValue)` fires:

- if `isControlledMode()` is true, call `onChange(newValue)` only
- if `isControlledMode()` is false, parse `newValue`, batch update tokens and `current`, then call `onChange(newValue)`

### DOM/Token Mutation Change

When `value.change()` fires:

- serialize candidate tokens with `toString(tokens)`
- if `isControlledMode()` is true, call `onChange(candidate)` and restore tokens by parsing `current` through `store.parsing.parseValue(current)`
- if `isControlledMode()` is false, set `current(candidate)`, trigger/reparse tokens as today, and call `onChange(candidate)`

Controlled restore must not call the existing UI-focused `parsing.reparse()` path, because that path can read already-mutated `focus.content` and accidentally accept a local DOM mutation.

### Overlay Selection

`OverlayFeature.select` must be migrated into the same value ownership model. It currently mutates the input DOM/token, calls `onChange`, and emits `parsing.reparse()` directly.

After this refactor, overlay selection should compute the candidate serialized value and pass it through `value.next(candidate)`. Controlled mode must not commit overlay tokens until prop echo.

### Full-Content Replacement

`replaceAllContentWith()` should route full-content replacement through `value.next(newContent)` or the same internal commit helper used by `next`.

### Drag Edits

`DragFeature` should read from `store.value.current()` for the current serialized value. It should no longer require `props.value()` to be present before calling `value.next()`, so uncontrolled drag edits follow the same value flow as other full-value edits.

## Caret Recovery

Some callers currently expect `value.next()` to synchronously update tokens and then read `parsing.tokens()` for caret recovery.

After this refactor:

- uncontrolled mode keeps synchronous token updates
- controlled mode must not read post-`next()` tokens as if they were committed
- controlled mode should skip token-position-based recovery immediately after `value.next()`
- caret recovery for controlled full-value edits should happen only after prop echo/render, or be omitted where no reliable anchor exists

Affected paths include span markup paste, clipboard cut, block editing, drag row actions, mark removal, and overlay selection.

## Command Semantics

`next` remains a signal for this refactor. Because signal writes suppress same-value updates, repeated `value.next(sameString)` commands are ignored. That is acceptable for this change because same-value commands should not emit redundant `onChange` events.

## Testing

Add or update tests for:

- `current` is a signal defaulting to `''`
- `isControlledMode` returns true only when `props.value` is not `undefined`
- enable initializes `current` and tokens from `props.value`
- enable initializes from `defaultValue` when uncontrolled
- controlled `next()` calls `onChange` without updating `current` or tokens
- uncontrolled `next()` updates `current`, tokens, and calls `onChange`
- controlled `props.value` echo updates `current` and tokens
- controlled `change()` emits candidate value and restores tokens from `current`
- uncontrolled `change()` accepts the serialized candidate as `current`
- parser/options changes reparse from `current`
- controlled no-echo behavior for span input, overlay select, clipboard cut/paste, block editing, `deleteMark`/`MarkHandler`, and drag
- migration of tests that referenced the removed value state in `Store.spec.ts`, `ValueFeature.spec.ts`, `ParseFeature.spec.ts`, and `input.spec.ts`

## Documentation

Update:

- `packages/core/src/features/value/README.md`
- `packages/core/src/store/README.md`
- `packages/website/src/content/docs/development/architecture.md`

Describe `current` as canonical serialized editor state.

## Assumptions

- Public React/Vue props do not change.
- Controlled behavior intentionally stops optimistic token updates.
- `next` remains as the internal command API for now.
- This refactor should not add dependencies.
