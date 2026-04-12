# Slot Computed Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace tuple-based `Slot` computeds on `store.computed` with named `*Component` / `*Props` pairs, folding className, style, and drag logic into core so framework components only spread props.

**Architecture:** Core `Store.computed` gains six new computeds (`containerComponent`, `containerProps`, `blockComponent`, `blockProps`, `spanComponent`, `spanProps`) replacing the three Slot tuples and two separate class/style computeds. Framework components (React + Vue) update to consume the new names. The `Slot` interface is removed.

**Tech Stack:** TypeScript, Vitest (tests run with `npm test` inside `packages/core`), React, Vue 3.

**Spec:** `docs/superpowers/specs/2026-04-12-slot-computed-split-design.md`

---

## File Map

| Action | File | What changes |
|---|---|---|
| Modify | `packages/core/src/store/Store.ts` | Remove old computeds, add six new ones |
| Modify | `packages/core/src/store/Store.spec.ts` | Replace old slot tests, add new tests |
| Modify | `packages/core/src/features/slots/types.ts` | Remove `Slot` interface |
| Modify | `packages/core/src/features/slots/index.ts` | Remove `Slot` export |
| Modify | `packages/core/src/features/slots/README.md` | Update usage examples |
| Modify | `packages/react/markput/src/components/Container.tsx` | Use new computeds |
| Modify | `packages/react/markput/src/components/Block.tsx` | Use new computeds |
| Modify | `packages/vue/markput/src/components/Container.vue` | Use new computeds |
| Modify | `packages/vue/markput/src/components/Block.vue` | Use new computeds |

---

## Task 1: Replace `containerStyle` and slot tuple tests with new tests (red)

**Files:**
- Modify: `packages/core/src/store/Store.spec.ts`

- [ ] **Step 1: Remove old `containerStyle` describe block and old slot tuple tests**

In `Store.spec.ts`, delete the entire `describe('containerStyle (computed)', ...)` block (lines 197–233) and replace the `describe('computed slots', ...)` block (lines 275–347) with new tests. Keep the `mark` and `overlay` tests inside the slots describe — only replace the `container`/`block`/`span` tuple tests.

The file section to replace (from `describe('containerStyle (computed)'` through the end of the container/block/span tuple tests inside `describe('computed slots'`) should become:

```ts
describe('containerProps (computed)', () => {
    it('should include base Container class when nothing is set', () => {
        const store = new Store()
        expect(store.computed.containerProps().className).toContain('Container')
    })

    it('should merge user className into containerProps.className', () => {
        const store = new Store()
        store.setProps({className: 'my-editor'})
        const {className} = store.computed.containerProps()
        expect(className).toContain('my-editor')
        expect(className).toContain('Container')
    })

    it('should merge slotProps.container.className into containerProps.className', () => {
        const store = new Store()
        store.setProps({slotProps: {container: {className: 'slot-class'}}})
        expect(store.computed.containerProps().className).toContain('slot-class')
    })

    it('should merge style and slotProps.container.style into containerProps.style', () => {
        const store = new Store()
        store.setProps({
            style: {color: 'red'},
            slotProps: {container: {style: {fontSize: 14}}},
        })
        expect(store.computed.containerProps().style).toEqual({color: 'red', fontSize: 14})
    })

    it('should add paddingLeft: 24 to style when drag is active', () => {
        const store = new Store()
        store.setProps({drag: true, style: {color: 'red'}})
        expect(store.computed.containerProps().style).toEqual({paddingLeft: 24, color: 'red'})
    })

    it('should add paddingLeft: 24 with no base style when drag is active', () => {
        const store = new Store()
        store.setProps({drag: true})
        expect(store.computed.containerProps().style).toEqual({paddingLeft: 24})
    })

    it('should NOT add paddingLeft when drag is active but readOnly is true', () => {
        const store = new Store()
        store.setProps({drag: true, readOnly: true, style: {color: 'red'}})
        expect(store.computed.containerProps().style).toEqual({color: 'red'})
    })

    it('should not include className or style keys from slotProps in otherSlotProps spread', () => {
        const store = new Store()
        store.setProps({slotProps: {container: {className: 'x', style: {color: 'red'}}}})
        const props = store.computed.containerProps()
        // className and style handled explicitly — no duplicate keys at the same level
        const keys = Object.keys(props)
        expect(keys.filter(k => k === 'className')).toHaveLength(1)
        expect(keys.filter(k => k === 'style')).toHaveLength(1)
    })

    it('should include data-* slotProps in containerProps', () => {
        const store = new Store()
        store.setProps({slotProps: {container: {dataTestId: 'root'}}})
        expect(store.computed.containerProps()).toMatchObject({'data-test-id': 'root'})
    })

    it('should return same reference when values unchanged (shallow stable)', () => {
        const store = new Store()
        store.setProps({style: {color: 'red'}})
        const first = store.computed.containerProps()
        const second = store.computed.containerProps()
        expect(first).toBe(second)
    })

    it('should react to style changes', () => {
        const store = new Store()
        store.setProps({style: {color: 'red'}})
        expect(store.computed.containerProps().style).toEqual({color: 'red'})
        store.setProps({style: {color: 'blue'}})
        expect(store.computed.containerProps().style).toEqual({color: 'blue'})
    })
})

describe('containerComponent (computed)', () => {
    it('should return "div" by default', () => {
        const store = new Store()
        expect(store.computed.containerComponent()).toBe('div')
    })

    it('should return user-provided slot component', () => {
        const store = new Store()
        store.setProps({slots: {container: 'section'}})
        expect(store.computed.containerComponent()).toBe('section')
    })
})

describe('blockComponent / blockProps (computed)', () => {
    it('should return "div" for blockComponent by default', () => {
        const store = new Store()
        expect(store.computed.blockComponent()).toBe('div')
    })

    it('should return undefined for blockProps by default', () => {
        const store = new Store()
        expect(store.computed.blockProps()).toBeUndefined()
    })

    it('should resolve block slotProps', () => {
        const store = new Store()
        store.setProps({slotProps: {block: {dataBlock: 'true'}}})
        expect(store.computed.blockProps()).toMatchObject({'data-block': 'true'})
    })
})

describe('spanComponent / spanProps (computed)', () => {
    it('should return "span" for spanComponent by default', () => {
        const store = new Store()
        expect(store.computed.spanComponent()).toBe('span')
    })

    it('should return undefined for spanProps by default', () => {
        const store = new Store()
        expect(store.computed.spanProps()).toBeUndefined()
    })

    it('should resolve custom span slot', () => {
        const store = new Store()
        store.setProps({slots: {span: 'strong'}})
        expect(store.computed.spanComponent()).toBe('strong')
    })

    it('should resolve span slotProps', () => {
        const store = new Store()
        store.setProps({slotProps: {span: {className: 'bold'}}})
        expect(store.computed.spanProps()).toMatchObject({className: 'bold'})
    })
})
```

Also remove the old tuple tests from inside `describe('computed slots', ...)`:
- `'should return default container slot'`
- `'should return default block slot'`
- `'should return default span slot'`
- `'should resolve custom container slot'`
- `'should resolve custom span slot with props'`

Keep the `mark` and `overlay` tests.

