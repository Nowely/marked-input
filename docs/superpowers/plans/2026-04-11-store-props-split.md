# Store Props Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract external framework-provided signals out of `store.state` into a new `store.props` field with a `setProps` method, leaving `store.state` for purely internal feature-managed signals.

**Architecture:** `store.props` holds signals that framework adapters (React, Vue) write via `setProps()`. `store.state` holds signals that features write internally. Features may freely read from `store.props`; only framework adapters write to it. The existing `setState` is narrowed to cover only the remaining internal-state keys.

**Tech Stack:** TypeScript, alien-signals (reactive signals), React 19, Vue 3, Vitest

---

## Signal Split Reference

**Move to `store.props`** (framework provides these):
- `value`, `defaultValue`, `onChange`
- `options`
- `readOnly`, `drag`, `showOverlayOn`
- `Span`, `Mark`, `Overlay`
- `className`, `style`, `slots`, `slotProps`

**Stay in `store.state`** (features own these):
- `tokens`, `innerValue`, `previousValue`, `recovery`
- `selecting`
- `overlayMatch`, `overlayTrigger`

---

## File Map

| File | Change |
|------|--------|
| `packages/core/src/store/Store.ts` | Add `props` object + `setProps` method; remove moved keys from `state`; narrow `setState` |
| `packages/core/src/features/arrownav/ArrowNavFeature.ts` | `state.drag` → `props.drag` |
| `packages/core/src/features/block-editing/BlockEditFeature.ts` | `state.drag`, `state.onChange`, `state.options`, `state.value`, `state.previousValue`* → `props.*` |
| `packages/core/src/features/clipboard/CopyFeature.ts` | `state.previousValue`, `state.value` → `props.value` (read) |
| `packages/core/src/features/drag/DragFeature.ts` | `state.value`, `state.onChange`, `state.options` → `props.*` |
| `packages/core/src/features/editable/ContentEditableFeature.ts` | `state.readOnly`, `state.drag` → `props.*` |
| `packages/core/src/features/events/SystemListenerFeature.ts` | `state.onChange`, `state.Mark` → `props.*` |
| `packages/core/src/features/focus/FocusFeature.ts` | `state.Mark` → `props.Mark` |
| `packages/core/src/features/input/InputFeature.ts` | `state.drag`, `state.value`, `state.onChange`, `state.previousValue`* → `props.*` for value/onChange/drag |
| `packages/core/src/features/overlay/OverlayFeature.ts` | `state.options`, `state.showOverlayOn` → `props.*`; `state.overlayTrigger`/`overlayMatch` stay |
| `packages/core/src/features/parsing/ParseFeature.ts` | `state.value`, `state.defaultValue` → `props.*` |
| `packages/core/src/features/parsing/utils/valueParser.ts` | `state.value` → `props.value` |
| `packages/core/src/features/selection/selectionHelpers.ts` | `state.drag` → `props.drag` |
| `packages/core/src/features/editing/utils/deleteMark.ts` | `state.onChange`, `state.tokens` → `props.onChange` |
| `packages/react/markput/src/components/MarkedInput.tsx` | `store.setState(props)` → `store.setProps(props)` |
| `packages/vue/markput/src/components/MarkedInput.vue` | `store.value.setState({...})` → `store.value.setProps({...})` |
| `packages/core/src/features/editable/ContentEditableFeature.spec.ts` | `store.state.readOnly` → `store.props.readOnly` |
| `packages/core/src/features/events/SystemListenerFeature.spec.ts` | `store.state.onChange` → `store.props.onChange` |
| `packages/core/src/features/focus/FocusFeature.spec.ts` | `store.state.Mark` → `store.props.Mark` |
| `packages/core/src/features/overlay/OverlayFeature.spec.ts` | `store.state.showOverlayOn` → `store.props.showOverlayOn`; overlayTrigger/overlayMatch stay in state |
| `packages/core/src/features/parsing/ParseFeature.spec.ts` | `store.state.value/defaultValue/options/Mark` → `store.props.*` |

