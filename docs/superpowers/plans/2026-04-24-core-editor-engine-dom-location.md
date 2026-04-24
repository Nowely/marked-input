# Core Editor Engine DOM Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move DOM/token location, raw value edits, caret recovery, and mark commands into core-owned editor-engine primitives.

**Architecture:** `@markput/core` owns token addresses, DOM registration, raw selection mapping, value mutation, and caret recovery. React and Vue become presentation adapters that render adapter-owned structural elements and register them with core through private refs. Migration is vertical: each slice lands with tests and leaves less production code depending on DOM child order, `NodeProxy`, public mark refs, or feature-local raw-position logic.

**Tech Stack:** TypeScript, Vitest core unit tests, Vitest Browser Mode storybook tests, React 19 adapter, Vue 3 adapter, existing signal system, pnpm.

---

## Scope Notes

This plan implements the full spec in migration slices. The implementation intentionally allows breaking public API changes described in the spec: `useMark().ref` removal, `MarkHandler` replacement, adapter-owned structural DOM, raw-position caret recovery, and removal of feature-facing `NodeProxy`.

Run tasks in order. Each task ends with focused verification and a commit. After Task 11, run the full local check list from `AGENTS.md`.

## File Structure

Create:

- `packages/core/src/shared/editorContracts.ts` - shared cross-feature contracts: `TokenPath`, `TokenAddress`, result aliases, DOM registration types, raw ranges, edit results, caret recovery, mark controller types.
- `packages/core/src/features/parsing/tokenIndex.ts` - token-path traversal, path keys, shape snapshots, token index construction, stale-address validation.
- `packages/core/src/features/parsing/tokenIndex.spec.ts` - unit coverage for paths, keys, generation, nested marks, stale validation.
- `packages/core/src/features/value/ControlledEcho.ts` - strict controlled-mode echo state machine.
- `packages/core/src/features/value/ControlledEcho.spec.ts` - focused echo, supersede, and recovery tests.
- `packages/core/src/features/mark/MarkController.ts` - command-oriented public mark runtime class.
- `packages/core/src/features/mark/MarkController.spec.ts` - command validation, serialization, stale-address, and read-only tests.

Modify:

- `packages/core/index.ts` - export new public controller and public/shared types that adapters and users need.
- `packages/core/src/shared/types.ts` - remove old `Recovery` shape after caret cutover.
- `packages/core/src/shared/classes/index.ts` - stop exporting `NodeProxy` after all feature references are gone.
- `packages/core/src/store/Store.ts` - remove `store.nodes` after the temporary DOM compatibility path is eliminated.
- `packages/core/src/store/README.md` - document core-engine state ownership and remove `store.nodes` references.
- `packages/core/src/features/parsing/ParseFeature.ts` - own parse generation and expose `parsing.index`.
- `packages/core/src/features/parsing/index.ts` - export `TokenIndex` helpers and types.
- `packages/core/src/features/value/ValueFeature.ts` - add `replaceRange()` / `replaceAll()`, controlled echo, recovery scheduling, compatibility wrappers.
- `packages/core/src/features/value/index.ts` - export `ControlledEcho` if tests import it directly from the package feature barrel.
- `packages/core/src/features/dom/DomFeature.ts` - become the façade for adapter refs, DOM index, location, reconciliation, diagnostics, rendered watcher, and raw selection mapping.
- `packages/core/src/features/dom/DomFeature.spec.ts` - replace reconciliation-only tests with registration, indexing, boundary, and diagnostic tests.
- `packages/core/src/features/lifecycle/LifecycleFeature.ts` - type `rendered` payload as `{container, layout}`.
- `packages/core/src/features/caret/CaretFeature.ts` - add `location`, raw-position recovery shape, `placeAt()`, and `focus()`.
- `packages/core/src/features/caret/focus.ts` / `selection.ts` / `selectionHelpers.ts` - update event handlers to use `store.dom` and `store.caret.location`.
- `packages/core/src/features/keyboard/input.ts` - migrate inline input and paste to raw ranges and value pipeline.
- `packages/core/src/features/keyboard/blockEdit.ts` - migrate block editing to `store.dom.rawPositionFromBoundary()` and `store.value.replaceRange()`.
- `packages/core/src/features/keyboard/rawPosition.ts` - remove after block edit uses `store.dom`.
- `packages/core/src/features/keyboard/index.ts` - remove raw-position exports.
- `packages/core/src/features/clipboard/ClipboardFeature.ts` - use `store.dom.readRawSelection()` and `store.value.replaceRange()`.
- `packages/core/src/features/clipboard/selectionToTokens.ts` - remove after clipboard cutover.
- `packages/core/src/features/clipboard/index.ts` - remove `selectionToTokens` exports.
- `packages/core/src/features/overlay/OverlayFeature.ts` - lower insertion to `store.value.replaceRange()`.
- `packages/core/src/features/editing/utils/deleteMark.ts` - migrate deletion to address/raw-range logic or remove once keyboard paths inline it.
- `packages/core/src/features/drag/DragFeature.ts` - call value pipeline with source metadata.
- `packages/core/src/features/mark/MarkFeature.ts` - remove mutation event handling once `MarkController` uses value pipeline.
- `packages/core/src/features/mark/index.ts` - export `MarkController`, `MarkInfo`, and compatibility alias only if required.
- `packages/react/markput/src/components/Container.tsx` - drive rendered notifications from `store.dom.structuralKey`.
- `packages/react/markput/src/components/Token.tsx` - render token shells, text surfaces, slot roots, and mark context.
- `packages/react/markput/src/components/Block.tsx` - render registered rows and controls.
- `packages/react/markput/src/components/DragHandle.tsx`, `BlockMenu.tsx`, `DropIndicator.tsx` - register controls where they can receive focus or selection.
- `packages/react/markput/src/lib/hooks/useMark.tsx` - return `MarkController`.
- `packages/react/markput/src/lib/hooks/useMarkInfo.tsx` - expose path/depth/key/debug data separately.
- `packages/react/markput/src/types.ts` - update mark/span props for command-based authoring and opaque children.
- `packages/vue/markput/src/components/Container.vue` - watch `store.dom.structuralKey` with `flush: 'post'`.
- `packages/vue/markput/src/components/Token.vue` - render token shells, text surfaces, slot roots, and mark context.
- `packages/vue/markput/src/components/Block.vue` - render registered rows and controls.
- `packages/vue/markput/src/components/DragHandle.vue`, `BlockMenu.vue`, `DropIndicator.vue` - register controls where they can receive focus or selection.
- `packages/vue/markput/src/lib/hooks/useMark.ts` - return `MarkController`.
- `packages/vue/markput/src/lib/hooks/useMarkInfo.ts` - expose path/depth/key/debug data separately.
- `packages/vue/markput/src/types.ts` - update mark/span props.
- `packages/storybook/src/pages/**` - update stories/tests that rely on `useMark().ref`, exact DOM child order, `data-testid` block mapping, or public mark mutability.
- `packages/website/src/content/docs/development/architecture.md` - document core-owned engine semantics and adapter registration.
- `packages/website/src/content/docs/development/how-it-works.md` - document render flow, raw edits, caret recovery.
- `packages/website/src/content/docs/guides/dynamic-marks.md` - replace ref mutation examples with controller commands.
- `packages/website/src/content/docs/guides/nested-marks.md` - document opaque children and missing-child diagnostics.
- `packages/website/src/content/docs/examples/mention-system.md`, `hashtags.md`, `markdown-editor.md`, `slash-commands.md` - update custom mark examples as needed.
- `AGENTS.md` and `CLAUDE.md` - update architecture rules after `store.nodes` and `NodeProxy` disappear.

---

### Task 1: Shared Contracts and TokenIndex

**Files:**

- Create: `packages/core/src/shared/editorContracts.ts`
- Create: `packages/core/src/features/parsing/tokenIndex.ts`
- Create: `packages/core/src/features/parsing/tokenIndex.spec.ts`
- Modify: `packages/core/src/features/parsing/ParseFeature.ts`
- Modify: `packages/core/src/features/parsing/index.ts`
- Modify: `packages/core/index.ts`

- [ ] **Step 1: Write failing TokenIndex tests**

Add `packages/core/src/features/parsing/tokenIndex.spec.ts`:

```ts
import {describe, it, expect} from 'vitest'

import type {MarkToken, TextToken, Token} from './parser/types'
import {createTokenIndex, pathEquals, pathKey, resolvePath, snapshotTokenShape} from './tokenIndex'

function text(content: string, start: number): TextToken {
    return {type: 'text', content, position: {start, end: start + content.length}}
}

function mark(value: string, start: number, children: Token[] = []): MarkToken {
    return {
        type: 'mark',
        content: `@[${value}]`,
        position: {start, end: start + value.length + 3},
        descriptor: {
            markup: '@[__value__]',
            index: 0,
            segments: ['@[', ']'],
            gapTypes: ['value'],
            hasSlot: false,
            hasTwoValues: false,
            segmentGlobalIndices: [0, 1],
        },
        value,
        children,
    }
}

describe('TokenIndex', () => {
    it('builds paths for top-level and nested tokens', () => {
        const inner = mark('inner', 9, [text('leaf', 12)])
        const tokens = [text('hello ', 0), mark('outer', 6, [inner]), text('!', 20)]
        const index = createTokenIndex(tokens, 4)

        expect(index.pathFor(tokens[0])).toEqual([0])
        expect(index.pathFor(inner)).toEqual([1, 0])
        expect(index.pathFor(inner.children[0])).toEqual([1, 0, 0])
        expect(index.addressFor([1, 0])).toEqual({path: [1, 0], parseGeneration: 4})
        expect(index.key([1, 0, 0])).toBe('1.0.0')
    })

    it('resolves paths and rejects invalid paths', () => {
        const tokens = [text('a', 0), mark('b', 1)]
        const index = createTokenIndex(tokens, 2)

        expect(resolvePath(tokens, [1])).toBe(tokens[1])
        expect(resolvePath(tokens, [])).toBeUndefined()
        expect(resolvePath(tokens, [2])).toBeUndefined()
        expect(index.resolve([1, 0])).toBeUndefined()
    })

    it('compares paths by value', () => {
        expect(pathEquals([0, 1], [0, 1])).toBe(true)
        expect(pathEquals([0, 1], [1, 0])).toBe(false)
        expect(pathKey([2, 0, 3])).toBe('2.0.3')
    })

    it('rejects stale addresses before resolving same-path tokens', () => {
        const first = mark('first', 0)
        const firstIndex = createTokenIndex([first], 1)
        const staleAddress = firstIndex.addressFor([0])!

        const second = mark('second', 0)
        const secondIndex = createTokenIndex([second], 2)
        const result = secondIndex.resolveAddress(staleAddress, snapshotTokenShape(first))

        expect(result).toEqual({ok: false, reason: 'stale'})
    })

    it('rejects same-generation shape mismatches', () => {
        const oldToken = mark('first', 0)
        const currentToken = text('first', 0)
        const index = createTokenIndex([currentToken], 5)

        const result = index.resolveAddress({path: [0], parseGeneration: 5}, snapshotTokenShape(oldToken))

        expect(result).toEqual({ok: false, reason: 'stale'})
    })
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm -w vitest run packages/core/src/features/parsing/tokenIndex.spec.ts
```

