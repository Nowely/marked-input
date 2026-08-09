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
 * emits `patch: false` for the same node — and the shape is provably not
 * contractual: `changes` is read in exactly one place (`commit.ts`'s
 * `commitText`), which runs only when `!render`, and an add sets `render` on
 * BOTH paths (reconcile via `tokenIdentity.ts:318`, adoption via
 * `adopt.ts:197-198`). Add entries are therefore unreachable in the only
 * consumer. What must match is what the pipeline DOES: the DOM, handle
 * identity/liveness AND the bind-generation token each handle holds, the
 * `changed` payload and count, the render-tree reference and the pending latch —
 * which is what every case below asserts, each mirroring a `commit.spec.ts` case
 * on the live lowering.
 *
 * COVERAGE SCOPE (settled at S1.5 Task 6, so S1.6a does not have to re-derive it).
 * `commit.ts` is ONE shared function and both lowerings hand it the same four
 * fields, so any pipeline behavior that does not read `tokens`/`render`/
 * `changes`/`delta` differently is identical by construction and needs no second
 * copy here. This file is nonetheless a SUPERSET of "cases where the lowering
 * could differ", because S1.6a deletes `fromReconcile` and `commit.spec.ts` with
 * it: every live case whose only gate is that file has been ported unless listed
 * below, even where the port is behaviorally redundant today.
 *
 * Deliberately NOT ported, with reasons:
 * - `commit.spec.ts:141` "touches only the changed nodes" — decorative here. It
 *   asserts an untouched handle keeps its token OBJECT; on this path `memo.roots`
 *   hands back the identical object whether or not a change entry was emitted, so
 *   it passes even against a lowering that emits every node. Over-emission is
 *   harmless for the same reason the reversal test in treeInput.spec.ts records:
 *   every entry is an absolute write.
 * - `commit.spec.ts:323` "pending() spans exactly the structural apply → rendered
 *   window" — asserted piecewise by the cold-start, mark-value, fold and text
 *   cases below.
 *
 * `commit.spec.ts:490`, `:557`, `:566` and `:730` were not ports but MOVES: they
 * have zero dependence on the lowering, so S1.6a relocated them to the bottom of
 * this file rather than duplicating them.
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
	// `leading` paints extra non-token elements ahead of the spans — the control
	// case needs one, and threading it here beats a second copy of the paint.
	const render = (...leading: HTMLElement[]) => {
		const spans = pipeline.renderTree().map(token => {
			const span = document.createElement('span')
			if (token.type === 'mark') span.append(document.createTextNode(token.value))
			return span
		})
		container.replaceChildren(...leading, ...spans)
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
		controls,
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

/**
 * A bind-generation token minus its id — the whole face `MarkController`'s
 * `value`/`meta`/`slot` getters and the DOM boundary layer read. Ids are
 * allocated per producer (reconcile's counter vs the tree's node ids), so they
 * are the one field the two paths may not share.
 */
function tokenFace(token: Token) {
	const {content, position} = token
	if (token.type !== 'mark') return {type: token.type, content, position}
	const {value, meta, slot} = token
	return {type: token.type, content, position, value, meta, slot}
}

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
		// RECORDED GAP (plan D-c), so nobody hunts for a missing assertion: this branch
		// calls `handle.refresh(token)` where it used to call `handle.update(token, path)`,
		// and NO test can discriminate the two. The routing bit is set by every add and
		// every removal, so `!render` implies every sibling list keeps its length and
		// order and every path is ALREADY equal — the dropped write was a no-op.
		// Measured, not merely argued: `commitText` was instrumented to throw when the
		// path of `token` in `latest` (located by object identity) differs from
		// `handle.path()`, and the whole core suite (862 tests) ran clean; inverting the
		// predicate tripped it 31 times, so the probe was live rather than vacuous.
		// Re-measured after the `materialized()` cutover, which widened `changes`.
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

	it('a text target whose SURFACE vanished abandons the branch and keeps the node layer current', () => {
		// Ports commit.spec.ts:456. NOT redundant with the handle-missing case above,
		// which Task 6 had recorded as covering it: `commit.ts:179` (no handle) and
		// `:181` (no surface) are distinct guards, and mutating `if (!surface) return
		// false` to `continue` kills exactly this test and its live twin, nothing else.
		const harness = createHarness()
		const {pipeline, nodes, container} = harness
		mount(harness)
		const tail = pipeline.byPath().get('2')
		if (!tail) throw new Error('expected tail handle')

		// Adapter mid-render misalignment: one span vanishes, so the bind walk bails
		// on the count mismatch — handles survive alive but UNBOUND (bind.spec
		// semantics), which is the only way to reach `commitText` with a live handle
		// and no surface.
		container.lastElementChild?.remove()
		pipeline.onRendered()
		expect(pipeline.byPath().size).toBe(0)
		expect(tail.element()).toBeUndefined()
		const changedSpy = vi.fn()
		watch(pipeline.changed, changedSpy)

		expect(harness.splice(9, 9, '!')).toBe(true)

		// Escalated: the immediate bind bails again on the misaligned DOM, but the
		// node layer is refreshed from the authoritative tree.
		expect(changedSpy).toHaveBeenCalledTimes(1)
		expect(pipeline.pending()).toBe(false)
		expect(tail.token().content).toBe('llo!')
		expect(nodes.size).toBe(3)

		harness.render()

		expect(pipeline.byPath().size).toBe(3)
		expect(container.children[2].textContent).toBe('llo!')
		expect(pipeline.byPath().get('2')).toBe(tail)
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

	it('a LENGTH-PRESERVING in-slot edit refreshes the ancestor mark handle too, exactly as the live path does', () => {
		// The fixture `snapshotMemo`'s `sameChildren` exists for ('#[ab]t' →
		// '#[cb]t'), lifted to pipeline level. The mark is in NEITHER `updated` nor
		// `shifted` and does not move, yet its projected `content` and `slot` both
		// change — the memo's child-reference comparison is the only thing that knows,
		// which is why `changes` is derived from `materialized()` rather than from the
		// transaction feeds.
		//
		// Nothing else in this suite catches it. The in-slot case above splices a
		// LONGER string, so the mark lands in `shifted` and is walked; `assertAligned`
		// is blind because bind gives a mark no `textElement` (bind.ts:162); and the
		// text branch never re-binds, so a missed refresh persists until an unrelated
		// structural commit. It reaches users: `MarkController` is exported from
		// `features/tokens/index.ts` and serves its `value`/`meta`/`slot` getters off
		// `handle.token()`.
		const harness = createHarness(['#[__slot__]'])
		const {pipeline} = harness
		harness.boundary.arrive('#[ab]t')
		harness.renderNested()
		const markHandle = pipeline.byPath().get('1')
		const childHandle = pipeline.byPath().get('1.0')
		if (!markHandle || !childHandle) throw new Error('expected the mark and its slot child')

		expect(harness.splice(2, 3, 'c')).toBe(true)

		expect(pipeline.pending()).toBe(false)
		// `liveFaces` is gone with `fromReconcile` (its own note scheduled this); the
		// measured live-path faces for '#[ab]t' → '#[cb]t' are inlined here. They are the
		// point of the case: the tree path once answered '#[ab]' / slot 'ab', and only a
		// side-by-side run said which was right. Re-measured against the helper
		// immediately before deleting it.
		expect(tokenFace(markHandle.token())).toEqual({
			type: 'mark',
			content: '#[cb]',
			position: {start: 0, end: 5},
			value: '',
			meta: undefined,
			slot: {content: 'cb', start: 2, end: 4},
		})
		expect(tokenFace(childHandle.token())).toEqual({
			type: 'text',
			content: 'cb',
			position: {start: 2, end: 4},
		})
		// The `#token` contract (TokenHandle.ts): the handle holds the generation the
		// DOM is showing, and after a text commit that IS the published tree's object.
		expect(markHandle.token()).toBe(pipeline.current()[1])
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
	// ═══ S1.5 Task 6: the bind-generation read (spec §11's named verification) ══

	it('reads DOM boundaries against BIND-GENERATION positions during the pending window', () => {
		// Inserting a mark at 0 moves 'llo' from [6,9] to [10,13] in the tree the
		// instant adoption runs — but the DOM still shows the old layout until the
		// adapter repaints. The DOM boundary layer (`tokens/boundary.ts:55`, NOT
		// `tokens/tree/boundary.ts`) resolves every offset as
		// `token.position.start + local`, reading exactly the datum asserted here, so a
		// handle that answered with the LIVE node would put the caret four characters
		// off for the whole adopt→bind window (spec D9; plan D-b).
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		expect(pipeline.byElement(text2)?.token().position).toEqual({start: 6, end: 9})

		expect(harness.splice(0, 0, '@[y]')).toBe(true)

		expect(pipeline.pending()).toBe(true)
		// The tree has moved…
		expect(pipeline.current()[4].position).toEqual({start: 10, end: 13})
		// …the painted generation has not.
		expect(pipeline.byElement(text2)?.token().position).toEqual({start: 6, end: 9})

		harness.render()

		expect(pipeline.byPath().get('4')?.token().position).toEqual({start: 10, end: 13})
	})

	// ═══ S1.5 Task 6: cases whose only other gate is commit.spec.ts ════════════
	// S1.6a deletes `fromReconcile`, and `commit.spec.ts` with it. See the
	// coverage-scope note at the top for what was deliberately left unported.

	it('a no-op splice still announces consistency without touching anything', () => {
		// Ports commit.spec.ts:187. `transactions.ts` commits a splice that changes
		// nothing, adoption diffs it to empty feeds, and the lowering must produce an
		// EMPTY text pass rather than an escalation: `render` false with no changes
		// routes `commitText([])`, which announces and returns true.
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		const treeBefore = pipeline.renderTree()
		const byPathBefore = pipeline.byPath()
		let payload: TokenDelta | undefined
		const changedSpy = vi.fn()
		watch(pipeline.changed, delta => {
			changedSpy()
			payload = delta
		})

		expect(harness.splice(9, 9, '')).toBe(true)

		expect(changedSpy).toHaveBeenCalledTimes(1)
		expect(payload).toEqual({added: [], removed: [], updated: []})
		expect(pipeline.renderTree()).toBe(treeBefore)
		expect(pipeline.byPath()).toBe(byPathBefore)
		expect(pipeline.pending()).toBe(false)
		expect(text2.textContent).toBe('llo')
	})

	it('keeps the render tree reference across N text edits and breaks it exactly once per structural edit', () => {
		// Ports commit.spec.ts:290 — D9's headline, that text edits cost the renderer
		// nothing. Sharper on this path: the memo returns a FRESH array every apply, so
		// the kept reference is control flow (only `commitStructural` writes
		// `renderTree`) rather than array identity leaking through from the producer.
		const harness = createHarness()
		const {pipeline, container} = harness
		mount(harness)
		const treeSpy = vi.fn()
		watch(pipeline.renderTree, treeSpy)
		const changedSpy = vi.fn()
		watch(pipeline.changed, changedSpy)
		const treeBefore = pipeline.renderTree()

		harness.splice(9, 9, '!')
		harness.splice(10, 10, '!')
		harness.splice(11, 11, '!')

		expect(treeSpy).toHaveBeenCalledTimes(0)
		expect(pipeline.renderTree()).toBe(treeBefore)
		expect(changedSpy).toHaveBeenCalledTimes(3)
		expect(container.children[2].textContent).toBe('llo!!!')

		harness.splice(12, 12, '@[y]')

		expect(treeSpy).toHaveBeenCalledTimes(1)
		expect(changedSpy).toHaveBeenCalledTimes(3)

		harness.render()

		expect(treeSpy).toHaveBeenCalledTimes(1)
		expect(changedSpy).toHaveBeenCalledTimes(4)
	})

	it('a re-render after a text edit re-binds the FRESH tokens, never the stale render tree', () => {
		// Ports commit.spec.ts:204. `renderTree` keeps its reference across a text edit,
		// so its tokens are the pre-edit generation; an unrelated adapter re-render must
		// bind `latest` instead, or the node layer AND the patched surface regress.
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		const seen: TokenDelta[] = []
		watch(pipeline.changed, delta => {
			seen.push(delta)
		})

		expect(harness.splice(9, 9, '!')).toBe(true)
		const handle = pipeline.byElement(text2)
		expect(handle?.token().content).toBe('llo!')

		pipeline.onRendered()

		expect(text2.textContent).toBe('llo!')
		expect(pipeline.byElement(text2)?.token().content).toBe('llo!')
		expect(pipeline.byElement(text2)).toBe(handle)
		// A re-bind with nothing pending drains an empty accumulator (commit.spec.ts:727).
		expect(seen[1]).toEqual({added: [], removed: [], updated: []})
	})

	it('an add stays quiet until bind and announces every id of the new subtree', () => {
		// Ports commit.spec.ts:228 onto a mark WITH a slot child, which also gives
		// `delta.added` its only POSITIVE pipeline-level assertion — the fold case above
		// asserts the cancellation, i.e. the empty one.
		const harness = createHarness(['#[__slot__]'])
		const {pipeline} = harness
		harness.boundary.arrive('tail')
		harness.renderNested()
		const treeBefore = pipeline.renderTree()
		let payload: TokenDelta | undefined
		const changedSpy = vi.fn()
		watch(pipeline.changed, delta => {
			changedSpy()
			payload = delta
		})

		expect(harness.splice(0, 0, '#[ab]')).toBe(true)

		expect(pipeline.renderTree()).not.toBe(treeBefore)
		expect(changedSpy).not.toHaveBeenCalled()
		expect(pipeline.pending()).toBe(true)

		harness.renderNested()

		expect(changedSpy).toHaveBeenCalledTimes(1)
		expect(pipeline.pending()).toBe(false)
		const mark = pipeline.byPath().get('1')
		const child = pipeline.byPath().get('1.0')
		if (!mark || !child) throw new Error('expected the new mark and its slot child')
		expect(payload?.added).toEqual(expect.arrayContaining([mark.id, child.id]))
	})

	it('merges the removals of every edit folded into one pending structural pass', () => {
		// Ports commit.spec.ts:662, the gate on the leak Task 2 reproduced and fixed
		// (`pendingRemovedIds = removedIds` dropped the FIRST removal, so
		// BlockController never pruned that row's BlockStore). Kept on BOTH lowerings
		// deliberately: the fold is the only pipeline state that spans applies, and
		// after S1.6a this file is its only gate.
		const harness = createHarness()
		const {pipeline} = harness
		harness.boundary.arrive('a@[x]b@[y]c')
		harness.render()
		const markX = pipeline.byPath().get('1')
		const markY = pipeline.byPath().get('3')
		if (!markX || !markY) throw new Error('expected both mark handles')
		let payload: TokenDelta | undefined
		watch(pipeline.changed, delta => {
			payload = delta
		})

		// Two structural edits, ONE bind. '@[x]' spans [1,5]; once it is gone the value
		// is 'ab@[y]c' and '@[y]' spans [2,6].
		harness.splice(1, 5, '')
		harness.splice(2, 6, '')
		harness.render()

		expect(payload?.removed).toContain(markX.id)
		expect(payload?.removed).toContain(markY.id)
	})

	it('onRendered without a container leaves the latch closed', () => {
		// Ports commit.spec.ts:374.
		const harness = createHarness()
		const {pipeline} = harness
		const changedSpy = vi.fn()
		watch(pipeline.changed, changedSpy)

		harness.boundary.arrive('he@[x]llo')
		harness.unmount()

		expect(() => pipeline.onRendered()).not.toThrow()
		expect(pipeline.pending()).toBe(true)
		expect(changedSpy).not.toHaveBeenCalled()
	})

	it('a synchronous onRendered from a changed watcher fails loud', () => {
		// Ports commit.spec.ts:525.
		const harness = createHarness()
		mount(harness)
		watch(harness.pipeline.changed, () => harness.pipeline.onRendered())

		harness.splice(2, 6, '@[y]')
		expect(() => harness.render()).toThrow(/re-entry/)
	})

	it('a synchronous arrival from a changed watcher fails loud', () => {
		// Ports commit.spec.ts:517, but through `arrive` rather than a verb, because the
		// two guards are LAYERED and the transaction one fires first: a verb called from
		// a `changed` watcher is still inside `dispatch`, so `transactions.assertIdle`
		// throws 're-entrant transaction dispatch' before the pipeline is re-entered at
		// all (gated by transactions.spec.ts:203). `arrive` is the entry point that
		// bypasses the dispatcher — a props echo — and it is what reaches the
		// pipeline's own guard.
		const harness = createHarness()
		mount(harness)
		watch(harness.pipeline.changed, () => harness.boundary.arrive('he@[x]llo!!'))

		expect(() => harness.splice(9, 9, '!')).toThrow(/re-entry/)
	})

	it('byElement resolves bound elements and isControlRoot flags control ancestry', () => {
		// Ports commit.spec.ts:742 — the read surface the DOM layer locates on.
		const harness = createHarness()
		const {pipeline, controls} = harness
		harness.boundary.arrive('he@[x]llo')
		const button = document.createElement('button')
		controls.add(button)

		const spans = harness.render(button)

		expect(pipeline.byPath().size).toBe(3)
		expect(pipeline.byElement(spans[0])).toBe(pipeline.byPath().get('0'))
		expect(pipeline.byElement(spans[1])).toBe(pipeline.byPath().get('1'))
		expect(pipeline.byElement(button)).toBeUndefined()
		expect(pipeline.isControlRoot(button)).toBe(true)
		expect(pipeline.isControlRoot(spans[0])).toBe(false)
	})

	// ═══ S1.6a: MOVED here when commit.spec.ts was deleted ═════════════════════
	// These four had no other gate. They test the pipeline itself, not a lowering,
	// so they arrive re-fixtured onto the tree harness rather than re-derived.

	it('a textChanged id absent from the new tree routes structural (conservative stale-tree guard)', () => {
		// Moved from commit.spec.ts:490 verbatim in substance: the `CommitInput` is
		// hand-built, so no lowering runs and `fromTransaction` could not produce it
		// (every id it emits came from the memo). Not the SOLE guard on
		// `commit.ts:179` — mutating that `return false` to `continue` also kills the
		// vanished-handle case above — but it is the only one that reaches the guard
		// with a stale tree instead of a deleted handle.
		const harness = createHarness()
		const {pipeline} = harness
		mount(harness)
		const changedSpy = vi.fn()
		watch(pipeline.changed, changedSpy)

		const tokens = [...pipeline.renderTree()]
		pipeline.apply({
			tokens,
			render: false,
			changes: [{id: 99999, token: tokens[0], patch: true}],
			delta: {added: [], removed: [], updated: []},
		})

		expect(changedSpy).toHaveBeenCalledTimes(1)
		expect(pipeline.pending()).toBe(false)
		expect(pipeline.renderTree()).toBe(tokens)
		expect(pipeline.byPath().size).toBe(3)
	})

	it('the structural branch self-heals corruption instead of throwing (bind rewrites every surface)', () => {
		// Moved from commit.spec.ts:557. NOT `harness.render()`: that
		// `replaceChildren()`s with FRESH spans, orphaning the node corrupted below,
		// so the heal is asserted against a detached element (measured: expected
		// 'WRONG' to be 'he'). `onRendered()` re-binds the surfaces already there,
		// which is the sequence the original was written against.
		const harness = createHarness()
		const {text1} = mount(harness)
		text1.textContent = 'WRONG'

		harness.splice(2, 6, '@[y]') // render bit set → the structural branch

		expect(() => harness.pipeline.onRendered()).not.toThrow()
		expect(text1.textContent).toBe('he')
	})

	it('normal applies and renders never throw', () => {
		// Moved from commit.spec.ts:566 — the negative twin of the divergence case.
		const harness = createHarness()
		mount(harness)

		expect(() => harness.splice(9, 9, '!')).not.toThrow()
		expect(() => harness.render()).not.toThrow()
		expect(() => harness.splice(10, 10, '@[y]')).not.toThrow()
		expect(() => harness.render()).not.toThrow()
	})

	it('removedIds() still answers, now off the payload', () => {
		// Moved from commit.spec.ts:730. `removedIds()` has no production consumer
		// left and is deleted with §4.6 item 6 in S1.6d; until then this is its gate.
		const harness = createHarness()
		const {pipeline} = harness
		mount(harness)
		const markHandle = pipeline.byPath().get('1')
		if (!markHandle) throw new Error('expected mark handle')

		harness.splice(2, 6, '')
		harness.render()

		expect(pipeline.removedIds()).toContain(markHandle.id)
	})
})