*`previousValue` stays in `state` — it's internally managed. Features read `props.value` for the controlled value.

---

## Task 1: Add `store.props` and `setProps` to Store

**Files:**
- Modify: `packages/core/src/store/Store.ts`

- [ ] **Step 1: Add `props` object and `setProps` method, keep `state` unchanged for now**

  Open `packages/core/src/store/Store.ts`. After the `state` object (after line 85), add the `props` object. Also add `setProps`. The `state` object is NOT changed yet — we keep both temporarily.

  Replace the `setState` method and add `setProps` below it:

  ```typescript
  // Add this new field after `readonly state = { ... }`:

  readonly props = {
    // Data
    value: signal<string | undefined>(undefined),
    defaultValue: signal<string | undefined>(undefined),

    // Callbacks
    onChange: signal<((value: string) => void) | undefined>(undefined),

    // Config
    options: signal<CoreOption[]>(DEFAULT_OPTIONS),
    readOnly: signal<boolean>(false),

    // Selection / drag
    drag: signal<boolean | {alwaysShowHandle: boolean}>(false),

    // Overlay
    showOverlayOn: signal<OverlayTrigger>('change'),

    // Component overrides
    Span: signal<unknown>(undefined),
    Mark: signal<unknown>(undefined),
    Overlay: signal<unknown>(undefined),

    // Styling
    className: signal<string | undefined>(undefined),
    style: signal<CSSProperties | undefined>(undefined, {equals: shallow}),

    // Slot system
    slots: signal<CoreSlots | undefined>(undefined),
    slotProps: signal<CoreSlotProps | undefined>(undefined),
  }
  ```

  Then add `setProps` alongside `setState` at the bottom of the class:

  ```typescript
  setProps(values: Partial<SignalValues<typeof this.props>>): void {
    batch(() => {
      const props = this.props
      // oxlint-disable-next-line no-unsafe-type-assertion -- heterogeneous signal map: per-key types verified by SignalValues<T> at the call site
      for (const key of Object.keys(values) as (keyof typeof this.props)[]) {
        if (!(key in props)) continue
        // oxlint-disable-next-line no-unsafe-type-assertion -- heterogeneous signal map: per-key types verified by SignalValues<T> at the call site
        props[key](values[key] as never)
      }
    })
  }
  ```

- [ ] **Step 2: Run typecheck to verify the addition compiles**

  ```bash
  cd c:/Git/marked-input && pnpm run typecheck 2>&1 | head -40
  ```

  Expected: No new errors from Store.ts. There may be pre-existing errors — note them but don't fix them yet.

- [ ] **Step 3: Commit the additive change**

  ```bash
  cd c:/Git/marked-input && git add packages/core/src/store/Store.ts
  git commit -m "feat(core): add store.props signal group and setProps method"
  ```

---

## Task 2: Update `store.computed` to read from `store.props`

**Files:**
- Modify: `packages/core/src/store/Store.ts` (computed section only)