- [ ] **Step 2: Run the tests to confirm they fail (expected — new computeds don't exist yet)**

```bash
cd packages/core && npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|Error" | head -30
```

Expected: failures on `containerProps`, `containerComponent`, `blockComponent`, `blockProps`, `spanComponent`, `spanProps`.

---

## Task 2: Add new computeds to `Store.ts`

**Files:**
- Modify: `packages/core/src/store/Store.ts`

- [ ] **Step 1: Remove old computeds and add new ones**

In `Store.ts`, replace the `readonly computed` block. The current block runs from line 87 to line 137. Replace these lines:

```ts
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

With:

```ts
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
    containerComponent: computed(() =>
        resolveSlot('container', this.props.slots())
    ),
    containerProps: computed(prev => {
        const drag = !!this.props.drag()
        const readOnly = this.props.readOnly()
        const baseStyle = merge(this.props.style(), this.props.slotProps()?.container?.style)
        const style = drag && !readOnly
            ? (baseStyle ? {paddingLeft: 24, ...baseStyle} : {paddingLeft: 24})
            : baseStyle
        const {className: _cls, style: _sty, ...otherSlotProps} =
            resolveSlotProps('container', this.props.slotProps()) ?? {}
        const next = {
            className: cx(styles.Container, this.props.className(), this.props.slotProps()?.container?.className),
            style,
            ...otherSlotProps,
        }
        return prev && shallow(prev, next) ? prev : next
    }),
    blockComponent: computed(() =>
        resolveSlot('block', this.props.slots())
    ),
    blockProps: computed(() =>
        resolveSlotProps('block', this.props.slotProps())
    ),
    spanComponent: computed(() =>
        resolveSlot('span', this.props.slots())
    ),
    spanProps: computed(() =>
        resolveSlotProps('span', this.props.slotProps())
    ),
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

- [ ] **Step 2: Remove the `Slot` import from the import block**

Find this line near the top of `Store.ts`:
```ts
import type {MarkSlot, OverlaySlot, Slot} from '../features/slots'
```
Change to:
```ts
import type {MarkSlot, OverlaySlot} from '../features/slots'
```

- [ ] **Step 3: Run the core tests**

```bash
cd packages/core && npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: all tests pass, including the new `containerProps`, `containerComponent`, `blockComponent`, `blockProps`, `spanComponent`, `spanProps` tests.

- [ ] **Step 4: Commit**

```bash
cd packages/core && git add src/store/Store.ts src/store/Store.spec.ts
git commit -m "feat(core): replace Slot tuple computeds with named component/props pairs"
```

---

## Task 3: Remove `Slot` interface from core slots feature

**Files:**
- Modify: `packages/core/src/features/slots/types.ts`
- Modify: `packages/core/src/features/slots/index.ts`

- [ ] **Step 1: Remove `Slot` from `types.ts`**

Current content of `packages/core/src/features/slots/types.ts`:
```ts
import type {CoreOption} from '../../shared/types'
import type {Token} from '../parsing'

export interface Slot {
    (): readonly [unknown, Record<string, unknown> | undefined]
}

export interface MarkSlot {
    (): (token: Token) => readonly [unknown, unknown]
}

export interface OverlaySlot {
    (): (option?: CoreOption, defaultComponent?: unknown) => readonly [unknown, unknown]
}
```

Replace with (remove `Slot` only):
```ts
import type {CoreOption} from '../../shared/types'
import type {Token} from '../parsing'

export interface MarkSlot {
    (): (token: Token) => readonly [unknown, unknown]
}

export interface OverlaySlot {
    (): (option?: CoreOption, defaultComponent?: unknown) => readonly [unknown, unknown]
}
```

- [ ] **Step 2: Remove `Slot` from `index.ts`**

Current `packages/core/src/features/slots/index.ts`:
```ts
export type {Slot, MarkSlot, OverlaySlot} from './types'
export {
    resolveSlot,
    resolveSlotProps,
    resolveOverlaySlot,
    resolveMarkSlot,
    type SlotName,
    type SlotOption,
} from './resolveSlot'
export {resolveOptionSlot} from './resolveOptionSlot'
```

Replace with:
```ts
export type {MarkSlot, OverlaySlot} from './types'
export {
    resolveSlot,
    resolveSlotProps,
    resolveOverlaySlot,
    resolveMarkSlot,
    type SlotName,
    type SlotOption,
} from './resolveSlot'
export {resolveOptionSlot} from './resolveOptionSlot'
```

- [ ] **Step 3: Run core tests and typecheck**

```bash
cd packages/core && npm test && npm run typecheck
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/slots/types.ts packages/core/src/features/slots/index.ts
git commit -m "feat(core): remove Slot interface — replaced by named component/props computeds"
```

---

## Task 4: Update React `Container.tsx`

**Files:**
- Modify: `packages/react/markput/src/components/Container.tsx`

- [ ] **Step 1: Rewrite `Container.tsx`**

Replace the entire file content:

```tsx
import type {ElementType} from 'react'
import {memo, useLayoutEffect} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/providers/StoreContext'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
    const store = useStore()

    const {drag, tokens} = useMarkput(s => ({
        drag: s.props.drag,
        tokens: s.state.tokens,
    }))

    // oxlint-disable-next-line no-unsafe-type-assertion -- containerComponent returns unknown in core; React ElementType asserted here
    const Component = useMarkput(s => s.computed.containerComponent) as ElementType
    const props = useMarkput(s => s.computed.containerProps)

    useLayoutEffect(() => {
        store.event.afterTokensRendered()
    }, [tokens])

    const key = store.key
    const refs = store.refs

    return (
        <Component
            ref={(el: HTMLDivElement | null) => (refs.container = el)}
            {...props}
        >
            {drag
                ? tokens.map((t, i) => <Block key={key.get(t)} token={t} blockIndex={i} />)
                : tokens.map(t => <Token key={key.get(t)} mark={t} />)}
        </Component>
    )
})