Expected: fail because `tokenIndex.ts` and shared contracts do not exist.

- [ ] **Step 3: Add shared editor contracts**

Create `packages/core/src/shared/editorContracts.ts`:

```ts
import type {MarkupDescriptor} from '../features/parsing/parser/core/MarkupDescriptor'
import type {Store} from '../store/Store'

export type TokenPath = readonly number[]

export type TokenAddress = {
    readonly path: TokenPath
    readonly parseGeneration: number
}

export type Result<T, Reason extends string> = {ok: true; value: T} | {ok: false; reason: Reason}

export type DomRole = 'container' | 'control' | 'row' | 'token' | 'text' | 'slotRoot'

export type DomRefTarget =
    | {readonly role: 'container'}
    | {readonly role: 'control'; readonly ownerPath?: TokenPath}
    | {readonly role: 'row' | 'token' | 'text' | 'slotRoot'; readonly path: TokenPath}

export type DomRef = (element: HTMLElement | null) => void

export type RawRange = {
    readonly start: number
    readonly end: number
}

export type RawSelection = {
    readonly range: RawRange
    readonly direction?: 'forward' | 'backward'
}

export type NodeLocationResult = Result<
    {
        readonly address: TokenAddress
        readonly tokenElement: HTMLElement
        readonly textElement?: HTMLElement
        readonly rowElement?: HTMLElement
    },
    'notIndexed' | 'outsideEditor' | 'control'
>

export type RawSelectionResult = Result<
    RawSelection,
    'notIndexed' | 'outsideEditor' | 'control' | 'mixedBoundary' | 'invalidBoundary'
>

export type BoundaryPositionResult = Result<
    number,
    'notIndexed' | 'outsideEditor' | 'control' | 'invalidBoundary' | 'composing'
>

export type EditResult =
    | {ok: true; value: string; accepted: 'immediate' | 'pendingControlledEcho'}
    | {ok: false; reason: 'readOnly' | 'invalidRange' | 'stale'}

export type CaretRecovery =
    | {readonly kind: 'caret'; readonly rawPosition: number; readonly affinity?: 'before' | 'after'}
    | {readonly kind: 'selection'; readonly selection: RawSelection}

export type OptionalMarkFieldPatch = {readonly kind: 'set'; readonly value: string} | {readonly kind: 'clear'}

export type MarkPatch = {
    readonly value?: string
    readonly meta?: OptionalMarkFieldPatch
    readonly slot?: OptionalMarkFieldPatch
}

export type MarkSnapshot = {
    readonly value: string
    readonly meta: string | undefined
    readonly slot: string | undefined
    readonly readOnly: boolean
}

export type MarkInfo = {
    readonly address: TokenAddress
    readonly depth: number
    readonly hasNestedMarks: boolean
    readonly key: string
}

export type TokenShapeSnapshot =
    | {readonly kind: 'text'}
    | {
          readonly kind: 'mark'
          readonly descriptor: MarkupDescriptor
          readonly descriptorIndex: number
      }

export type DomIndex = {
    readonly generation: number
}

export type CaretLocation = {
    readonly address: TokenAddress
    readonly role: 'row' | 'token' | 'text' | 'slotRoot' | 'markDescendant'
}

export type DomDiagnostic = {
    readonly kind:
        | 'missingRole'
        | 'stalePath'
        | 'outsideEditor'
        | 'controlBoundary'
        | 'mixedBoundary'
        | 'invalidBoundary'
        | 'renderReentry'
    readonly path?: TokenPath
    readonly reason: string
}

export type EditSource = 'input' | 'paste' | 'cut' | 'overlay' | 'mark' | 'block' | 'drag'

export type MarkControllerConstructor = new (store: Store, address: TokenAddress, snapshot: MarkSnapshot) => unknown
```

- [ ] **Step 4: Add TokenIndex implementation**

Create `packages/core/src/features/parsing/tokenIndex.ts`:

```ts
import type {Result, TokenAddress, TokenPath, TokenShapeSnapshot} from '../../shared/editorContracts'
import type {Token} from './parser/types'

export type TokenIndex = {
    readonly generation: number
    pathFor(token: Token): TokenPath | undefined
    addressFor(path: TokenPath): TokenAddress | undefined
    resolve(path: TokenPath): Token | undefined
    resolveAddress(address: TokenAddress, expected?: TokenShapeSnapshot): Result<Token, 'stale'>
    key(path: TokenPath): string
    equals(a: TokenPath, b: TokenPath): boolean
}

export function pathEquals(a: TokenPath, b: TokenPath): boolean {
    return a.length === b.length && a.every((part, index) => part === b[index])
}

export function pathKey(path: TokenPath): string {
    return path.join('.')
}

export function resolvePath(tokens: readonly Token[], path: TokenPath): Token | undefined {
    if (path.length === 0) return undefined
    let current: readonly Token[] = tokens
    let token: Token | undefined
    for (const index of path) {
        if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined
        token = current[index]
        current = token.type === 'mark' ? token.children : []
    }
    return token
}

export function snapshotTokenShape(token: Token): TokenShapeSnapshot {
    if (token.type === 'text') return {kind: 'text'}
    return {kind: 'mark', descriptor: token.descriptor, descriptorIndex: token.descriptor.index}
}

function shapeMatches(token: Token, expected: TokenShapeSnapshot): boolean {
    if (expected.kind === 'text') return token.type === 'text'
    return (
        token.type === 'mark' &&
        token.descriptor === expected.descriptor &&
        token.descriptor.index === expected.descriptorIndex
    )
}

export function createTokenIndex(tokens: readonly Token[], generation: number): TokenIndex {
    const paths = new WeakMap<Token, TokenPath>()

    const visit = (items: readonly Token[], parent: TokenPath) => {
        items.forEach((token, index) => {
            const path = [...parent, index] as const
            paths.set(token, path)
            if (token.type === 'mark') visit(token.children, path)
        })
    }

    visit(tokens, [])

    return {
        generation,
        pathFor: token => paths.get(token),
        addressFor: path => (resolvePath(tokens, path) ? {path: [...path], parseGeneration: generation} : undefined),
        resolve: path => resolvePath(tokens, path),
        resolveAddress(address, expected) {
            if (address.parseGeneration !== generation) return {ok: false, reason: 'stale'}
            const token = resolvePath(tokens, address.path)
            if (!token) return {ok: false, reason: 'stale'}
            if (expected && !shapeMatches(token, expected)) return {ok: false, reason: 'stale'}
            return {ok: true, value: token}
        },
        key: pathKey,
        equals: pathEquals,
    }
}
```

- [ ] **Step 5: Wire parse generation into ParsingFeature**

Modify `packages/core/src/features/parsing/ParseFeature.ts` so every accepted token replacement goes through one method:

```ts
import {signal, computed, event, effectScope, watch, batch} from '../../shared/signals/index.js'
import {createTokenIndex} from './tokenIndex'

export class ParsingFeature implements Feature {
    readonly tokens = signal<Token[]>([], {readonly: true})
    readonly #generation = signal(0)

    readonly index: Computed<TokenIndex> = computed(() => createTokenIndex(this.tokens(), this.#generation()))

    acceptTokens(tokens: Token[]): void {
        batch(
            () => {
                this.tokens(tokens)
                this.#generation(this.#generation() + 1)
            },
            {mutable: true}
        )
    }

    sync(value = this._store.value.current()) {
        this.acceptTokens(this.parseValue(value))
    }
}
```

Replace direct production writes to `store.parsing.tokens(next)` with `store.parsing.acceptTokens(next)`. In this task, update only production code that is touched by `ParsingFeature` and `ValueFeature`; later tasks remove the remaining token-mutation paths.

- [ ] **Step 6: Export contracts**

Modify `packages/core/src/features/parsing/index.ts`:

```ts
export {createTokenIndex, pathEquals, pathKey, resolvePath, snapshotTokenShape, type TokenIndex} from './tokenIndex'
```

Modify `packages/core/index.ts`:

```ts
export type {
    TokenPath,
    TokenAddress,
    Result,
    RawRange,
    RawSelection,
    EditResult,
    CaretRecovery,
    MarkPatch,
    MarkSnapshot,
    MarkInfo,
} from './src/shared/editorContracts'
```

- [ ] **Step 7: Run focused parsing checks**

Run:

```bash
pnpm -w vitest run packages/core/src/features/parsing/tokenIndex.spec.ts packages/core/src/features/parsing/ParseFeature.spec.ts
```

Expected: pass after updating tests that wrote `store.parsing.tokens(...)` directly to use `store.parsing.acceptTokens(...)`.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/shared/editorContracts.ts packages/core/src/features/parsing/tokenIndex.ts packages/core/src/features/parsing/tokenIndex.spec.ts packages/core/src/features/parsing/ParseFeature.ts packages/core/src/features/parsing/index.ts packages/core/index.ts
git commit -m "feat(core): add token addresses and token index"
```

---

### Task 2: Value Pipeline Foundation

**Files:**

- Create: `packages/core/src/features/value/ControlledEcho.ts`
- Create: `packages/core/src/features/value/ControlledEcho.spec.ts`
- Modify: `packages/core/src/features/value/ValueFeature.ts`
- Modify: `packages/core/src/features/value/ValueFeature.spec.ts`
- Modify: `packages/core/src/features/value/index.ts`

- [ ] **Step 1: Write failing ControlledEcho tests**

Create `packages/core/src/features/value/ControlledEcho.spec.ts`:

```ts
import {describe, it, expect} from 'vitest'