- [ ] **Step 1: Update all computed signals that reference moved state keys**

  In Store.ts, update the `computed` object. Replace the entire `computed` block with:

  ```typescript
  readonly computed = {
    hasMark: computed(() => {
      const Mark = this.props.Mark()
      if (Mark) return true
      return this.props.options().some(opt => 'Mark' in opt && opt.Mark != null)
    }),
    parser: computed(() => {
      if (!this.computed.hasMark()) return

      const markups = this.props.options().map(opt => opt.markup)
      if (!markups.some(Boolean)) return

      const isDrag = !!this.props.drag()
      return new Parser(markups, isDrag ? {skipEmptyText: true} : undefined)
    }),
    containerClass: computed(() =>
      cx(styles.Container, this.props.className(), this.props.slotProps()?.container?.className)
    ),
    containerStyle: computed(prev => {
      const next = merge(this.props.style(), this.props.slotProps()?.container?.style)
      return prev && shallow(prev, next) ? prev : next
    }),
    // oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment Slot with typed overloads; core satisfies the base interface
    container: computed(() => [
      resolveSlot('container', this.props.slots()),
      resolveSlotProps('container', this.props.slotProps()),
    ]) as unknown as Slot,
    // oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment Slot with typed overloads; core satisfies the base interface
    block: computed(() => [
      resolveSlot('block', this.props.slots()),
      resolveSlotProps('block', this.props.slotProps()),
    ]) as unknown as Slot,
    // oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment Slot with typed overloads; core satisfies the base interface
    span: computed(() => [
      resolveSlot('span', this.props.slots()),
      resolveSlotProps('span', this.props.slotProps()),
    ]) as unknown as Slot,
    // oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment OverlaySlot with typed overloads; core satisfies the base interface
    overlay: computed(() => {
      const Overlay = this.props.Overlay()
      return (option?: CoreOption, defaultComponent?: unknown) =>
        resolveOverlaySlot(Overlay, option, defaultComponent)
    }) as unknown as OverlaySlot,
    // oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment MarkSlot with typed overloads; core satisfies the base interface
    mark: computed(() => {
      const options = this.props.options()
      const Mark = this.props.Mark()
      const Span = this.props.Span()
      return (token: Token) => resolveMarkSlot(token, options, Mark, Span)
    }) as unknown as MarkSlot,
  }
  ```

- [ ] **Step 2: Run typecheck**

  ```bash
  cd c:/Git/marked-input && pnpm run typecheck 2>&1 | head -40
  ```

  Expected: No new errors.

- [ ] **Step 3: Commit**

  ```bash
  cd c:/Git/marked-input && git add packages/core/src/store/Store.ts
  git commit -m "refactor(core): update store.computed to read from store.props"
  ```

---

## Task 3: Update features to read from `store.props`

**Files:**
- Modify: 9 feature files listed below

- [ ] **Step 1: Update `ArrowNavFeature.ts`**

  File: `packages/core/src/features/arrownav/ArrowNavFeature.ts`

  Change line with `this.store.state.drag()`:
  ```typescript
  // Before:
  if (this.store.state.drag()) return
  // After:
  if (this.store.props.drag()) return
  ```

- [ ] **Step 2: Update `ContentEditableFeature.ts`**

  File: `packages/core/src/features/editable/ContentEditableFeature.ts`

  Change all `this.store.state.readOnly()` → `this.store.props.readOnly()` and `this.store.state.drag()` → `this.store.props.drag()`. There are 3 occurrences across the file:

  ```typescript
  // Line ~17: 
  // Before: this.store.state.readOnly()
  // After:  this.store.props.readOnly()

  // Line ~38:
  // Before: const readOnly = this.store.state.readOnly()
  // After:  const readOnly = this.store.props.readOnly()

  // Line ~41:
  // Before: const isDrag = !!this.store.state.drag()
  // After:  const isDrag = !!this.store.props.drag()
  ```

- [ ] **Step 3: Update `BlockEditFeature.ts`**

  File: `packages/core/src/features/block-editing/BlockEditFeature.ts`

  Four occurrences:
  ```typescript
  // Line ~29:
  // Before: if (!this.store.state.drag()) return
  // After:  if (!this.store.props.drag()) return

  // Line ~42:
  // Before: if (!this.store.state.drag()) return
  // After:  if (!this.store.props.drag()) return

  // Line ~77:
  // Before: if (!this.store.state.onChange()) return
  // After:  if (!this.store.props.onChange()) return

  // Line ~76:
  // Before: const value = this.store.state.previousValue() ?? this.store.state.value() ?? ''
  // After:  const value = this.store.state.previousValue() ?? this.store.props.value() ?? ''

  // Line ~231:
  // Before: const newRowContent = createRowContent(this.store.state.options())
  // After:  const newRowContent = createRowContent(this.store.props.options())

  // Line ~229:
  // Before: if (!this.store.state.onChange()) return
  // After:  if (!this.store.props.onChange()) return

  // Line ~227:
  // Before: const value = this.store.state.previousValue() ?? this.store.state.value() ?? ''
  // After:  const value = this.store.state.previousValue() ?? this.store.props.value() ?? ''

  // Line ~353:
  // Before: const value = this.store.state.previousValue() ?? this.store.state.value() ?? ''
  // After:  const value = this.store.state.previousValue() ?? this.store.props.value() ?? ''
  ```

  Use your editor to apply all these at once. The pattern is: any `this.store.state.drag()`, `this.store.state.onChange()`, `this.store.state.options()`, and `this.store.state.value()` (where reading the controlled value, not previousValue) → `this.store.props.*`.

