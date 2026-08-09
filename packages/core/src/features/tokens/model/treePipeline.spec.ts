import {afterEach, describe, expect, it, vi} from 'vitest'

import {watch} from '../../../shared/signals/index.js'
import {Parser} from '../parser/Parser'
import type {Markup, Token} from '../parser/types'
// The S1.4 STRING boundary (`tokens/tree/boundary.ts`), not the DOM boundary
// layer of the same filename at `tokens/boundary.ts`.
import {createBoundary} from '../tree/boundary'
import {createSnapshotMemo} from '../tree/snapshotMemo'
import {createTransactions} from '../tree/transactions'
import {createTokenTree} from '../tree/tree'
import {createCommitPipeline} from './commit'
import type {TokenDelta} from './commitInput'
import type {TokenHandle} from './TokenHandle'
import {fromTransaction} from './treeInput'

/**
 * The same manual adapter commit.spec.ts uses, wired to the tree core instead
 * of the identity tracker: an empty tree seeded through the boundary, edits
 * through the transaction verbs, and `onResult` lowering into the pipeline.
 * Value-only marks render their value as a bare text node, so bind never
 * descends into them.
 *
 * PARITY IS ASSERTED ON OBSERVABLE OUTCOMES, not on `CommitInput.changes`. The
 * two lowerings differ in that intermediate shape — `fromReconcile` maps
 * reconcile's `kind: 'add'` into a `patch: true` change while `fromTransaction`
 * emits no entry for an added node — and the shape is provably not contractual:
 * `changes` is read in exactly one place (`commit.ts`'s `commitText`), which
 * runs only when `!render`, and an add sets `render` on BOTH paths (reconcile
 * via `tokenIdentity.ts:318`, adoption via `adopt.ts:197-198`). Add entries are
 * therefore unreachable in the only consumer. What must match is what the
 * pipeline DOES: the DOM, handle identity/liveness, the `changed` payload and
 * count, the render-tree reference and the pending latch — which is what every
 * case below asserts, each mirroring a `commit.spec.ts` case on the live
 * lowering.
 */
// `Markup`, NOT `string`: `Parser`'s constructor takes `(Markup | undefined)[]`
// and `Markup` is a template-literal union (parser/types.ts:63), so a
// `string[]` default fails with TS2345. Vitest stays GREEN on that — only
// `pnpm run typecheck` catches it, which is why it is in every gate.
function createHarness(markups: Markup[] = ['@[__value__]']) {
	const parser = new Parser(markups)
	const tree = createTokenTree([])
	const memo = createSnapshotMemo()
	const nodes = new Map<number, TokenHandle>()
	const controls = new Set<HTMLElement>()
	const container = document.createElement('div')
	document.body.append(container)
	let mounted: HTMLElement | null = container
	const pipeline = createCommitPipeline({
		container: () => mounted,
		nodes,
		// The tree core stamps every snapshot token with its node's id
		// (snapshot.ts), so bind's id pre-pass can never throw on this path.
		idFor: token => token.id,
		editableState: () => ({editable: true, readOnly: false}),
		controlElements: () => controls,
		childSequenceHostsFor: () => [],
		isBlock: () => false,
	})
	const boundary = createBoundary({
		tree,
		parser: () => parser,
		controlled: () => false,
		onChange: () => {},
		onResult: result => pipeline.apply(fromTransaction(result, memo, tree.roots())),
	})
	const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
	// FLAT paint: a value-only mark renders its value as a bare text node, so
	// bind never descends. This is the default for every case but the slot one.
	const render = () => {
		const spans = pipeline.renderTree().map(token => {
			const span = document.createElement('span')
			if (token.type === 'mark') span.append(document.createTextNode(token.value))
			return span
		})
		container.replaceChildren(...spans)
		pipeline.onRendered()
		return spans
	}
	// NESTED paint, for slot markups: a mark renders its CHILDREN as spans, so
	// bind descends and each child text token owns a surface. Same recursion as
	// createSlotHarness's `paint` at commit.spec.ts:598-606 — and it lives HERE,
	// inside createHarness, for the same reason that one does: it needs
	// `container` and `pipeline.onRendered()`, neither of which a free function
	// has.
	const renderNested = () => {
		const paint = (tokens: readonly Token[]): HTMLElement[] =>
			tokens.map(token => {
				const span = document.createElement('span')
				if (token.type === 'mark') span.append(...paint(token.children))
				return span
			})
		const spans = paint(pipeline.renderTree())
		container.replaceChildren(...spans)
		pipeline.onRendered()
		return spans
	}
	const splice = (start: number, end: number, text: string) => tx.applyRange({start, end, insertedLength: 0}, text)
	return {
		pipeline,
		tree,
		memo,
		nodes,
		container,
		boundary,
		tx,
		render,
		renderNested,
		splice,
		unmount: () => void (mounted = null),
	}
}

type Harness = ReturnType<typeof createHarness>