import type {CaretRecovery} from '../../shared/editorContracts'
import {ControlledEcho} from './ControlledEcho'

describe('ControlledEcho', () => {
    it('returns recovery only for a matching echo', () => {
        const recovery: CaretRecovery = {kind: 'caret', rawPosition: 4}
        const echo = new ControlledEcho()

        echo.propose('next', recovery)

        expect(echo.onEcho('other')).toBeUndefined()
        expect(echo.onEcho('next')).toBe(recovery)
        expect(echo.onEcho('next')).toBeUndefined()
    })

    it('supersedes older pending recovery', () => {
        const first: CaretRecovery = {kind: 'caret', rawPosition: 1}
        const second: CaretRecovery = {kind: 'caret', rawPosition: 2}
        const echo = new ControlledEcho()

        echo.propose('first', first)
        echo.propose('second', second)

        expect(echo.onEcho('first')).toBeUndefined()
        expect(echo.onEcho('second')).toBe(second)
    })

    it('clears pending recovery on supersede', () => {
        const recovery: CaretRecovery = {kind: 'caret', rawPosition: 1}
        const echo = new ControlledEcho()

        echo.propose('next', recovery)
        echo.supersede()

        expect(echo.onEcho('next')).toBeUndefined()
    })
})
```

- [ ] **Step 2: Write failing ValueFeature pipeline tests**

Append to `packages/core/src/features/value/ValueFeature.spec.ts`:

```ts
describe('replaceRange()', () => {
    it('commits uncontrolled range replacement and schedules recovery', () => {
        const store = new Store()
        const recovery = {kind: 'caret' as const, rawPosition: 5}
        store.props.set({defaultValue: 'hello world'})
        store.value.enable()

        const result = store.value.replaceRange({start: 6, end: 11}, 'markput', {recover: recovery, source: 'input'})

        expect(result).toEqual({ok: true, accepted: 'immediate', value: 'hello markput'})
        expect(store.value.current()).toBe('hello markput')
        expect(store.caret.recovery()).toBe(recovery)
        store.value.disable()
    })

    it('rejects invalid ranges without emitting change', () => {
        const store = new Store()
        const onChange = vi.fn()
        store.props.set({defaultValue: 'hello', onChange})
        store.value.enable()

        const result = store.value.replaceRange({start: 4, end: 2}, 'x')

        expect(result).toEqual({ok: false, reason: 'invalidRange'})
        expect(onChange).not.toHaveBeenCalled()
        expect(store.value.current()).toBe('hello')
        store.value.disable()
    })

    it('rejects read-only range replacement', () => {
        const store = new Store()
        const onChange = vi.fn()
        store.props.set({defaultValue: 'hello', readOnly: true, onChange})
        store.value.enable()

        const result = store.value.replaceRange({start: 0, end: 5}, 'world')

        expect(result).toEqual({ok: false, reason: 'readOnly'})
        expect(onChange).not.toHaveBeenCalled()
        expect(store.value.current()).toBe('hello')
        store.value.disable()
    })

    it('keeps controlled accepted value until matching echo', () => {
        const store = new Store()
        const onChange = vi.fn()
        const recovery = {kind: 'caret' as const, rawPosition: 5}
        store.props.set({value: 'hello', onChange})
        store.value.enable()

        const result = store.value.replaceRange({start: 0, end: 5}, 'world', {recover: recovery})

        expect(result).toEqual({ok: true, accepted: 'pendingControlledEcho', value: 'world'})
        expect(onChange).toHaveBeenCalledWith('world')
        expect(store.value.current()).toBe('hello')
        expect(store.caret.recovery()).toBeUndefined()

        store.props.set({value: 'world'})

        expect(store.value.current()).toBe('world')
        expect(store.caret.recovery()).toBe(recovery)
        store.value.disable()
    })
})
```

- [ ] **Step 3: Run failing value tests**

Run:

```bash
pnpm -w vitest run packages/core/src/features/value/ControlledEcho.spec.ts packages/core/src/features/value/ValueFeature.spec.ts
```

Expected: fail because `ControlledEcho` and `replaceRange()` do not exist.

- [ ] **Step 4: Implement ControlledEcho**

Create `packages/core/src/features/value/ControlledEcho.ts`:

```ts
import type {CaretRecovery} from '../../shared/editorContracts'

type Pending = {
    readonly candidate: string
    readonly recovery: CaretRecovery | undefined
}

export class ControlledEcho {
    #pending: Pending | undefined

    propose(candidate: string, recovery?: CaretRecovery): void {
        this.#pending = {candidate, recovery}
    }

    onEcho(value: string): CaretRecovery | undefined {
        const pending = this.#pending
        if (!pending || pending.candidate !== value) return undefined
        this.#pending = undefined
        return pending.recovery
    }

    supersede(): void {
        this.#pending = undefined
    }
}
```

- [ ] **Step 5: Implement value command pipeline**

Modify `packages/core/src/features/value/ValueFeature.ts`:

```ts
import type {CaretRecovery, EditResult, EditSource, RawRange} from '../../shared/editorContracts'
import {ControlledEcho} from './ControlledEcho'

export class ValueFeature implements Feature {
    readonly current = signal('')
    readonly isControlledMode = computed(() => this._store.props.value() !== undefined)
    readonly next = event<string>()
    readonly change = event()

    readonly #controlledEcho = new ControlledEcho()

    replaceRange(
        range: RawRange,
        replacement: string,
        options?: {recover?: CaretRecovery; source?: EditSource}
    ): EditResult {
        const current = this.current()
        if (this._store.props.readOnly()) return {ok: false, reason: 'readOnly'}
        if (range.start < 0 || range.end < range.start || range.end > current.length) {
            return {ok: false, reason: 'invalidRange'}
        }

        const candidate = current.slice(0, range.start) + replacement + current.slice(range.end)
        return this.#commitCandidate(candidate, options?.recover)
    }

    replaceAll(next: string, options?: {recover?: CaretRecovery; source?: EditSource}): EditResult {
        return this.replaceRange({start: 0, end: this.current().length}, next, options)
    }

    #commitCandidate(candidate: string, recovery?: CaretRecovery): EditResult {
        this._store.props.onChange()?.(candidate)
        if (this.isControlledMode()) {
            this.#controlledEcho.propose(candidate, recovery)
            return {ok: true, accepted: 'pendingControlledEcho', value: candidate}
        }

        this.#commitAccepted(candidate)
        this._store.caret.recovery(recovery)
        return {ok: true, accepted: 'immediate', value: candidate}
    }
}
```

Update the controlled `props.value` watcher:

```ts
watch(this._store.props.value, value => {
    if (value === undefined) return
    if (value === this.current()) return
    const recovery = this.#controlledEcho.onEcho(value)
    this.#commitAccepted(value)
    if (recovery) this._store.caret.recovery(recovery)
})
```

Keep compatibility wrappers during migration:

```ts
watch(this.next, value => {
    this.replaceAll(value)
})

watch(this.change, () => {
    if (this._store.props.readOnly()) {
        this.#restoreCurrent()
        return
    }
    const serialized = toString(this._store.parsing.tokens())
    const result = this.replaceAll(serialized)
    if (!result.ok || result.accepted === 'pendingControlledEcho') this.#restoreCurrent()
})
```

- [ ] **Step 6: Export ControlledEcho for focused tests**

Modify `packages/core/src/features/value/index.ts`:

```ts
export {ValueFeature} from './ValueFeature'
export {ControlledEcho} from './ControlledEcho'
```

- [ ] **Step 7: Run value checks**

Run:

```bash
pnpm -w vitest run packages/core/src/features/value/ControlledEcho.spec.ts packages/core/src/features/value/ValueFeature.spec.ts packages/core/src/store/Store.spec.ts
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/features/value/ControlledEcho.ts packages/core/src/features/value/ControlledEcho.spec.ts packages/core/src/features/value/ValueFeature.ts packages/core/src/features/value/ValueFeature.spec.ts packages/core/src/features/value/index.ts packages/core/src/store/Store.spec.ts
git commit -m "feat(core): add raw value edit pipeline"
```

---

### Task 3: DOM Registration Foundation

**Files:**

- Modify: `packages/core/src/features/dom/DomFeature.ts`
- Modify: `packages/core/src/features/dom/DomFeature.spec.ts`
- Modify: `packages/core/src/features/lifecycle/LifecycleFeature.ts`
- Modify: `packages/core/src/features/lifecycle/LifecycleFeature.spec.ts`

- [ ] **Step 1: Write failing DOM registration tests**

Replace `packages/core/src/features/dom/DomFeature.spec.ts` with tests shaped around the new façade:

```ts
import {describe, it, expect, beforeEach, vi} from 'vitest'

import {Store} from '../../store/Store'

describe('DomFeature registration', () => {
    let store: Store

    beforeEach(() => {
        vi.clearAllMocks()
        store = new Store()
        store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
        store.value.enable()
        store.value.replaceAll('hello @[world]')
    })

    it('returns stable ref callbacks for the same target', () => {
        const first = store.dom.refFor({role: 'text', path: [0]})
        const second = store.dom.refFor({role: 'text', path: [0]})
        const third = store.dom.refFor({role: 'text', path: [2]})

        expect(first).toBe(second)
        expect(first).not.toBe(third)
    })

    it('publishes one dom index per rendered commit', () => {
        const container = document.createElement('div')
        const textShell = document.createElement('span')
        const textSurface = document.createElement('span')
        container.append(textShell)
        textShell.append(textSurface)

        store.dom.refFor({role: 'container'})(container)
        store.dom.refFor({role: 'token', path: [0]})(textShell)
        store.dom.refFor({role: 'text', path: [0]})(textSurface)

        store.dom.enable()
        store.lifecycle.rendered({container, layout: 'inline'})

        expect(store.dom.index()).toEqual({generation: 1})
        expect(store.dom.locateNode(textSurface)).toMatchObject({ok: true})
    })

    it('resolves ref paths through the current parse generation during rendered commit', () => {
        const container = document.createElement('div')
        const shell = document.createElement('span')
        container.append(shell)
        store.dom.refFor({role: 'container'})(container)
        store.dom.refFor({role: 'token', path: [0]})(shell)
        store.dom.enable()

        const oldGeneration = store.parsing.index().generation
        store.value.replaceAll('changed')
        store.lifecycle.rendered({container, layout: 'inline'})

        const result = store.dom.locateNode(shell)
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.value.address.parseGeneration).not.toBe(oldGeneration)
    })

    it('returns control for registered controls', () => {
        const container = document.createElement('div')
        const control = document.createElement('button')
        container.append(control)
        store.dom.refFor({role: 'container'})(container)
        store.dom.refFor({role: 'control', ownerPath: [1]})(control)
        store.dom.enable()
        store.lifecycle.rendered({container, layout: 'block'})

        expect(store.dom.locateNode(control)).toEqual({ok: false, reason: 'control'})
    })
})
```

- [ ] **Step 2: Type lifecycle rendered payload**

Modify `packages/core/src/features/lifecycle/LifecycleFeature.ts`:

```ts
export type RenderedPayload = {
    readonly container: HTMLElement
    readonly layout: 'inline' | 'block'
}