- [ ] **Step 4: Update `DragFeature.ts`**

  File: `packages/core/src/features/drag/DragFeature.ts`

  Change all `this.store.state.value()`, `this.store.state.onChange()`, `this.store.state.options()`:

  ```typescript
  // Every occurrence of:
  // this.store.state.value()   → this.store.props.value()
  // this.store.state.onChange()  → this.store.props.onChange()
  // this.store.state.options()   → this.store.props.options()
  ```

- [ ] **Step 5: Update `SystemListenerFeature.ts`**

  File: `packages/core/src/features/events/SystemListenerFeature.ts`

  ```typescript
  // Before: const onChange = this.store.state.onChange()
  // After:  const onChange = this.store.props.onChange()

  // Before: this.store.state.onChange()?.(newValue)
  // After:  this.store.props.onChange()?.(newValue)

  // Before: const Mark = this.store.state.Mark()
  // After:  const Mark = this.store.props.Mark()

  // Before: const onChange = this.store.state.onChange()   (second occurrence)
  // After:  const onChange = this.store.props.onChange()
  ```

- [ ] **Step 6: Update `FocusFeature.ts`**

  File: `packages/core/src/features/focus/FocusFeature.ts`

  ```typescript
  // Before: if (!this.store.state.Mark()) return
  // After:  if (!this.store.props.Mark()) return
  ```

- [ ] **Step 7: Update `InputFeature.ts`**

  File: `packages/core/src/features/input/InputFeature.ts`

  ```typescript
  // ~Line 23:
  // Before: if (!this.store.state.drag()) {
  // After:  if (!this.store.props.drag()) {

  // ~Line 122 (module-level function, uses `store` parameter):
  // Before: if (store.state.drag()) return
  // After:  if (store.props.drag()) return

  // ~Line 150:
  // Before: const currentValue = store.state.previousValue() ?? store.state.value() ?? ''
  // After:  const currentValue = store.state.previousValue() ?? store.props.value() ?? ''

  // ~Line 265:
  // Before: store.state.onChange()?.(newContent)
  // After:  store.props.onChange()?.(newContent)

  // ~Line 267:
  // Before: if (store.state.value() === undefined) {
  // After:  if (store.props.value() === undefined) {
  ```

- [ ] **Step 8: Update `OverlayFeature.ts`**

  File: `packages/core/src/features/overlay/OverlayFeature.ts`

  Note: `overlayTrigger` and `overlayMatch` stay in `state`. Only `options` and `showOverlayOn` move.

  ```typescript
  // ~Line 30:
  // Before: const match = TriggerFinder.find(this.store.state.options(), getTrigger)
  // After:  const match = TriggerFinder.find(this.store.props.options(), getTrigger)

  // ~Line 35:
  // Before: const showOverlayOn = this.store.state.showOverlayOn()
  // After:  const showOverlayOn = this.store.props.showOverlayOn()

  // ~Line 54:
  // Before: const showOverlayOn = this.store.state.showOverlayOn()
  // After:  const showOverlayOn = this.store.props.showOverlayOn()
  ```

