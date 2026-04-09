# Remove `defaultSpan` from Store

## Problem

`Store` (core) takes a `defaultSpan` constructor option that is a framework-specific component (`Span.tsx` / `Span.vue`). This breaks the framework-agnostic boundary and forces a constructor argument on every `new Store()` call.

Both React and Vue Span components are trivial — they render `<span />` and nothing else. The `resolveSlot.ts` file already hardcodes `'div'` and `'span'` as default slot tags in `defaultSlots`. The same pattern should apply here.

## Solution

Hardcode `'span'` as the fallback in `resolveMarkSlot()` instead of accepting it as a parameter from Store. Remove the `StoreOptions` constructor, making `Store` instantiable with no arguments.

## Changes

### Core

**`packages/core/src/features/store/Store.ts`:**
- Remove `StoreOptions` interface
- Remove `_defaultSpan` private field
- Remove `getDefaultSpan` from `slot` creation
- Remove constructor (or make parameterless)

**`packages/core/src/features/slots/resolveSlot.ts`:**
- `resolveMarkSlot()`: remove `defaultSpan` parameter, use `'span'` literal as fallback on line 55

**`packages/core/src/features/slots/createSlots.ts`:**
- Remove `getDefaultSpan` from `SlotSignals` interface
- Remove `getDefaultSpan` argument from `createMarkSlot()` and its callers

### Framework packages

**`packages/react/markput/src/components/MarkedInput.tsx`:**
- `new Store()` instead of `new Store({defaultSpan: DefaultSpan})`
- Remove `import {Span as DefaultSpan} from './Span'`

**`packages/vue/markput/src/components/MarkedInput.vue`:**
- `new Store()` instead of `new Store({defaultSpan: markRaw(Span)})`
- Remove `import Span from './Span.vue'` if unused elsewhere

### Tests

- All spec files: `new Store({defaultSpan: null})` becomes `new Store()`
- `createSlots.spec.ts`: remove `getDefaultSpan` from setup mock
- `Store.spec.ts`: update constructor tests

## No breaking changes

- The `Span` signal override (`store.state.Span`) still works for custom span components
- `'span'` string fallback produces identical output to the removed framework components