export class LifecycleFeature implements Feature {
    readonly mounted = event()
    readonly unmounted = event()
    readonly rendered = event<RenderedPayload>()
}
```

Update `packages/core/src/features/lifecycle/LifecycleFeature.spec.ts` to call:

```ts
store.lifecycle.rendered({container: document.createElement('div'), layout: 'inline'})
```

- [ ] **Step 3: Implement DomFeature registration/index façade**

Replace `DomFeature` internals with this shape:

```ts
type RegisteredRole =
    | {readonly role: 'container'; readonly element: HTMLElement}
    | {readonly role: 'control'; readonly element: HTMLElement; readonly ownerPath?: TokenPath}
    | {
          readonly role: 'row' | 'token' | 'text' | 'slotRoot'
          readonly element: HTMLElement
          readonly path: TokenPath
          readonly address: TokenAddress
      }

type PathElements = {
    rowElement?: HTMLElement
    tokenElement?: HTMLElement
    textElement?: HTMLElement
    slotRootElement?: HTMLElement
}

export class DomFeature {
    readonly #domIndex = signal<DomIndex | undefined>(undefined, {readonly: true})
    readonly index: Computed<DomIndex | undefined> = computed(() => this.#domIndex())
    readonly diagnostics = event<DomDiagnostic>()
    readonly structuralKey = computed(() => {
        this._store.parsing.index()
        this._store.props.layout()
        this._store.props.readOnly()
        this._store.props.Mark()
        this._store.props.Span()
        this._store.props.slots()
        this._store.props.slotProps()
        this._store.props.draggable()
        return {}
    })

    readonly #refCallbacks = new Map<string, DomRef>()
    readonly #pendingElements = new Map<string, {target: DomRefTarget; element: HTMLElement | null}>()
    readonly #elementRoles = new WeakMap<HTMLElement, RegisteredRole>()
    readonly #pathElements = new Map<string, PathElements>()
    #container: HTMLElement | undefined
    #generation = 0
    #rendering = false
    #queuedRender: RenderedPayload | undefined
}
```

Implement stable refs:

```ts
refFor(target: DomRefTarget): DomRef {
	const key = this.#targetKey(target)
	const existing = this.#refCallbacks.get(key)
	if (existing) return existing

	const callback: DomRef = element => {
		this.#pendingElements.set(key, {target, element})
	}
	this.#refCallbacks.set(key, callback)
	return callback
}

#targetKey(target: DomRefTarget): string {
	if (target.role === 'container') return 'container'
	if (target.role === 'control') return `control:${target.ownerPath ? pathKey(target.ownerPath) : 'global'}`
	return `${target.role}:${pathKey(target.path)}`
}
```

Implement rendered watcher in `enable()`:

```ts
enable() {
	if (this.#scope) return
	this.#scope = effectScope(() => {
		watch(this._store.lifecycle.rendered, payload => {
			const rendered = payload.read()
			if (rendered) this.#handleRendered(rendered)
		})
	})
}
```

Implement non-reentrant commit:

```ts
#handleRendered(payload: RenderedPayload): void {
	if (this.#rendering) {
		this.#queuedRender = payload
		this.diagnostics({kind: 'renderReentry', reason: 'rendered event queued during DOM indexing'})
		return
	}

	this.#rendering = true
	try {
		this.#commitRendered(payload)
	} finally {
		this.#rendering = false
		const queued = this.#queuedRender
		this.#queuedRender = undefined
		if (queued) this.#handleRendered(queued)
	}
}
```

In `#commitRendered`, consume pending refs, resolve path refs through `store.parsing.index()`, rebuild weak maps, reconcile text/editable state, and publish one `DomIndex`:

```ts
#commitRendered(payload: RenderedPayload): void {
	const tokenIndex = this._store.parsing.index()
	const pathElements = new Map<string, PathElements>()
	const elementRoles = new WeakMap<HTMLElement, RegisteredRole>()

	for (const {target, element} of this.#pendingElements.values()) {
		if (!element) continue
		if (target.role === 'container') {
			this.#container = element
			elementRoles.set(element, {role: 'container', element})
			continue
		}
		if (target.role === 'control') {
			elementRoles.set(element, {role: 'control', element, ownerPath: target.ownerPath})
			continue
		}

		const address = tokenIndex.addressFor(target.path)
		if (!address) {
			this.diagnostics({kind: 'stalePath', path: target.path, reason: 'registered path no longer resolves'})
			continue
		}

		const key = tokenIndex.key(target.path)
		const record = pathElements.get(key) ?? {}
		if (target.role === 'row') record.rowElement = element
		if (target.role === 'token') record.tokenElement = element
		if (target.role === 'text') record.textElement = element
		if (target.role === 'slotRoot') record.slotRootElement = element
		pathElements.set(key, record)
		elementRoles.set(element, {...target, element, address})
	}

	this.#pathElements = pathElements
	this.#elementRoles = elementRoles
	this.#reconcileRegisteredTextSurfaces()

	batch(
		() => this.#domIndex({generation: ++this.#generation}),
		{mutable: true}
	)
}
```

Implement `locateNode()` by walking ancestors until a registered role is found:

```ts
locateNode(node: Node): NodeLocationResult {
	if (!this.index()) return {ok: false, reason: 'notIndexed'}
	const container = this.#container
	if (!container || !container.contains(node)) return {ok: false, reason: 'outsideEditor'}

	let current: Node | null = node
	while (current) {
		if (current instanceof HTMLElement) {
			const role = this.#elementRoles.get(current)
			if (role?.role === 'control') return {ok: false, reason: 'control'}
			if (role && role.role !== 'container') {
				const elements = this.#pathElements.get(pathKey(role.path))
				if (!elements?.tokenElement) return {ok: false, reason: 'notIndexed'}
				return {
					ok: true,
					value: {
						address: role.address,
						tokenElement: elements.tokenElement,
						textElement: elements.textElement,
						rowElement: elements.rowElement,
					},
				}
			}
		}
		if (current === container) break
		current = current.parentNode
	}

	return {ok: false, reason: 'outsideEditor'}
}
```

- [ ] **Step 4: Run DOM foundation tests**

Run:

```bash
pnpm -w vitest run packages/core/src/features/dom/DomFeature.spec.ts packages/core/src/features/lifecycle/LifecycleFeature.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/dom/DomFeature.ts packages/core/src/features/dom/DomFeature.spec.ts packages/core/src/features/lifecycle/LifecycleFeature.ts packages/core/src/features/lifecycle/LifecycleFeature.spec.ts
git commit -m "feat(core): add DOM registration foundation"
```

---

### Task 4: React and Vue Structural Registration

**Files:**

- Modify: `packages/react/markput/src/components/Container.tsx`
- Modify: `packages/react/markput/src/components/Token.tsx`
- Modify: `packages/react/markput/src/components/Block.tsx`
- Modify: `packages/react/markput/src/components/DragHandle.tsx`
- Modify: `packages/react/markput/src/components/BlockMenu.tsx`
- Modify: `packages/react/markput/src/components/DropIndicator.tsx`
- Modify: `packages/vue/markput/src/components/Container.vue`
- Modify: `packages/vue/markput/src/components/Token.vue`
- Modify: `packages/vue/markput/src/components/Block.vue`
- Modify: `packages/vue/markput/src/components/DragHandle.vue`
- Modify: `packages/vue/markput/src/components/BlockMenu.vue`
- Modify: `packages/vue/markput/src/components/DropIndicator.vue`
- Modify: `packages/storybook/src/pages/Selection/Selection.react.spec.tsx`
- Modify: `packages/storybook/src/pages/Selection/Selection.vue.spec.ts`

- [ ] **Step 1: Write failing adapter registration tests**

Add browser assertions that use behavior rather than production mapping attributes. In both React and Vue selection specs, add tests with this shape:

```ts
it('keeps an adapter-owned text surface when a custom Span is configured', async () => {
	const Span = ({children}: {children?: unknown}) => <strong>{children}</strong>
	await render(<MarkedInput defaultValue="hello" Span={Span} />)

	const root = page.getByRole('textbox')
	const editable = root.element().querySelector('[contenteditable="true"]')

	expect(editable).not.toBeNull()
	expect(editable?.textContent).toBe('hello')
})
```

For Vue, use `h('strong', {}, slots.default?.())` for the `Span`.

- [ ] **Step 2: Update React container rendered notification**

Modify `packages/react/markput/src/components/Container.tsx`:

```tsx
const {isBlock, tokens, key, structuralKey, Component, props, layout} = useMarkput(s => ({
    isBlock: s.slots.isBlock,
    tokens: s.parsing.tokens,
    key: s.key,
    structuralKey: s.dom.structuralKey,
    Component: s.slots.containerComponent,
    props: s.slots.containerProps,
    layout: s.props.layout,
}))

useLayoutEffect(() => {
    const container = store.slots.container()
    if (container) store.lifecycle.rendered({container, layout})
}, [store, structuralKey, layout])

return (
    <Component ref={store.dom.refFor({role: 'container'})} {...props}>
        {isBlock
            ? tokens.map(token => <Block key={key.get(token)} token={token} />)
            : tokens.map(token => <Token key={key.get(token)} token={token} />)}
    </Component>
)
```

Keep `store.slots.container` populated by composing refs:

```ts
const setContainerRef = (element: HTMLElement | null) => {
    store.slots.container(element)
    store.dom.refFor({role: 'container'})(element)
}
```

Use `setContainerRef` in the rendered JSX.

- [ ] **Step 3: Update React Token structural rendering**