- [ ] **Step 9: Update `ParseFeature.ts`**

  File: `packages/core/src/features/parsing/ParseFeature.ts`

  ```typescript
  // ~Line 32:
  // Before: const inputValue = store.state.value() ?? store.state.defaultValue() ?? ''
  // After:  const inputValue = store.props.value() ?? store.props.defaultValue() ?? ''

  // ~Line 35:
  // Before: this.#lastValue = store.state.value()
  // After:  this.#lastValue = store.props.value()

  // ~Line 41:
  // Before: const value = this.store.state.value()
  // After:  const value = this.store.props.value()
  ```

- [ ] **Step 10: Update `valueParser.ts`**

  File: `packages/core/src/features/parsing/utils/valueParser.ts`

  ```typescript
  // getTokensByValue, ~Line 22:
  // Before: const value = store.state.value()
  // After:  const value = store.props.value()

  // ~Line 24:
  // Before: const gap = findGap(store.state.previousValue(), value)
  // After:  const gap = findGap(store.state.previousValue(), value)   ← no change, previousValue stays in state

  // ~Line 27:
  // Before: store.state.previousValue(value)
  // After:  store.state.previousValue(value)   ← no change

  // ~Line 32:
  // Before: store.state.previousValue(value)
  // After:  store.state.previousValue(value)   ← no change
  ```

  Only change `store.state.value()` → `store.props.value()`.

- [ ] **Step 11: Update `selectionHelpers.ts`**

  File: `packages/core/src/features/selection/selectionHelpers.ts`

  ```typescript
  // Before: if (store.state.drag()) return
  // After:  if (store.props.drag()) return
  ```

- [ ] **Step 12: Update `deleteMark.ts`**

  File: `packages/core/src/features/editing/utils/deleteMark.ts`

  ```typescript
  // Before: store.state.onChange()?.(toString(store.state.tokens()))
  // After:  store.props.onChange()?.(toString(store.state.tokens()))
  ```

- [ ] **Step 13: Update `CopyFeature.ts`**

  File: `packages/core/src/features/clipboard/CopyFeature.ts`

  On line ~57:
  ```typescript
  // Before: const value = this.store.state.previousValue() ?? this.store.state.value() ?? ''
  // After:  const value = this.store.state.previousValue() ?? this.store.props.value() ?? ''
  ```

- [ ] **Step 14: Run typecheck**

  ```bash
  cd c:/Git/marked-input && pnpm run typecheck 2>&1 | head -60
  ```

  Expected: No errors in feature files. If any `state.*` property is missing, check if it was incorrectly moved.

- [ ] **Step 15: Run tests**

  ```bash
  cd c:/Git/marked-input && pnpm test 2>&1 | tail -30
  ```

  Expected: Some test failures — tests still set `store.state.*` for props that now need to go through `store.props.*`. That's fixed in Task 4.

- [ ] **Step 16: Commit features update**

  ```bash
  cd c:/Git/marked-input && git add packages/core/src/features/
  git commit -m "refactor(core): update features to read from store.props"
  ```

---

## Task 4: Update test files

**Files:**
- Modify: 5 spec files

- [ ] **Step 1: Update `ContentEditableFeature.spec.ts`**

  File: `packages/core/src/features/editable/ContentEditableFeature.spec.ts`

  ```typescript
  // Before: store.state.readOnly(true)   (both occurrences)
  // After:  store.props.readOnly(true)
  ```

- [ ] **Step 2: Update `SystemListenerFeature.spec.ts`**

  File: `packages/core/src/features/events/SystemListenerFeature.spec.ts`

  All 8 occurrences of `store.state.onChange(onChange)`:
  ```typescript
  // Before: store.state.onChange(onChange)
  // After:  store.props.onChange(onChange)
  ```

- [ ] **Step 3: Update `FocusFeature.spec.ts`**

  File: `packages/core/src/features/focus/FocusFeature.spec.ts`

  ```typescript
  // Before: store.state.Mark(() => null)
  // After:  store.props.Mark(() => null)
  ```