Container.displayName = 'Container'
```

- [ ] **Step 2: Typecheck the React package**

```bash
cd packages/react/markput && npm run typecheck 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/react/markput/src/components/Container.tsx
git commit -m "feat(react): update Container to use containerComponent/containerProps"
```

---

## Task 5: Update React `Block.tsx`

**Files:**
- Modify: `packages/react/markput/src/components/Block.tsx`

- [ ] **Step 1: Rewrite `Block.tsx`**

Replace the entire file content:

```tsx
import type {Token as TokenType} from '@markput/core'
import type {CSSProperties, ElementType} from 'react'
import {memo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/providers/StoreContext'
import {BlockMenu} from './BlockMenu'
import {DragHandle} from './DragHandle'
import {DropIndicator} from './DropIndicator'
import {Token} from './Token'

import styles from '@markput/core/styles.module.css'

interface BlockProps {
    token: TokenType
    blockIndex: number
}

export const Block = memo(({token, blockIndex}: BlockProps) => {
    const store = useStore()
    const blockStore = store.blocks.get(token)

    // oxlint-disable-next-line no-unsafe-type-assertion -- blockComponent returns unknown in core; React ElementType asserted here
    const Component = useMarkput(s => s.computed.blockComponent) as ElementType
    const slotProps = useMarkput(s => s.computed.blockProps)
    const isDragging = useMarkput(() => blockStore.state.isDragging)

    return (
        <Component
            ref={(el: HTMLElement | null) => blockStore.attachContainer(el, blockIndex, store.event)}
            data-testid="block"
            {...slotProps}
            className={styles.Block}
            style={{opacity: isDragging ? 0.4 : 1, ...(slotProps?.style as CSSProperties | undefined)}}
        >
            <DropIndicator token={token} position="before" />

            <DragHandle token={token} blockIndex={blockIndex} />

            <Token mark={token} />

            <DropIndicator token={token} position="after" />

            <BlockMenu token={token} />
        </Component>
    )
})

Block.displayName = 'Block'
```

- [ ] **Step 2: Typecheck the React package**

```bash
cd packages/react/markput && npm run typecheck 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/react/markput/src/components/Block.tsx
git commit -m "feat(react): update Block to use blockComponent/blockProps"
```

---

## Task 6: Update Vue `Container.vue`

**Files:**
- Modify: `packages/vue/markput/src/components/Container.vue`

- [ ] **Step 1: Rewrite `Container.vue`**

Replace the entire file content:

```vue
<script setup lang="ts">
import {watch} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import Block from './Block.vue'
import Token from './Token.vue'

const store = useStore()

const drag = useMarkput(s => s.props.drag)
const tokens = useMarkput(s => s.state.tokens)
const containerComponent = useMarkput(s => s.computed.containerComponent)
const containerProps = useMarkput(s => s.computed.containerProps)

watch(tokens, () => store.event.afterTokensRendered(), {flush: 'post', immediate: true})

const key = store.key
</script>

<template>
    <component
        :is="containerComponent"
        :ref="
            (el: any) => {
                store.refs.container = el?.$el ?? el
            }
        "
        v-bind="containerProps"
    >
        <template v-if="drag">
            <Block v-for="(token, index) in tokens" :key="key.get(token)" :token="token" :block-index="index" />
        </template>
        <template v-else>
            <Token v-for="token in tokens" :key="key.get(token)" :mark="token" />
        </template>
    </component>
</template>
```

Note: the inline `containerStyle` computed, the separate `:class` and `:style` bindings, and the `readOnly` subscription are all removed — they are now handled inside `containerProps`.

- [ ] **Step 2: Typecheck the Vue package**

```bash
cd packages/vue/markput && npm run typecheck 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/vue/markput/src/components/Container.vue
git commit -m "feat(vue): update Container to use containerComponent/containerProps"
```

---

## Task 7: Update Vue `Block.vue`

**Files:**
- Modify: `packages/vue/markput/src/components/Block.vue`

Currently `Block.vue` hardcodes `<div>` and does not consume the `block` slot. Update it to use `blockComponent` and `blockProps` for consistency.

- [ ] **Step 1: Rewrite `Block.vue`**

Replace the entire file content:

```vue
<script setup lang="ts">
import type {CSSProperties} from '@markput/core'
import {computed} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import BlockMenu from './BlockMenu.vue'
import DragHandle from './DragHandle.vue'
import DropIndicator from './DropIndicator.vue'
import Token from './Token.vue'

import styles from '@markput/core/styles.module.css'

const props = defineProps<{token: import('@markput/core').Token; blockIndex: number}>()

const store = useStore()
const blockStore = store.blocks.get(props.token)

const blockComponent = useMarkput(s => s.computed.blockComponent)
const slotProps = useMarkput(s => s.computed.blockProps)
const isDragging = useMarkput(() => blockStore.state.isDragging)

const blockStyle = computed(() => ({
    opacity: isDragging.value ? 0.4 : 1,
    ...((slotProps.value?.style as CSSProperties | undefined) ?? {}),
}))
</script>

<template>
    <component
        :is="blockComponent"
        :ref="(el: any) => blockStore.attachContainer(el?.$el ?? el, props.blockIndex, store.event)"
        data-testid="block"
        v-bind="slotProps"
        :class="styles.Block"
        :style="blockStyle"
    >
        <DropIndicator :token="token" position="before" />
        <DragHandle :token="token" :block-index="blockIndex" />
        <Token :mark="token" />
        <DropIndicator :token="token" position="after" />
        <BlockMenu :token="token" />
    </component>
</template>
```

- [ ] **Step 2: Typecheck the Vue package**

```bash
cd packages/vue/markput && npm run typecheck 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/vue/markput/src/components/Block.vue
git commit -m "feat(vue): update Block to use blockComponent/blockProps"
```

---

## Task 8: Update slots README

**Files:**
- Modify: `packages/core/src/features/slots/README.md`

- [ ] **Step 1: Rewrite the README usage section**

Replace the entire file content:

```markdown
# Slots Feature

Resolver utilities that implement the component slot/customization system — allowing framework wrappers to override default HTML elements (`container`, `block`, `span`, `overlay`, `mark`) with custom components.

## Resolver Functions

- **resolveSlot**: Resolves a named slot to its component (defaulting to `'div'` or `'span'`)
- **resolveSlotProps**: Resolves named slot props with data-attribute conversion
- **resolveMarkSlot**: Resolves the mark component for a given token (text → Span, mark → option's Mark or global Mark)
- **resolveOverlaySlot**: Resolves the overlay component from option/global/default
- **resolveOptionSlot**: Resolves slot prop configs that can be either an object or a function `(baseProps) => props`

## Usage

Named slot computeds live on `store.computed` as separate `component` and `props` values:

```typescript
// Named slots — component and fully-resolved props are separate computeds
const Component = store.computed.containerComponent()
const props = store.computed.containerProps()
// props includes className, style (with drag paddingLeft), and data-* slotProps

const BlockComponent = store.computed.blockComponent()
const blockProps = store.computed.blockProps()  // raw slotProps only

const SpanComponent = store.computed.spanComponent()
const spanProps = store.computed.spanProps()    // raw slotProps only

// Parameterized slots — .use() returns a resolver function, call it with the argument
const resolveMarkSlot = store.computed.mark.use()
const [MarkComponent, markProps] = resolveMarkSlot(token)

const resolveOverlay = store.computed.overlay.use()
const [Overlay, overlayProps] = resolveOverlay(option, defaultComponent)
```

Consumed by framework wrappers (React/Vue) to render customizable components.
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/features/slots/README.md
git commit -m "docs(core): update slots README for new component/props computed API"
```

---

## Task 9: Final typecheck across all packages

- [ ] **Step 1: Run all typechecks**

```bash
cd packages/core && npm run typecheck && cd ../react/markput && npm run typecheck && cd ../../vue/markput && npm run typecheck
```

Expected: no errors in any package.

- [ ] **Step 2: Run core tests one final time**

```bash
cd packages/core && npm test
```

Expected: all tests pass.