Modify `packages/react/markput/src/components/Token.tsx`:

```tsx
export const Token = memo(({token}: {token: TokenType}) => {
    const {resolveMarkSlot, index, dom, readOnly} = useMarkput(s => ({
        resolveMarkSlot: s.mark.slot,
        index: s.parsing.index,
        dom: s.dom,
        readOnly: s.props.readOnly,
    }))

    const path = index.pathFor(token)
    if (!path) return null

    if (token.type === 'text') {
        const [Span, props] = resolveMarkSlot(token)
        const textSurface = (
            <span ref={dom.refFor({role: 'text', path})} contentEditable={!readOnly} suppressContentEditableWarning>
                {token.content}
            </span>
        )

        return (
            <span ref={dom.refFor({role: 'token', path})}>
                <Span {...props}>{textSurface}</Span>
            </span>
        )
    }

    const [Component, props] = resolveMarkSlot(token)
    const children =
        token.children.length > 0 ? (
            <span ref={dom.refFor({role: 'slotRoot', path})}>
                {token.children.map(child => (
                    <Token key={index.key(index.pathFor(child) ?? [])} token={child} />
                ))}
            </span>
        ) : undefined

    return (
        <TokenContext value={{token, address: index.addressFor(path)!}}>
            <span ref={dom.refFor({role: 'token', path})}>
                <Component children={children} {...props} />
            </span>
        </TokenContext>
    )
})
```

Update the token context type to carry both token and address so `useMark()` can create controllers in Task 9.

- [ ] **Step 4: Update React block rows and controls**

Modify `packages/react/markput/src/components/Block.tsx` so the row is separate from token shell:

```tsx
const path = useMarkput(s => s.parsing.index).pathFor(token)
if (!path) return null

const setBlockRef = (el: HTMLElement | null) => {
	blockStore.attachContainer(el, blockIndex, {action})
	store.dom.refFor({role: 'row', path})(el)
}

return (
	<Component ref={setBlockRef} {...slotProps} className={...} style={...}>
		<DropIndicator token={token} position="before" />
		<DragHandle token={token} blockIndex={blockIndex} />
		<Token token={token} />
		<DropIndicator token={token} position="after" />
		<BlockMenu token={token} />
	</Component>
)
```

In `DragHandle`, `BlockMenu`, and `DropIndicator`, register focusable/control roots:

```tsx
const path = store.parsing.index().pathFor(token)
const controlRef = path ? store.dom.refFor({role: 'control', ownerPath: path}) : undefined
```

- [ ] **Step 5: Update Vue container notification**

Modify `packages/vue/markput/src/components/Container.vue`:

```ts
const structuralKey = useMarkput(s => s.dom.structuralKey)
const layout = useMarkput(s => s.props.layout)

const setContainerRef = (el: unknown) => {
    const resolved = el as {$el?: HTMLElement} | HTMLElement | null
    const element = (resolved && '$el' in resolved ? resolved.$el : resolved) as HTMLDivElement | null
    store.slots.container(element)
    store.dom.refFor({role: 'container'})(element)
}

watch(
    () => structuralKey.value,
    () => {
        const container = store.slots.container()
        if (container) store.lifecycle.rendered({container, layout: layout.value})
    },
    {flush: 'post', immediate: true}
)
```

- [ ] **Step 6: Update Vue Token and Block structure**

Modify `packages/vue/markput/src/components/Token.vue` to mirror React: `token` shell for every token, `text` surface for text tokens, `slotRoot` around nested mark children, and token context with `{token, address}`.

Use this rendering shape:

```ts
if (mark.type === 'text') {
    const path = index.pathFor(mark)
    return h('span', {ref: dom.refFor({role: 'token', path})}, [
        h(Comp, compProps, () =>
            h(
                'span',
                {
                    ref: dom.refFor({role: 'text', path}),
                    contenteditable: String(!readOnly.value),
                },
                mark.content
            )
        ),
    ])
}
```

Modify `packages/vue/markput/src/components/Block.vue` to register `row` refs while preserving `BlockStore.attachContainer`.

- [ ] **Step 7: Run adapter checks**

Run:

```bash
pnpm -w vitest run packages/storybook/src/pages/Selection/Selection.react.spec.tsx packages/storybook/src/pages/Selection/Selection.vue.spec.ts
pnpm -w vitest run packages/core/src/features/dom/DomFeature.spec.ts
```

Expected: pass after updating snapshots that assert exact DOM shape.

- [ ] **Step 8: Commit**

```bash
git add packages/react/markput/src packages/vue/markput/src packages/storybook/src/pages/Selection packages/core/src/features/dom/DomFeature.spec.ts
git commit -m "feat(core): register adapter-owned DOM structure"
```

---

### Task 5: Caret Location and NodeProxy Cutover

**Files:**

- Modify: `packages/core/src/features/caret/CaretFeature.ts`
- Modify: `packages/core/src/features/caret/focus.ts`
- Modify: `packages/core/src/features/caret/selection.ts`
- Modify: `packages/core/src/features/caret/focus.spec.ts`
- Modify: `packages/core/src/features/caret/CaretFeature.spec.ts`
- Modify: `packages/core/src/store/Store.ts`
- Modify: `packages/core/src/shared/classes/index.ts`
- Delete: `packages/core/src/shared/classes/NodeProxy.ts`
- Delete: `packages/core/src/shared/classes/NodeProxy.spec.ts`

- [ ] **Step 1: Write failing caret location tests**

Update `packages/core/src/features/caret/CaretFeature.spec.ts`:

```ts
it('exposes location and raw-position recovery', () => {
    const store = new Store()
    expect(store.caret.location()).toBeUndefined()
    store.caret.recovery({kind: 'caret', rawPosition: 0})
    expect(store.caret.recovery()).toEqual({kind: 'caret', rawPosition: 0})
})
```

Update `packages/core/src/features/caret/focus.spec.ts` with a registered DOM fixture:

```ts
it('updates caret location from focus inside registered text surface', () => {
    const store = new Store()
    store.props.set({defaultValue: 'hello'})
    store.value.enable()
    const container = document.createElement('div')
    const shell = document.createElement('span')
    const text = document.createElement('span')
    container.append(shell)
    shell.append(text)
    store.dom.refFor({role: 'container'})(container)
    store.dom.refFor({role: 'token', path: [0]})(shell)
    store.dom.refFor({role: 'text', path: [0]})(text)
    store.dom.enable()
    store.lifecycle.rendered({container, layout: 'inline'})
    store.caret.enable()

    text.dispatchEvent(new FocusEvent('focusin', {bubbles: true}))

    expect(store.caret.location()).toMatchObject({role: 'text'})
})
```

- [ ] **Step 2: Implement caret façade**

Modify `packages/core/src/features/caret/CaretFeature.ts`:

```ts
export class CaretFeature implements Feature {
    readonly recovery = signal<CaretRecovery | undefined>(undefined)
    readonly location = signal<CaretLocation | undefined>(undefined)
    readonly selecting = signal<'drag' | 'all' | undefined>(undefined)

    placeAt(
        rawPosition: number,
        affinity: 'before' | 'after' = 'after'
    ): Result<void, 'notIndexed' | 'invalidBoundary'> {
        return this._store.dom.placeCaretAtRawPosition(rawPosition, affinity)
    }

    focus(address: TokenAddress): Result<void, 'notIndexed' | 'stale'> {
        return this._store.dom.focusAddress(address)
    }
}
```

`placeCaretAtRawPosition()` and `focusAddress()` are internal methods added to `DomFeature` in this task. They are caret-owned façades over current DOM index, not public feature mutation paths.

- [ ] **Step 3: Move recovery application into DomFeature rendered watcher**

At the end of `DomFeature.#commitRendered()`:

```ts
this.#clearStaleCaretLocation()
this.#applyPendingRecovery()
```

Implement:

```ts
#applyPendingRecovery(): void {
	const recovery = this._store.caret.recovery()
	if (!recovery) return

	if (recovery.kind === 'caret') {
		const result = this._store.caret.placeAt(recovery.rawPosition, recovery.affinity)
		if (result.ok) this._store.caret.recovery(undefined)
		return
	}

	const result = this.#placeSelection(recovery.selection)
	if (result.ok) this._store.caret.recovery(undefined)
}
```

- [ ] **Step 4: Update focus and selection event handlers**

Modify `packages/core/src/features/caret/focus.ts` so `focusin` calls `store.dom.locateNode(target)` and writes `store.caret.location`:

```ts
listen(container, 'focusin', event => {
    const result = store.dom.locateNode(event.target as Node)
    if (!result.ok) {
        if (result.reason === 'control') return
        store.caret.location(undefined)
        return
    }

    const role = result.value.textElement?.contains(event.target as Node) ? 'text' : 'markDescendant'
    store.caret.location({address: result.value.address, role})
})
```

Modify `selection.ts` so control selections are ignored and editable selections update location through `store.dom.locateNode(selection.focusNode)`.

- [ ] **Step 5: Remove Store.nodes and NodeProxy**

Modify `packages/core/src/store/Store.ts`:

```ts
import {KeyGenerator, MarkputHandler} from '../shared/classes'

export class Store {
    readonly key = new KeyGenerator()
    readonly blocks = new BlockRegistry()
    readonly props = new PropsFeature(this)
    readonly handler = new MarkputHandler(this)
    // no readonly nodes
}
```

Modify `packages/core/src/shared/classes/index.ts`:

```ts
export {MarkputHandler} from './MarkputHandler'
export {KeyGenerator} from './KeyGenerator'
export {effect, event, signal, watch, batch, untracked} from '../signals'
export type {Signal, Event} from '../signals'
```

Delete `NodeProxy.ts` and `NodeProxy.spec.ts` after all imports are gone.

- [ ] **Step 6: Run NodeProxy absence check**

Run:

```bash
rg "NodeProxy|store\\.nodes|nodes\\.focus|nodes\\.input" packages/core/src packages/react packages/vue
```

Expected: no output.

- [ ] **Step 7: Run caret checks**

Run:

```bash
pnpm -w vitest run packages/core/src/features/caret/CaretFeature.spec.ts packages/core/src/features/caret/focus.spec.ts packages/core/src/features/caret/selection.spec.ts packages/core/src/features/dom/DomFeature.spec.ts
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/features/caret packages/core/src/features/dom/DomFeature.ts packages/core/src/store/Store.ts packages/core/src/shared/classes/index.ts
git add -u packages/core/src/shared/classes
git commit -m "refactor(core): replace NodeProxy with caret location"
```