- [ ] **Step 4: Update `OverlayFeature.spec.ts`**

  File: `packages/core/src/features/overlay/OverlayFeature.spec.ts`

  Only `showOverlayOn` moves to `props`. `overlayTrigger` and `overlayMatch` stay in `state`:

  ```typescript
  // Line 81:
  // Before: store.state.showOverlayOn('change')
  // After:  store.props.showOverlayOn('change')

  // Line 92:
  // Before: store.state.showOverlayOn('selectionChange')
  // After:  store.props.showOverlayOn('selectionChange')

  // Lines 47, 117, 120 — overlayTrigger: NO CHANGE (stays in state)
  // Lines 65, 69, 84, 88, etc. — overlayMatch: NO CHANGE (stays in state)
  ```

- [ ] **Step 5: Update `ParseFeature.spec.ts`**

  File: `packages/core/src/features/parsing/ParseFeature.spec.ts`

  All references to `store.state.value(...)`, `store.state.defaultValue(...)`, `store.state.options(...)`, `store.state.Mark(...)` move to `store.props.*`:

  ```typescript
  // Replace all of these:
  // store.state.value(...)        → store.props.value(...)
  // store.state.defaultValue(...) → store.props.defaultValue(...)
  // store.state.options(...)      → store.props.options(...)
  // store.state.Mark(...)         → store.props.Mark(...)
  ```

  Occurrences: lines 23, 33, 52, 62, 63, 74, 75, 76, 92, 102, 105, 114, 115, 116, 119, 128, 131, 144, 164, 176, 181, 193, 207.

- [ ] **Step 6: Run tests**

  ```bash
  cd c:/Git/marked-input && pnpm test 2>&1 | tail -30
  ```

  Expected: All tests pass.

- [ ] **Step 7: Commit test updates**

  ```bash
  cd c:/Git/marked-input && git add packages/core/src/features/
  git commit -m "test(core): update specs to use store.props for external signals"
  ```

---

## Task 5: Remove moved signals from `store.state` and narrow `setState`

**Files:**
- Modify: `packages/core/src/store/Store.ts`

- [ ] **Step 1: Remove moved keys from `state` and narrow `setState`**

  In `packages/core/src/store/Store.ts`, replace the current `state` object with the narrowed version containing only internal signals:

  ```typescript
  readonly state = {
    // Data
    tokens: signal<Token[]>([]),
    previousValue: signal<string | undefined>(undefined),
    innerValue: signal<string | undefined>(undefined),
    recovery: signal<Recovery | undefined>(undefined),

    // Selection
    selecting: signal<'drag' | 'all' | undefined>(undefined),

    // Overlay (internally managed by OverlayFeature)
    overlayMatch: signal<OverlayMatch | undefined>(undefined),
    overlayTrigger: signal<((option: CoreOption) => string | undefined) | undefined>(undefined),
  }
  ```

  The `setState` method body stays the same — it will now only accept keys present in the narrowed `state` type, enforced by TypeScript.

- [ ] **Step 2: Run typecheck**

  ```bash
  cd c:/Git/marked-input && pnpm run typecheck 2>&1 | head -60
  ```

  Expected: Errors only if any feature still uses a removed `state.*` key. Fix each — they should all have been updated in Task 3.

- [ ] **Step 3: Run tests**

  ```bash
  cd c:/Git/marked-input && pnpm test 2>&1 | tail -30
  ```

  Expected: All pass.

- [ ] **Step 4: Commit**

  ```bash
  cd c:/Git/marked-input && git add packages/core/src/store/Store.ts
  git commit -m "refactor(core): remove prop signals from store.state, narrow setState"
  ```

---

## Task 6: Update framework adapters

**Files:**
- Modify: `packages/react/markput/src/components/MarkedInput.tsx`
- Modify: `packages/vue/markput/src/components/MarkedInput.vue`

- [ ] **Step 1: Update React adapter**

  File: `packages/react/markput/src/components/MarkedInput.tsx`

  ```typescript
  // Before:
  store.setState(props)

  // After:
  store.setProps(props)
  ```

  Note: `setProps` accepts `Partial<SignalValues<typeof store.props>>`. The `props` object passed from React's `MarkedInputProps` maps 1:1 — no other changes needed.