/** 'he@[x]llo' → text 'he'[0,2], mark '@[x]'[2,6], text 'llo'[6,9]. */
function mount(harness: Harness, value = 'he@[x]llo') {
	harness.boundary.arrive(value)
	const [text1, mark, text2] = harness.render()
	return {text1, mark, text2}
}

describe('commit pipeline driven by the tree core', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	it('cold start: the seed is structural, quiet until rendered, then binds three surfaces', () => {
		const harness = createHarness()
		const {pipeline} = harness
		const changedSpy = vi.fn()
		watch(pipeline.changed, changedSpy)

		harness.boundary.arrive('he@[x]llo')

		expect(pipeline.pending()).toBe(true)
		expect(changedSpy).not.toHaveBeenCalled()
		expect(harness.container.childElementCount).toBe(0)

		const [text1, mark, text2] = harness.render()

		expect(changedSpy).toHaveBeenCalledTimes(1)
		expect(pipeline.byPath().size).toBe(3)
		expect(text1.textContent).toBe('he')
		expect(mark.textContent).toBe('x')
		expect(text2.textContent).toBe('llo')
		expect(text1.contentEditable).toBe('true')
		expect(mark.tabIndex).toBe(0)
	})

	it('a tail text edit patches in place, keeps the render tree and announces once', () => {
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		const tail = pipeline.byPath().get('2')
		if (!tail) throw new Error('expected tail handle')
		const treeBefore = pipeline.renderTree()
		const byPathBefore = pipeline.byPath()
		const changedSpy = vi.fn()
		let domAtEvent: string | null = null
		let payload: TokenDelta | undefined
		watch(pipeline.changed, delta => {
			changedSpy()
			payload = delta
			domAtEvent = text2.textContent
		})

		expect(harness.splice(9, 9, '!')).toBe(true)

		expect(text2.textContent).toBe('llo!')
		expect(domAtEvent).toBe('llo!')
		expect(pipeline.renderTree()).toBe(treeBefore)
		expect(pipeline.byPath()).toBe(byPathBefore)
		expect(pipeline.pending()).toBe(false)
		expect(changedSpy).toHaveBeenCalledTimes(1)
		// Payload parity with commit.spec.ts's live-path case: the edited node is the
		// only `updated` id, and `shifted` — which lists the same node — must not leak
		// into a content feed.
		expect(payload).toEqual({added: [], removed: [], updated: [tail.id]})
	})

	it('a mark value change routes RENDER even though it adds and removes nothing', () => {
		const harness = createHarness()
		const {pipeline} = harness
		const {mark} = mount(harness)
		const markHandle = pipeline.byPath().get('1')
		if (!markHandle) throw new Error('expected mark handle')
		const treeBefore = pipeline.renderTree()
		const changedSpy = vi.fn()
		watch(pipeline.changed, changedSpy)

		// '@[x]' spans [2,6]; replacing it whole is what MarkController lowers to.
		expect(harness.splice(2, 6, '@[y]')).toBe(true)

		expect(pipeline.renderTree()).not.toBe(treeBefore)
		expect(changedSpy).not.toHaveBeenCalled()
		expect(pipeline.pending()).toBe(true)
		expect(markHandle.element()).toBe(mark)

		harness.render()

		expect(changedSpy).toHaveBeenCalledTimes(1)
		// Handle continuity across a re-render is the pinned contract (id-keyed).
		expect(pipeline.byPath().get('1')).toBe(markHandle)
		expect(harness.container.children[1].textContent).toBe('y')
	})

	it('a removal routes structural and kills the handle at bind', () => {
		const harness = createHarness()
		const {pipeline, nodes} = harness
		mount(harness)
		const markHandle = pipeline.byPath().get('1')
		if (!markHandle) throw new Error('expected mark handle')
		let payload: {removed: readonly number[]} | undefined
		watch(pipeline.changed, delta => {
			payload = delta
		})

		expect(harness.splice(2, 6, '')).toBe(true)
		expect(markHandle.alive()).toBe(true)
		expect(pipeline.pending()).toBe(true)

		harness.render()

		expect(markHandle.alive()).toBe(false)
		expect(payload?.removed).toContain(markHandle.id)
		expect(nodes.size).toBe(1)
	})

	it('an edit landing in the pending window folds in, fail-closed', () => {
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		const tail = pipeline.byPath().get('2')
		if (!tail) throw new Error('expected tail handle')
		const changedSpy = vi.fn()
		watch(pipeline.changed, changedSpy)

		harness.splice(2, 6, '@[y]') // render bit set → latched
		harness.splice(9, 9, '!') // looks like a text edit against the pending tree

		expect(pipeline.pending()).toBe(true)
		expect(changedSpy).not.toHaveBeenCalled()
		expect(tail.token().content).toBe('llo')
		expect(text2.textContent).toBe('llo')

		harness.render()

		expect(changedSpy).toHaveBeenCalledTimes(1)
		expect(harness.container.children[2].textContent).toBe('llo!')
	})

	it('a text change whose handle vanished abandons the branch and self-heals through a bind', () => {
		const harness = createHarness()
		const {pipeline, nodes} = harness
		const {text2} = mount(harness)
		const tail = pipeline.byPath().get('2')
		if (!tail) throw new Error('expected tail handle')
		nodes.delete(tail.id)
		const changedSpy = vi.fn()
		watch(pipeline.changed, changedSpy)

		harness.splice(9, 9, '!')

		expect(changedSpy).toHaveBeenCalledTimes(1)
		expect(pipeline.pending()).toBe(false)
		expect(pipeline.byPath().get('2')?.token().content).toBe('llo!')
		expect(text2.textContent).toBe('llo!')
	})

	it('the divergence detector still throws with the path on an untouched surface', () => {
		const harness = createHarness()
		const {text1} = mount(harness)
		text1.textContent = 'WRONG'

		let message = ''
		try {
			harness.splice(9, 9, '!')
		} catch (e) {
			message = e instanceof Error ? e.message : String(e)
		}
		expect(message).toMatch(/TokenModel divergence/)
		expect(message).toContain('[0]')
		expect(message).toContain('"WRONG"')
		expect(message).toContain('"he"')
	})

	it('an in-slot edit routes TEXT and patches the child surface', () => {
		// Slot harness: marks render their CHILDREN, so bind descends and the child
		// text token owns a surface. '#[ab]tail' → text ''[0,0], mark '#[ab]'[0,5]
		// {child 'ab'[2,4]}, text 'tail'[5,9].
		const harness = createHarness(['#[__slot__]'])
		const {pipeline} = harness
		harness.boundary.arrive('#[ab]tail')
		harness.renderNested()
		const childHandle = pipeline.byPath().get('1.0')
		const childSurface = childHandle?.node()?.textElement
		if (!childSurface) throw new Error('expected the child surface')
		const treeBefore = pipeline.renderTree()

		expect(harness.splice(3, 3, 'X')).toBe(true)

		expect(pipeline.renderTree()).toBe(treeBefore)
		expect(pipeline.pending()).toBe(false)
		expect(childSurface.textContent).toBe('aXb')
	})

	// Beyond the plan's case list, and both survived the first mutation run: the
	// eight cases above all passed with `fromTransaction`'s two subtree walks
	// removed. Each ports a `commit.spec.ts` case whose live-path behavior comes
	// from reconcile's recursion (`collectChanges`/`collectRemovedIds` at
	// tokenIdentity.ts:134-147), so a roots-only lowering is a real parity break.

	it('a shift refreshes the descendants of a shifted mark, not just its root', () => {
		// Ports commit.spec.ts's 'shifted suffix' case to a mark WITH children. The
		// live path's suffix walk collects the whole subtree as `update`
		// (tokenIdentity.ts:285-286); adoption lists subtree ROOTS in `shifted`, so
		// the lowering walks. 'a#[bc]d' → text 'a'[0,1], mark '#[bc]'[1,6]
		// {child 'bc'[3,5]}, text 'd'[6,7]; prepending 'X' moves all three right by
		// one and touches only 'a', so the mark stays out of `updated` and the
		// commit routes TEXT — the branch where a missed descendant is never healed
		// by a bind, and the DOM boundary layer reads `token.position.start`.
		const harness = createHarness(['#[__slot__]'])
		const {pipeline} = harness
		harness.boundary.arrive('a#[bc]d')
		harness.renderNested()
		const child = pipeline.byPath().get('1.0')
		if (!child) throw new Error('expected the slot child handle')
		expect(child.token().position).toEqual({start: 3, end: 5})

		expect(harness.splice(0, 0, 'X')).toBe(true)

		expect(pipeline.pending()).toBe(false)
		expect(pipeline.byPath().get('1')?.token().position).toEqual({start: 2, end: 7})
		expect(child.token().position).toEqual({start: 4, end: 6})
	})

	it('a mark born and killed inside one pending window is announced as neither, subtree included', () => {
		// Ports commit.spec.ts's fold-cancellation case onto a mark WITH a slot
		// child. `foldDelta` cancels BY EXACT ID, so a roots-only `added` folded
		// against the flattened `removed` would announce the child's removal to a
		// consumer that was never told it existed (commitInput.ts's TokenDelta).
		const harness = createHarness(['#[__slot__]'])
		const {pipeline} = harness
		harness.boundary.arrive('tail')
		harness.render()
		let payload: TokenDelta | undefined
		watch(pipeline.changed, delta => {
			payload = delta
		})

		harness.splice(0, 0, '#[ab]') // born: mark + slot child + the empty head text
		harness.splice(0, 5, '') // killed again, still inside the pending window
		harness.render()

		expect(payload).toEqual({added: [], removed: [], updated: []})
	})
})