---

### Task 6: Raw Boundary and Selection Location

**Files:**

- Modify: `packages/core/src/features/dom/DomFeature.ts`
- Modify: `packages/core/src/features/dom/DomFeature.spec.ts`

- [ ] **Step 1: Write failing raw-boundary tests**

Add to `DomFeature.spec.ts`:

```ts
describe('raw boundary mapping', () => {
    it('maps text-surface boundaries to raw UTF-16 positions', () => {
        const {store, textNode} = mountRegisteredInline('hello')

        expect(store.dom.rawPositionFromBoundary(textNode, 2)).toEqual({ok: true, value: 2})
    })

    it('rejects boundaries that split surrogate pairs', () => {
        const {store, textNode} = mountRegisteredInline('a😀b')

        expect(store.dom.rawPositionFromBoundary(textNode, 2)).toEqual({ok: false, reason: 'invalidBoundary'})
    })

    it('maps token shell boundaries by affinity', () => {
        const {store, shell} = mountRegisteredInline('hello')

        expect(store.dom.rawPositionFromBoundary(shell, 0, 'before')).toEqual({ok: true, value: 0})
        expect(store.dom.rawPositionFromBoundary(shell, 1, 'after')).toEqual({ok: true, value: 5})
    })

    it('returns mixedBoundary for selections crossing controls', () => {
        const {store, textNode, controlText} = mountRegisteredBlockWithControl('hello')
        const selection = window.getSelection()!
        const range = document.createRange()
        range.setStart(textNode, 0)
        range.setEnd(controlText, 1)
        selection.removeAllRanges()
        selection.addRange(range)

        expect(store.dom.readRawSelection()).toEqual({ok: false, reason: 'mixedBoundary'})
    })
})
```

Define `mountRegisteredInline()` and `mountRegisteredBlockWithControl()` in the spec file; both should call `store.value.enable()`, register container/token/text/control elements, enable `store.dom`, and emit `lifecycle.rendered({container, layout})`.

- [ ] **Step 2: Implement boundary validation helpers inside DomFeature**

Add:

```ts
function splitsSurrogatePair(text: string, offset: number): boolean {
    if (offset <= 0 || offset >= text.length) return false
    const prev = text.charCodeAt(offset - 1)
    const next = text.charCodeAt(offset)
    return prev >= 0xd800 && prev <= 0xdbff && next >= 0xdc00 && next <= 0xdfff
}

function textOffsetWithin(surface: HTMLElement, node: Node, offset: number): number | undefined {
    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? ''
        if (splitsSurrogatePair(text, offset)) return undefined
        const range = document.createRange()
        range.selectNodeContents(surface)
        range.setEnd(node, offset)
        return range.toString().length
    }

    if (node === surface) return offset === 0 ? 0 : surface.textContent.length
    return undefined
}
```

- [ ] **Step 3: Implement `rawPositionFromBoundary()`**

Add to `DomFeature`:

```ts
rawPositionFromBoundary(
	node: Node,
	offset: number,
	affinity: 'before' | 'after' = 'after'
): BoundaryPositionResult {
	if (!this.index()) return {ok: false, reason: 'notIndexed'}
	if (this.#isComposing) return {ok: false, reason: 'composing'}

	const location = this.locateNode(node)
	if (!location.ok) return location.reason === 'control' ? {ok: false, reason: 'control'} : location

	const token = this._store.parsing.index().resolveAddress(location.value.address)
	if (!token.ok) return {ok: false, reason: 'notIndexed'}

	const textElement = location.value.textElement
	if (textElement && textElement.contains(node)) {
		const local = textOffsetWithin(textElement, node, offset)
		if (local === undefined) return {ok: false, reason: 'invalidBoundary'}
		return {ok: true, value: token.value.position.start + local}
	}

	if (node === location.value.tokenElement) {
		return {ok: true, value: affinity === 'before' ? token.value.position.start : token.value.position.end}
	}

	return {ok: false, reason: 'invalidBoundary'}
}
```

Extend this method in the same task for row start/end, container start/end, slot-root boundaries, empty text surfaces, and adjacent mark gaps using the affinity matrix from the spec.

- [ ] **Step 4: Implement `readRawSelection()`**

Add:

```ts
readRawSelection(): RawSelectionResult {
	if (!this.index()) return {ok: false, reason: 'notIndexed'}
	const selection = window.getSelection()
	if (!selection || selection.rangeCount === 0) return {ok: false, reason: 'invalidBoundary'}

	const range = selection.getRangeAt(0)
	const start = this.rawPositionFromBoundary(range.startContainer, range.startOffset, 'after')
	const end = this.rawPositionFromBoundary(range.endContainer, range.endOffset, 'before')

	if (!start.ok || !end.ok) {
		if (start.reason === 'control' || end.reason === 'control') return {ok: false, reason: 'mixedBoundary'}
		return {ok: false, reason: start.reason}
	}

	const direction =
		selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset
			? 'backward'
			: 'forward'
	const rangeValue = start.value <= end.value ? {start: start.value, end: end.value} : {start: end.value, end: start.value}

	return {ok: true, value: {range: rangeValue, direction}}
}
```

- [ ] **Step 5: Run DOM location checks**

Run:

```bash
pnpm -w vitest run packages/core/src/features/dom/DomFeature.spec.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/features/dom/DomFeature.ts packages/core/src/features/dom/DomFeature.spec.ts
git commit -m "feat(core): map DOM boundaries to raw positions"
```

---

### Task 7: Clipboard Slice

**Files:**

- Modify: `packages/core/src/features/clipboard/ClipboardFeature.ts`
- Modify: `packages/core/src/features/clipboard/ClipboardFeature.spec.ts` if added; otherwise update storybook clipboard specs.
- Delete: `packages/core/src/features/clipboard/selectionToTokens.ts`
- Delete: `packages/core/src/features/clipboard/selectionToTokens.spec.ts`
- Modify: `packages/core/src/features/clipboard/index.ts`
- Modify: `packages/storybook/src/pages/Clipboard/Clipboard.react.spec.tsx`
- Modify: `packages/storybook/src/pages/Clipboard/Clipboard.vue.spec.ts`

- [ ] **Step 1: Write failing clipboard behavior tests**

Update React and Vue clipboard specs with command-path assertions:

```ts
it('cuts selection through shared raw selection mapping', async () => {
	await render(<Default defaultValue="hello @[world] tail" />)
	const root = page.getByRole('textbox').element()
	const textNode = root.querySelector('[contenteditable="true"]')!.firstChild!
	const range = document.createRange()
	range.setStart(textNode, 0)
	range.setEnd(textNode, 5)
	window.getSelection()!.removeAllRanges()
	window.getSelection()!.addRange(range)

	await userEvent.keyboard('{Control>}x{/Control}')

	await expect.element(page.getByText('hello')).not.toBeVisible()
})
```

Add a mixed control/editable test in block mode that expects no value mutation and a clear failure path.

- [ ] **Step 2: Replace selectionToTokens usage**

Modify `ClipboardFeature.#handleCopy()`:

```ts
const raw = this.store.dom.readRawSelection()
if (!raw.ok) return false

const range = window.getSelection()?.getRangeAt(0)
if (!range) return false

const plainText = range.toString()
const html = htmlFromRange(range)
const markup = serializeRawRange(this.store.parsing.tokens(), raw.value.range)
```

Implement `serializeRawRange()` in `ClipboardFeature.ts` as a private function:

```ts
function serializeRawRange(tokens: readonly Token[], range: RawRange): string {
    const selected = tokens
        .filter(token => token.position.end > range.start && token.position.start < range.end)
        .map(token => {
            if (token.type !== 'text') return token
            const start = Math.max(0, range.start - token.position.start)
            const end = Math.min(token.content.length, range.end - token.position.start)
            return {...token, content: token.content.slice(start, end)}
        })
    return toString(selected)
}
```

- [ ] **Step 3: Migrate cut to value pipeline**

In the `cut` listener:

```ts
const raw = this.store.dom.readRawSelection()
if (!raw.ok || raw.value.range.start === raw.value.range.end) return

this.store.value.replaceRange(raw.value.range, '', {
    source: 'cut',
    recover: {kind: 'caret', rawPosition: raw.value.range.start},
})
```

- [ ] **Step 4: Remove old clipboard locator**

Delete `selectionToTokens.ts` and `selectionToTokens.spec.ts`. Modify `packages/core/src/features/clipboard/index.ts`:

```ts
export {ClipboardFeature} from './ClipboardFeature'
export {MARKPUT_MIME, captureMarkupPaste, consumeMarkupPaste, clearMarkupPaste} from './pasteMarkup'
```

- [ ] **Step 5: Run clipboard checks**

Run:

```bash
pnpm -w vitest run packages/storybook/src/pages/Clipboard/Clipboard.react.spec.tsx packages/storybook/src/pages/Clipboard/Clipboard.vue.spec.ts
pnpm -w vitest run packages/core/src/features/clipboard/pasteMarkup.spec.ts packages/core/src/features/dom/DomFeature.spec.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/features/clipboard packages/storybook/src/pages/Clipboard
git add -u packages/core/src/features/clipboard
git commit -m "refactor(core): route clipboard through DOM raw selection"
```

---

### Task 8: Inline Input and Overlay Slice

**Files:**

- Modify: `packages/core/src/features/keyboard/input.ts`
- Modify: `packages/core/src/features/keyboard/input.spec.ts`
- Modify: `packages/core/src/features/overlay/OverlayFeature.ts`
- Modify: `packages/core/src/features/overlay/OverlayFeature.spec.ts`
- Modify: `packages/storybook/src/pages/Dynamic/Dynamic.react.stories.tsx`
- Modify: `packages/storybook/src/pages/Dynamic/Dynamic.vue.stories.ts`

- [ ] **Step 1: Write failing inline input tests**

Update `packages/core/src/features/keyboard/input.spec.ts`:

```ts
it('inserts text through replaceRange using target ranges', () => {
    const store = new Store()
    const replaceRange = vi.spyOn(store.value, 'replaceRange')
    const event = new InputEvent('beforeinput', {inputType: 'insertText', data: 'x', bubbles: true})
    Object.defineProperty(event, 'getTargetRanges', {
        value: () => [{startContainer: textNode, startOffset: 1, endContainer: textNode, endOffset: 1}],
    })

    handleBeforeInput(store, event)

    expect(replaceRange).toHaveBeenCalledWith({start: 1, end: 1}, 'x', {
        source: 'input',
        recover: {kind: 'caret', rawPosition: 2},
    })
})
```