- [ ] **Step 2: Update Vue adapter**

  File: `packages/vue/markput/src/components/MarkedInput.vue`

  ```typescript
  // Before:
  function syncProps() {
    store.value.setState({
      value: props.value,
      defaultValue: props.defaultValue,
      onChange: (v: string) => emit('change', v),
      readOnly: props.readOnly,
      drag: props.drag,
      options: props.options,
      showOverlayOn: props.showOverlayOn,
      Span: props.Span,
      Mark: props.Mark,
      Overlay: props.Overlay,
      className: props.class,
      style: props.style,
      slots: props.slots,
      slotProps: props.slotProps,
    })
  }

  // After:
  function syncProps() {
    store.value.setProps({
      value: props.value,
      defaultValue: props.defaultValue,
      onChange: (v: string) => emit('change', v),
      readOnly: props.readOnly,
      drag: props.drag,
      options: props.options,
      showOverlayOn: props.showOverlayOn,
      Span: props.Span,
      Mark: props.Mark,
      Overlay: props.Overlay,
      className: props.class,
      style: props.style,
      slots: props.slots,
      slotProps: props.slotProps,
    })
  }
  ```

- [ ] **Step 3: Run full checks**

  ```bash
  cd c:/Git/marked-input && pnpm run typecheck 2>&1 | tail -20
  ```

  Expected: No errors.

- [ ] **Step 4: Run all tests**

  ```bash
  cd c:/Git/marked-input && pnpm test 2>&1 | tail -30
  ```

  Expected: All pass.

- [ ] **Step 5: Commit**

  ```bash
  cd c:/Git/marked-input && git add packages/react/markput/src/components/MarkedInput.tsx packages/vue/markput/src/components/MarkedInput.vue
  git commit -m "refactor(react,vue): use store.setProps in framework adapters"
  ```

---

## Task 7: Final verification and lint

- [ ] **Step 1: Run all checks in sequence**

  ```bash
  cd c:/Git/marked-input && pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint && pnpm run format
  ```

  Expected: All pass, zero errors.

- [ ] **Step 2: If lint or format fail, fix and commit**

  ```bash
  cd c:/Git/marked-input && pnpm run lint:fix && pnpm run format:fix
  git add -A
  git commit -m "chore: fix lint and format after store.props refactor"
  ```

- [ ] **Step 3: Update AGENTS.md rule**

  File: `AGENTS.md` (line ~83): The rule "Do not manually create Signals for new state — add new state keys to the `state` object in Store.ts" must be updated:

  ```markdown
  <!-- Before: -->
  - Do not manually create Signals for new state — add new state keys to the `state` object in Store.ts

  <!-- After: -->
  - Do not manually create Signals for new state — add new state keys to either `state` (internal, feature-managed) or `props` (external, framework-provided) in `Store.ts`. Features write to `state`; framework adapters write to `props` via `setProps()`.
  ```

- [ ] **Step 4: Final commit**

  ```bash
  cd c:/Git/marked-input && git add AGENTS.md
  git commit -m "docs: update AGENTS.md to document store.props vs store.state split"
  ```

---

## Self-Review

**Spec coverage:**
- ✅ `store.props` field with `setProps` — Task 1
- ✅ Moved all external/prop signals out of `state` — Task 5
- ✅ `store.computed` updated to read `props.*` — Task 2
- ✅ All 9 feature files updated — Task 3
- ✅ React adapter updated — Task 6
- ✅ Vue adapter updated — Task 6
- ✅ Tests updated — Task 4
- ✅ AGENTS.md updated — Task 7

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:**
- `setProps` uses `SignalValues<typeof this.props>` — consistent with how `setState` uses `SignalValues<typeof this.state>`
- `store.props.*` references in tasks 2–4 all match the signal names defined in Task 1
- `overlayTrigger` and `overlayMatch` are consistently kept in `state` throughout