Add IME tests:

```ts
it('does not commit beforeinput during composition', () => {
    store.dom.compositionStarted()
    handleBeforeInput(store, new InputEvent('beforeinput', {inputType: 'insertText', data: 'あ'}))
    expect(store.value.current()).toBe('hello')
})
```

- [ ] **Step 2: Migrate inline beforeinput**

In `handleBeforeInput()`:

```ts
const ranges = event.getTargetRanges()
const raw = ranges.length > 0 ? rawRangeFromStaticRange(store, ranges[0]) : store.dom.readRawSelection()

if (!raw.ok) return
event.preventDefault()

store.value.replaceRange(raw.value.range, event.data ?? '', {
    source: 'input',
    recover: {kind: 'caret', rawPosition: raw.value.range.start + (event.data?.length ?? 0)},
})
```

Implement deletion and paste branches through the same helper. Markput MIME paste uses `consumeMarkupPaste(container)` for replacement text and still commits through `replaceRange()`.

- [ ] **Step 3: Add composition event tracking to DomFeature**

In `enableInput()`, listen to composition events on the container:

```ts
listen(container, 'compositionstart', () => store.dom.compositionStarted())
listen(container, 'compositionend', event => {
    store.dom.compositionEnded()
    const selection = store.dom.readRawSelection()
    if (!selection.ok) return
    store.value.replaceRange(selection.value.range, (event as CompositionEvent).data, {
        source: 'input',
        recover: {kind: 'caret', rawPosition: selection.value.range.start + (event as CompositionEvent).data.length},
    })
})
```

- [ ] **Step 4: Migrate overlay insertion**

Modify `OverlayFeature` select handling:

```ts
const match = this.match()
if (!match) return
const markup = createMarkFromOverlay(match)
this._store.value.replaceRange(match.range, markup, {
    source: 'overlay',
    recover: {kind: 'caret', rawPosition: match.range.start + markup.length},
})
this.match(undefined)
```

Update `OverlayMatch` in `shared/types.ts` so it carries:

```ts
range: RawRange
```

Then update trigger finding code so `range.start` and `range.end` are raw positions from the current DOM location rather than DOM node indexes.

- [ ] **Step 5: Run inline and overlay checks**

Run:

```bash
pnpm -w vitest run packages/core/src/features/keyboard/input.spec.ts packages/core/src/features/overlay/OverlayFeature.spec.ts packages/core/src/features/dom/DomFeature.spec.ts
pnpm -w vitest run packages/storybook/src/pages/Dynamic
```

Expected: pass after updating dynamic stories that used editable mark refs.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/features/keyboard/input.ts packages/core/src/features/keyboard/input.spec.ts packages/core/src/features/overlay packages/core/src/shared/types.ts packages/storybook/src/pages/Dynamic
git commit -m "refactor(core): route inline input through raw ranges"
```

---

### Task 9: Block and Drag Slice

**Files:**

- Modify: `packages/core/src/features/keyboard/blockEdit.ts`
- Delete: `packages/core/src/features/keyboard/rawPosition.ts`
- Modify: `packages/core/src/features/keyboard/index.ts`
- Modify: `packages/core/src/features/drag/DragFeature.ts`
- Modify: `packages/core/src/features/drag/DragFeature.spec.ts`
- Modify: `packages/storybook/src/pages/Drag/**`
- Modify: `packages/storybook/src/shared/lib/dragTestHelpers.ts`

- [ ] **Step 1: Write failing block raw-position tests**

Add block browser tests covering row gaps, control boundaries, and merge recovery:

```ts
it('maps block text input through registered row and text surface', async () => {
	await render(<MarkedInput layout="block" defaultValue={'hello\\nworld'} />)
	const firstRow = page.getByText('hello').element().closest('[contenteditable]') as HTMLElement

	await focusAtEnd(firstRow)
	await userEvent.keyboard('!')

	await expect.element(page.getByText('hello!')).toBeVisible()
})

it('ignores beforeinput inside a drag control', async () => {
	await render(<MarkedInput layout="block" draggable defaultValue="hello" />)
	const handle = page.getByRole('button', {name: /drag/i})

	await userEvent.click(handle)
	await userEvent.keyboard('x')

	await expect.element(page.getByText('hello')).toBeVisible()
})
```

- [ ] **Step 2: Migrate block beforeinput to DomFeature**

In `handleBlockBeforeInput()`:

```ts
const range = event.getTargetRanges()[0]
if (!range) return
const start = store.dom.rawPositionFromBoundary(range.startContainer, range.startOffset, 'after')
const end = store.dom.rawPositionFromBoundary(range.endContainer, range.endOffset, 'before')
if (!start.ok || !end.ok) return

const rawRange = start.value <= end.value ? {start: start.value, end: end.value} : {start: end.value, end: start.value}
const replacement = event.inputType.startsWith('delete') ? '' : (event.data ?? '')
event.preventDefault()
store.value.replaceRange(rawRange, replacement, {
    source: 'block',
    recover: {kind: 'caret', rawPosition: rawRange.start + replacement.length},
})
```

- [ ] **Step 3: Migrate Enter and row merge recovery**

Replace queue-microtask DOM anchor recovery with raw-position recovery:

```ts
store.value.replaceRange({start: absolutePos, end: absolutePos}, newRowContent, {
    source: 'block',
    recover: {kind: 'caret', rawPosition: absolutePos + newRowContent.length},
})
```

For row merge:

```ts
store.value.replaceAll(newValue, {
    source: 'block',
    recover: {kind: 'caret', rawPosition: joinPos},
})
```

- [ ] **Step 4: Migrate drag commits**

In `DragFeature.ts`, replace `value.next()` calls:

```ts
const result = this.store.value.replaceAll(newValue, {source: 'drag'})
if (!result.ok) return
```

Keep drag preview state in `BlockRegistry`; do not mutate `parsing.tokens()` during preview.

- [ ] **Step 5: Delete rawPosition helper**

Remove `packages/core/src/features/keyboard/rawPosition.ts` and remove its exports from `keyboard/index.ts`.

- [ ] **Step 6: Run block and drag checks**

Run:

```bash
pnpm -w vitest run packages/core/src/features/drag/DragFeature.spec.ts packages/core/src/features/dom/DomFeature.spec.ts
pnpm -w vitest run packages/storybook/src/pages/Drag
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/features/keyboard packages/core/src/features/drag packages/storybook/src/pages/Drag packages/storybook/src/shared/lib/dragTestHelpers.ts
git add -u packages/core/src/features/keyboard/rawPosition.ts
git commit -m "refactor(core): route block and drag edits through raw ranges"
```

---

### Task 10: Mark Controller API

**Files:**

- Create: `packages/core/src/features/mark/MarkController.ts`
- Create: `packages/core/src/features/mark/MarkController.spec.ts`
- Modify: `packages/core/src/features/mark/MarkFeature.ts`
- Modify: `packages/core/src/features/mark/index.ts`
- Delete or deprecate: `packages/core/src/features/mark/MarkHandler.ts`
- Modify: `packages/core/src/features/mark/MarkHandler.spec.ts`
- Modify: `packages/react/markput/src/lib/hooks/useMark.tsx`
- Create: `packages/react/markput/src/lib/hooks/useMarkInfo.tsx`
- Modify: `packages/vue/markput/src/lib/hooks/useMark.ts`
- Create: `packages/vue/markput/src/lib/hooks/useMarkInfo.ts`
- Modify: `packages/react/markput/src/types.ts`
- Modify: `packages/vue/markput/src/types.ts`
- Modify: `packages/storybook/src/pages/Dynamic/**`
- Modify: `packages/storybook/src/pages/Nested/**`

- [ ] **Step 1: Write failing MarkController tests**

Create `packages/core/src/features/mark/MarkController.spec.ts`:

```ts
import {describe, it, expect, vi} from 'vitest'

import {Store} from '../../store/Store'
import {MarkController} from './MarkController'

function setup(value = 'hello @[world]') {
    const store = new Store()
    store.props.set({defaultValue: value, Mark: () => null, options: [{markup: '@[__value__]'}]})
    store.value.enable()
    const token = store.parsing.tokens().find(t => t.type === 'mark')!
    const path = store.parsing.index().pathFor(token)!
    const address = store.parsing.index().addressFor(path)!
    const controller = MarkController.fromToken(store, token)
    return {store, token, address, controller}
}

describe('MarkController', () => {
    it('exposes readonly snapshot fields', () => {
        const {controller} = setup()

        expect(controller.value).toBe('world')
        expect(controller.meta).toBeUndefined()
        expect(controller.slot).toBeUndefined()
        expect(controller.readOnly).toBe(false)
    })

    it('removes a mark through the value pipeline', () => {
        const {store, controller} = setup()

        const result = controller.remove()

        expect(result).toEqual({ok: true, accepted: 'immediate', value: 'hello '})
        expect(store.value.current()).toBe('hello ')
    })

    it('updates mark value through descriptor serialization', () => {
        const {store, controller} = setup()

        const result = controller.update({value: 'markput'})

        expect(result).toEqual({ok: true, accepted: 'immediate', value: 'hello @[markput]'})
        expect(store.value.current()).toBe('hello @[markput]')
    })

    it('fails closed when address is stale', () => {
        const {store, controller} = setup()
        store.value.replaceAll('different @[token]')

        expect(controller.update({value: 'bad'})).toEqual({ok: false, reason: 'stale'})
    })

    it('does not mutate in read-only mode', () => {
        const {store, controller} = setup()
        store.props.set({readOnly: true})

        expect(controller.remove()).toEqual({ok: false, reason: 'readOnly'})
        expect(store.value.current()).toBe('hello @[world]')
    })
})
```

- [ ] **Step 2: Implement MarkController**

Create `packages/core/src/features/mark/MarkController.ts`:

```ts
import type {EditResult, MarkPatch, MarkSnapshot, TokenAddress, TokenShapeSnapshot} from '../../shared/editorContracts'
import type {Store} from '../../store'
import type {MarkToken} from '../parsing'
import {annotate} from '../parsing/parser/utils/annotate'
import {snapshotTokenShape} from '../parsing/tokenIndex'

export class MarkController {
    readonly #shape: TokenShapeSnapshot

    constructor(
        private readonly store: Store,
        private readonly address: TokenAddress,
        private readonly snapshot: MarkSnapshot,
        shape: TokenShapeSnapshot
    ) {
        this.#shape = shape
    }

    static fromToken(store: Store, token: MarkToken): MarkController {
        const path = store.parsing.index().pathFor(token)
        if (!path) throw new Error('Cannot create MarkController for unindexed token')
        const address = store.parsing.index().addressFor(path)
        if (!address) throw new Error('Cannot create MarkController for unresolved token path')
        return new MarkController(
            store,
            address,
            {
                value: token.value,
                meta: token.meta,
                slot: token.slot?.content,
                readOnly: store.props.readOnly(),
            },
            snapshotTokenShape(token)
        )
    }

    get value(): string {
        return this.snapshot.value
    }

    get meta(): string | undefined {
        return this.snapshot.meta
    }

    get slot(): string | undefined {
        return this.snapshot.slot
    }

    get readOnly(): boolean {
        return this.snapshot.readOnly
    }

    remove(): EditResult {
        const resolved = this.#resolve()
        if (!resolved.ok) return resolved
        return this.store.value.replaceRange(resolved.value.position, '', {source: 'mark'})
    }

    update(patch: MarkPatch): EditResult {
        const resolved = this.#resolve()
        if (!resolved.ok) return resolved
        const token = resolved.value
        const value = patch.value ?? token.value
        const meta =
            patch.meta?.kind === 'clear' ? undefined : patch.meta?.kind === 'set' ? patch.meta.value : token.meta
        const slot =
            patch.slot?.kind === 'clear'
                ? undefined
                : patch.slot?.kind === 'set'
                  ? patch.slot.value
                  : token.children.length > 0
                    ? undefined
                    : token.slot?.content
        const serialized = annotate(token.descriptor.markup, {value, meta, slot})

        return this.store.value.replaceRange(token.position, serialized, {source: 'mark'})
    }

    #resolve(): {ok: true; value: MarkToken} | {ok: false; reason: 'stale' | 'readOnly'} {
        if (this.store.props.readOnly()) return {ok: false, reason: 'readOnly'}
        const resolved = this.store.parsing.index().resolveAddress(this.address, this.#shape)
        if (!resolved.ok || resolved.value.type !== 'mark') return {ok: false, reason: 'stale'}
        return {ok: true, value: resolved.value}
    }
}
```

- [ ] **Step 3: Update React `useMark()` and add `useMarkInfo()`**

Modify `packages/react/markput/src/lib/hooks/useMark.tsx`:

```tsx
export const useMark = (): MarkController => {
    const {store, token} = useTokenContext()
    if (token.type !== 'mark') throw new Error('useMark must be called within a mark token context')
    return useMemo(() => MarkController.fromToken(store, token), [store, token])
}
```

Create `packages/react/markput/src/lib/hooks/useMarkInfo.tsx`:

```tsx
export const useMarkInfo = (): MarkInfo => {
    const {store, token} = useTokenContext()
    if (token.type !== 'mark') throw new Error('useMarkInfo must be called within a mark token context')
    const index = store.parsing.index()
    const path = index.pathFor(token)
    if (!path) throw new Error('Mark token is not indexed')
    const address = index.addressFor(path)
    if (!address) throw new Error('Mark token path is stale')
    const info = findToken(store.parsing.tokens(), token)
    return {
        address,
        depth: info?.depth ?? 0,
        hasNestedMarks: token.children.some(child => child.type === 'mark'),
        key: index.key(path),
    }
}
```

- [ ] **Step 4: Update Vue `useMark()` and add `useMarkInfo()`**

Mirror the React hooks in `packages/vue/markput/src/lib/hooks/useMark.ts` and `useMarkInfo.ts`, returning Vue refs only when the existing hook pattern requires them. The public `useMark()` value is the `MarkController`; path/depth/key live in `useMarkInfo()`.

- [ ] **Step 5: Remove public ref mutation examples**

Update stories:

```tsx
function Mention({children}: MarkProps) {
    const mark = useMark()
    return (
        <span>
            <button type="button" onClick={() => mark.remove()}>
                @{mark.value}
            </button>
            {children}
        </span>
    )
}
```

Replace `mark.depth` with `useMarkInfo().depth`. Replace `mark.hasChildren` with `useMarkInfo().hasNestedMarks`.

- [ ] **Step 6: Export MarkController**

Modify `packages/core/src/features/mark/index.ts`:

```ts
export {MarkController} from './MarkController'
export {MarkFeature} from './MarkFeature'
export type {MarkOptions} from './types'
```

Modify `packages/core/index.ts`:

```ts
export {MarkController} from './src/features/mark'
export type {MarkPatch, MarkSnapshot, MarkInfo} from './src/shared/editorContracts'
```

Keep `MarkHandler` as a deprecated alias only if the package typecheck shows downstream adapter imports still require it during this task:

```ts
/** @deprecated Use MarkController. */
export const MarkHandler = MarkController
```

- [ ] **Step 7: Run mark API checks**

Run:

```bash
pnpm -w vitest run packages/core/src/features/mark/MarkController.spec.ts packages/core/src/features/mark/MarkFeature.spec.ts
pnpm -w vitest run packages/storybook/src/pages/Dynamic packages/storybook/src/pages/Nested
pnpm run typecheck
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/features/mark packages/core/index.ts packages/react/markput/src/lib/hooks packages/vue/markput/src/lib/hooks packages/react/markput/src/types.ts packages/vue/markput/src/types.ts packages/storybook/src/pages/Dynamic packages/storybook/src/pages/Nested
git commit -m "feat(core): replace mark refs with mark controller"
```

---

### Task 11: Locator Cleanup, Docs, and Acceptance Checks

**Files:**

- Modify: `packages/core/src/features/dom/DomFeature.ts`
- Modify: `packages/core/src/features/dom/README.md`
- Modify: `packages/core/src/store/README.md`
- Modify: `packages/core/src/features/value/README.md`
- Modify: `packages/core/src/features/mark/README.md`
- Modify: `packages/website/src/content/docs/development/architecture.md`
- Modify: `packages/website/src/content/docs/development/how-it-works.md`
- Modify: `packages/website/src/content/docs/guides/dynamic-marks.md`
- Modify: `packages/website/src/content/docs/guides/nested-marks.md`
- Modify: `packages/website/src/content/docs/examples/hashtags.md`
- Modify: `packages/website/src/content/docs/examples/mention-system.md`
- Modify: `packages/website/src/content/docs/examples/markdown-editor.md`
- Modify: `packages/website/src/content/docs/examples/slash-commands.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Remove compatibility wrappers**

Remove temporary production paths that serialize mutated tokens:

- `ValueFeature.change` compatibility branch that serializes `parsing.tokens()`.
- `ValueFeature.next` compatibility branch if no production callers remain.
- `deleteMark()` if keyboard no longer imports it.
- DOM child-parity helpers.
- `data-testid` checks in production code.
- Public `MarkHandler` alias if adapters and stories no longer import it.

- [ ] **Step 2: Run static absence checks**

Run:

```bash
rg "NodeProxy|store\\.nodes|nodes\\.focus|nodes\\.input|selectionToTokens|getDomRawPos|getCaretRawPosInBlock|setCaretAtRawPos|useMark\\(\\).*ref|data-testid.*production|\\.value\\s*=|\\.meta\\s*=|\\.slot\\s*=" packages/core/src packages/react/markput/src packages/vue/markput/src
```

Expected: no production matches. Matches in docs that describe removed APIs should be removed in Step 3.

- [ ] **Step 3: Update docs**

In `architecture.md`, add the core-engine ownership rules:

```md
Core owns token addresses, DOM registration, raw selection mapping, raw value mutation, and caret recovery. React and Vue render adapter-owned structural DOM and register it with core through private refs. Features communicate through `store.<name>.*`, `store.props`, and `store.dom`/`store.caret`; production code must not infer token identity from DOM child order.
```

In custom mark docs and examples, replace ref mutation with:

```tsx
function Mention({children}: MarkProps) {
    const mark = useMark()
    return (
        <span>
            <button type="button" onClick={() => mark.update({value: 'updated'})}>
                @{mark.value}
            </button>
            {children}
        </span>
    )
}
```

In `AGENTS.md` and `CLAUDE.md`, update the architecture section:

```md
DOM/token mapping lives in `store.dom` through adapter-owned structural registration. Do not use DOM child parity, public data attributes, user refs, or `NodeProxy` for token location. Value edits go through `store.value.replaceRange()` / `replaceAll()` with raw positions and optional `caret.recovery`.
```

- [ ] **Step 4: Run full local verification**

Run:

```bash
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint:check
pnpm run format:check
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src packages/react/markput/src packages/vue/markput/src packages/storybook/src packages/website/src/content/docs AGENTS.md CLAUDE.md
git commit -m "docs: document core editor engine architecture"
```

---

## Completeness Review

Spec coverage:

- Shared contracts are introduced in Task 1.
- TokenPath, TokenAddress, parse generation, stale validation, and descriptor identity checks are introduced in Tasks 1 and 10.
- Adapter-owned DOM registration, stable refs, `DomIndex`, `structuralKey`, diagnostics, and non-reentrant rendered processing are introduced in Tasks 3 and 4.
- `store.nodes` and `NodeProxy` are removed in Task 5.
- Raw boundary and selection semantics, including controls, mixed boundaries, surrogate pairs, and affinity, are implemented in Task 6.
- Clipboard is migrated first among selection consumers in Task 7.
- Inline input, paste, IME, and overlay are migrated in Task 8.
- Block edit and drag commits are migrated in Task 9.
- `MarkController`, command-based `useMark()`, and separate `useMarkInfo()` are implemented in Task 10.
- Legacy locator cleanup and documentation are completed in Task 11.

Type consistency:

- `TokenAddress.parseGeneration` matches `TokenIndex.generation`.
- DOM registration stores `TokenPath`, not `TokenAddress`; addresses are resolved only during the rendered commit.
- Raw value edits use `RawRange`; selection direction exists only on `RawSelection`.
- Public mark commands return `EditResult`.
- Caret recovery uses `CaretRecovery`, not DOM anchors or child indexes.

Final acceptance command set:

```bash
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint:check
pnpm run format:check
```
