import {afterEach, describe, expect, it, vi} from 'vitest'

import {batch, watch} from '../../../shared/signals/index.js'
import {bind} from '../dom/bind'
import {createCommitPipeline} from '../dom/commit'
import type {TokenDelta} from '../dom/commit'
import type {TokenHandle} from '../dom/TokenHandle'
import {Parser} from '../parser/Parser'
import type {Markup} from '../parser/types'
import {createTransactions} from '../tree/transactions'
import {createTokenTree, joinNodes} from '../tree/tree'
import type {TreeNode} from '../tree/types'
import {createBoundary} from '../tree/valueBoundary'

/**
 * THE pipeline suite: an empty tree seeded through the boundary, edits through the
 * transaction verbs, and `onResult` handing each `TransactionResult` straight to
 * `pipeline.apply` — the same manual adapter the deleted `commit.spec.ts` used, wired to
 * the tree core. Value-only marks render their value as a bare text node, so bind never
 * descends into them.
 *
 * What the cases assert is what the pipeline DOES: the DOM, handle identity/liveness, the
 * `changed` payload and count, the renderer wake-up and the pending latch.
 *
 * S2.7 took the whole text BRANCH out of `commit.ts` — `bind` arms one effect per bound
 * text surface, so a text-only commit reaches the DOM before the pipeline is called and
 * `apply` is left with the divergence check and the announcement. S2.8 then took the
 * lowering: `treeInput.ts` and the `CommitInput` it built are gone, `apply` takes the
 * adoption result, and this file absorbed the two granularity cases that were `treeInput`
 * SPEC's alone (see the block near the end). Everything else that suite pinned was the
 * snapshot memo, which no longer exists.
 *
 * COVERAGE SCOPE (settled at S1.5 Task 6, kept as written). When S1.6a deleted
 * `commit.spec.ts`, every live case whose only gate was that file was ported or moved
 * here unless listed below, even where the port is behaviorally redundant.
 *
 * Deliberately NOT ported, with reasons:
 * - `commit.spec.ts:141` "touches only the changed nodes" — decorative here. It asserted
 *   that an untouched handle kept its token OBJECT; there is one representation now and
 *   an untouched node is the same node by construction.
 * - `commit.spec.ts:323` "pending() spans exactly the structural apply → rendered window"
 *   — asserted piecewise by the cold-start, mark-value, fold and text cases below.
 *
 * `commit.spec.ts:490`, `:557`, `:566` and `:730` were not ports but MOVES: they have zero
 * dependence on the lowering, so S1.6a relocated them to the bottom of this file rather
 * than duplicating them.
 */
/**
 * `bind` is spied THROUGH — the real implementation runs, wrapped in a counter — so the
 * cases below can assert how many times the pipeline re-bound. Nothing else in the graph
 * imports `bind`, so every call counted here is `commit.ts`'s.
 *
 * The spy exists for ONE property, "the text path performs no re-bind", which stopped
 * being observable when the pipeline's id-keyed read became `deps.nodes` itself: bind
 * mutates that map in place, so neither its identity (stable forever) nor "the same handle
 * on the same element" (what a re-bind of an unchanged node leaves behind too) can tell a
 * skipped bind from one that ran. See {@link bindCount}'s call sites.
 */
vi.mock('../dom/bind', async importOriginal => {
	// `{bind: typeof bind}` rather than `typeof import('../dom/bind')`: the module has one
	// value export, and an inline `import()` type is a lint error here.
	const actual = await importOriginal<{bind: typeof bind}>()
	return {...actual, bind: vi.fn(actual.bind)}
})

/** Re-binds since the file loaded — monotonic, so cases compare it against their own baseline. */
function bindCount(): number {
	return vi.mocked(bind).mock.calls.length
}

/**
 * The bound handle at a tree POSITION. Replaces `pipeline.byPath().get(pathKey(path))`:
 * S1.8 step 4 re-keyed the bind result on stable ids, so a case that names a node by where
 * it sits in the fixture resolves the node first and looks its handle up by id.
 *
 * It reads the NODE LAYER, filtered by `alive()`, since bind stopped returning a separate
 * id-keyed `bound` map — a per-paint copy of exactly this. Bound ⇔ alive: the walk unbinds
 * (never removes) a node whose element it missed, and deletes only ids gone from the tree.
 */
function boundAt(harness: Harness, ...path: number[]): TokenHandle | undefined {
	const node = nodeAt(harness, ...path)
	const handle = node && harness.nodes.get(node.id)
	return handle?.alive() === true ? handle : undefined
}

/** Every handle the last bind left bound — the node layer filtered by `alive()`. */
function boundHandles(harness: Harness): TokenHandle[] {
	return [...harness.nodes.values()].filter(handle => handle.alive())
}

/** The live node at a tree POSITION, or `undefined` — several cases below rely on that answer. */
function nodeAt(harness: Harness, ...path: number[]): TreeNode | undefined {
	let siblings: readonly TreeNode[] = harness.tree.roots()
	let node: TreeNode | undefined
	for (const index of path) {
		// `.at`, not `[]`: `tsconfig` leaves `noUncheckedIndexedAccess` off, so an index read
		// types as `TreeNode` and the out-of-range guard is linted away as impossible.
		const next = siblings.at(index)
		if (!next) return undefined
		node = next
		siblings = node.kind === 'mark' ? node.children() : []
	}
	return node
}

// `Markup`, NOT `string`: `Parser`'s constructor takes `(Markup | undefined)[]`
// and `Markup` is a template-literal union (parser/types.ts:63), so a
// `string[]` default fails with TS2345. Vitest stays GREEN on that — only
// `pnpm run typecheck` catches it, which is why it is in every gate.
function createHarness(markups: Markup[] = ['@[__value__]']) {
	const parser = new Parser(markups)
	const tree = createTokenTree([])
	const nodes = new Map<number, TokenHandle>()
	const controls = new Set<HTMLElement>()
	const container = document.createElement('div')
	document.body.append(container)
	let mounted: HTMLElement | null = container
	const pipeline = createCommitPipeline({
		container: () => mounted,
		nodes,
		roots: () => tree.roots(),
		controlElements: () => controls,
		childSequenceHostsFor: () => [],
		isBlock: () => false,
	})
	const boundary = createBoundary({
		tree,
		parser: () => parser,
		controlled: () => false,
		onChange: () => {},
		onResult: result => pipeline.apply(result),
	})
	const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
	// FLAT paint: a value-only mark renders its value as a bare text node, so
	// bind never descends. This is the default for every case but the slot one.
	// `leading` paints extra non-token elements ahead of the spans — the control
	// case needs one, and threading it here beats a second copy of the paint.
	const render = (...leading: HTMLElement[]) => {
		const spans = tree.roots().map(node => {
			const span = document.createElement('span')
			if (node.kind === 'mark') span.append(document.createTextNode(node.value()))
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
		const paint = (nodes: readonly TreeNode[]): HTMLElement[] =>
			nodes.map(node => {
				const span = document.createElement('span')
				if (node.kind === 'mark') span.append(...paint(node.children()))
				return span
			})
		const spans = paint(tree.roots())
		container.replaceChildren(...spans)
		pipeline.onRendered()
		return spans
	}
	const splice = (start: number, end: number, text: string) => tx.applyRange({start, end, insertedLength: 0}, text)
	return {
		pipeline,
		tree,
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
 * A node's whole observable face: its projection, its address, and — for a mark — the
 * three fields a framework component and the DOM boundary read. It was a `tokenFace` off
 * the deleted snapshot; the same facts live on the node.
 */
function nodeFace(node: TreeNode) {
	const face = {kind: node.kind, content: joinNodes([node]), position: node.range()}
	if (node.kind !== 'mark') return face
	return {...face, value: node.value(), meta: node.meta(), slot: node.slot(), slotRange: node.slotRange}
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
		expect(boundHandles(harness)).toHaveLength(3)
		expect(text1.textContent).toBe('he')
		expect(mark.textContent).toBe('x')
		expect(text2.textContent).toBe('llo')
		expect(text1.hasAttribute('contenteditable')).toBe(false)
		expect(mark.getAttribute('contenteditable')).toBe('false')
	})

	it('a tail text edit patches in place, leaves the epoch standing and announces once', () => {
		// The DOM write is the EFFECT's, not this pipeline's: by the time `apply` runs,
		// adoption's batch has already flushed it. What the pipeline still owes is the
		// order — `changed` fires only once the surface is consistent — which
		// `domAtEvent` below is the witness for.
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		const tail = boundAt(harness, 2)
		if (!tail) throw new Error('expected tail handle')
		const epochBefore = pipeline.renderEpoch()
		const bindsBefore = bindCount()
		// The counter is LIVE: the paint inside `mount` bound, so the equality below is a
		// measurement and not a vacuous 0 === 0.
		expect(bindsBefore).toBeGreaterThan(0)
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
		expect(pipeline.renderEpoch()).toBe(epochBefore)
		// NO RE-BIND, counted rather than inferred. `bind` re-arms every text effect and
		// re-walks the whole DOM, so a text path that called it would pay both per keystroke
		// — and leave the two assertions under it just as green, since it would re-bind the
		// same handle to the same element.
		expect(bindCount()).toBe(bindsBefore)
		expect(boundAt(harness, 2)).toBe(tail)
		expect(tail.element()).toBe(text2)
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
		const markHandle = boundAt(harness, 1)
		if (!markHandle) throw new Error('expected mark handle')
		const epochBefore = pipeline.renderEpoch()
		const changedSpy = vi.fn()
		watch(pipeline.changed, changedSpy)

		// '@[x]' spans [2,6]; replacing it whole is what MarkController lowers to.
		expect(harness.splice(2, 6, '@[y]')).toBe(true)

		expect(pipeline.renderEpoch()).not.toBe(epochBefore)
		expect(changedSpy).not.toHaveBeenCalled()
		expect(pipeline.pending()).toBe(true)
		expect(markHandle.element()).toBe(mark)

		harness.render()

		expect(changedSpy).toHaveBeenCalledTimes(1)
		// Handle continuity across a re-render is the pinned contract (id-keyed).
		expect(boundAt(harness, 1)).toBe(markHandle)
		expect(harness.container.children[1].textContent).toBe('y')
	})

	it('a removal routes structural and kills the handle at bind', () => {
		const harness = createHarness()
		const {pipeline, nodes} = harness
		mount(harness)
		const markHandle = boundAt(harness, 1)
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

	it('an edit landing in the pending window folds into ONE announcement', () => {
		// The fold is an ANNOUNCEMENT guard, and since S2.7 only that. It used to gate
		// the DOM too — `commitText` refused to run while a structural apply was
		// unpainted, so the surface stayed on the painted generation. The per-surface
		// effect has no such gate and writes at once, which is the behavior change of
		// this phase: the element is still bound to the same node, so showing that
		// node's new text is not a guess about a layout nobody painted.
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		const changedSpy = vi.fn()
		watch(pipeline.changed, changedSpy)

		harness.splice(2, 6, '@[y]') // render bit set → latched
		harness.splice(9, 9, '!') // a text edit against the pending tree

		expect(pipeline.pending()).toBe(true)
		expect(changedSpy).not.toHaveBeenCalled()
		// Announcement: withheld. DOM: written through, on the surface still bound.
		expect(text2.textContent).toBe('llo!')

		harness.render()

		expect(changedSpy).toHaveBeenCalledTimes(1)
		expect(harness.container.children[2].textContent).toBe('llo!')
	})

	it('a text edit against an UNBOUND node layer announces and recovers at the next paint', () => {
		// What the two deleted `commitText`-miss cases guarded, restated for the one
		// remaining path. A misaligned DOM (adapter mid-render) unbinds every handle,
		// so the edit reaches no surface at all — there is no branch left to abandon
		// and nothing to escalate. The commit still announces, and the next paint binds
		// the fresh elements, whose newly armed effects write the current text.
		const harness = createHarness()
		const {pipeline, nodes, container} = harness
		mount(harness)
		const tail = boundAt(harness, 2)
		if (!tail) throw new Error('expected tail handle')

		container.lastElementChild?.remove()
		pipeline.onRendered()
		expect(boundHandles(harness)).toHaveLength(0)
		expect(tail.element()).toBeUndefined()
		const changedSpy = vi.fn()
		watch(pipeline.changed, changedSpy)

		expect(harness.splice(9, 9, '!')).toBe(true)

		expect(changedSpy).toHaveBeenCalledTimes(1)
		expect(pipeline.pending()).toBe(false)
		expect(joinNodes([harness.tree.roots()[2]])).toBe('llo!')
		expect(nodes.size).toBe(3)

		harness.render()

		expect(boundHandles(harness)).toHaveLength(3)
		expect(container.children[2].textContent).toBe('llo!')
		expect(boundAt(harness, 2)).toBe(tail)
	})

	it('the divergence detector still throws with the NODE ID on an untouched surface', () => {
		// THE reason the detector stayed a SWEEP in S2.7 instead of folding into the
		// per-surface effect: the corrupted node is not the node this commit touches, so
		// its effect never re-runs and a check living inside it could not fire. The sweep
		// compares every bound surface against its node's live `text()`.
		const harness = createHarness()
		const {text1} = mount(harness)
		text1.textContent = 'WRONG'

		const head = boundAt(harness, 0)

		let message = ''
		try {
			harness.splice(9, 9, '!')
		} catch (e) {
			message = e instanceof Error ? e.message : String(e)
		}
		expect(message).toMatch(/TokenModel divergence/)
		expect(message).toContain(`#${head?.id}`)
		expect(message).toContain('"WRONG"')
		expect(message).toContain('"he"')
	})

	it('a BATCHED edit reaches the DOM and reports no false divergence', () => {
		// THE regression this phase nearly shipped. `EditController.replace` wraps the
		// whole write in `batch`, so the per-surface effects adoption queues do NOT flush
		// until that outer batch closes — after `apply` has returned. Measured with the
		// check called inline at the end of `apply`: every `store.edit.replace` fixture in
		// the suite threw a false divergence (13 red cases across 4 files). The check is a
		// `changed` SUBSCRIBER for that reason, queued behind the writers.
		const harness = createHarness()
		const {text2} = mount(harness)

		expect(() => batch(() => void harness.splice(9, 9, '!'))).not.toThrow()

		expect(text2.textContent).toBe('llo!')
	})

	it('the divergence detector still fires from inside a caller batch', () => {
		const harness = createHarness()
		const {text1} = mount(harness)
		text1.textContent = 'WRONG'

		expect(() => batch(() => void harness.splice(9, 9, '!'))).toThrow(/TokenModel divergence/)
	})

	it('an in-slot edit routes TEXT and patches the child surface', () => {
		// Slot harness: marks render their CHILDREN, so bind descends and the child
		// text token owns a surface. '#[ab]tail' → text ''[0,0], mark '#[ab]'[0,5]
		// {child 'ab'[2,4]}, text 'tail'[5,9].
		const harness = createHarness(['#[__slot__]'])
		const {pipeline} = harness
		harness.boundary.arrive('#[ab]tail')
		harness.renderNested()
		const childHandle = boundAt(harness, 1, 0)
		const childSurface = childHandle?.node()?.textElement
		if (!childSurface) throw new Error('expected the child surface')
		const epochBefore = pipeline.renderEpoch()

		expect(harness.splice(3, 3, 'X')).toBe(true)

		expect(pipeline.renderEpoch()).toBe(epochBefore)
		expect(pipeline.pending()).toBe(false)
		expect(childSurface.textContent).toBe('aXb')
	})

	it('a LENGTH-PRESERVING in-slot edit reaches the ancestor and the DOM with no re-render', () => {
		// `snapshotMemo`'s `sameChildren` fixture ('#[ab]t' → '#[cb]t'), and the reason
		// that memo existed: the mark is in NEITHER `updated` nor `shifted` and does not
		// move, yet its projection and its slot both change. Under the snapshot that took
		// a child-reference comparison to notice; the mark now DERIVES both from its live
		// children, so there is nothing left to invalidate — which is what this asserts.
		//
		// Nothing else in this suite catches it: the in-slot case above splices a LONGER
		// string, so the mark lands in `shifted`. `render` is false here, so no re-render
		// refreshes anything either.
		const harness = createHarness(['#[__slot__]'])
		const {pipeline} = harness
		harness.boundary.arrive('#[ab]t')
		harness.renderNested()
		const childSurface = boundAt(harness, 1, 0)?.node()?.textElement
		if (!childSurface) throw new Error('expected the slot child surface')

		expect(harness.splice(2, 3, 'c')).toBe(true)

		expect(pipeline.pending()).toBe(false)
		// The mark's OWN fields never moved; everything below is derived from the child.
		expect(nodeFace(nodeAt(harness, 1)!)).toEqual({
			kind: 'mark',
			content: '#[cb]',
			position: {start: 0, end: 5},
			value: '',
			meta: undefined,
			slot: 'cb',
			slotRange: {start: 2, end: 4},
		})
		expect(nodeFace(nodeAt(harness, 1, 0)!)).toEqual({
			kind: 'text',
			content: 'cb',
			position: {start: 2, end: 4},
		})
		// And the DOM followed, through the child's own effect — no re-bind ran.
		expect(childSurface.textContent).toBe('cb')
	})

	// Beyond the plan's case list, and both survived the first mutation run: the
	// eight cases above all passed with the lowering's two subtree walks removed
	// (now `deltaOf`'s). Each ports a `commit.spec.ts` case whose live-path behavior comes
	// from reconcile's recursion (its `collectChanges`/`collectRemovedIds`, deleted
	// at S1.6d), so a roots-only lowering is a real parity break.

	it('a shift re-materializes the descendants of a shifted mark, not just its root', () => {
		// Ports commit.spec.ts's 'shifted suffix' case to a mark WITH children.
		// Adoption lists subtree ROOTS in `shifted`, and a root's delta is NOT its
		// descendants', so the memo walks the subtree itself. 'a#[bc]d' → text 'a'[0,1],
		// mark '#[bc]'[1,6] {child 'bc'[3,5]}, text 'd'[6,7]; prepending 'X' moves all
		// three right by one and touches only 'a', so the mark stays out of `updated`
		// and `render` is false — no re-render republishes the tree.
		const harness = createHarness(['#[__slot__]'])
		const {pipeline} = harness
		harness.boundary.arrive('a#[bc]d')
		harness.renderNested()
		expect(nodeAt(harness, 1, 0)?.range()).toEqual({start: 3, end: 5})

		expect(harness.splice(0, 0, 'X')).toBe(true)

		expect(pipeline.pending()).toBe(false)
		expect(nodeAt(harness, 1)?.range()).toEqual({start: 2, end: 7})
		expect(nodeAt(harness, 1, 0)?.range()).toEqual({start: 4, end: 6})
	})

	it('a mark born and killed inside one pending window is announced as neither, subtree included', () => {
		// Ports commit.spec.ts's fold-cancellation case onto a mark WITH a slot
		// child. `foldDelta` cancels BY EXACT ID, so a roots-only `added` folded
		// against the flattened `removed` would announce the child's removal to a
		// consumer that was never told it existed (`TokenDelta`'s subtree rule).
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
	// ═══ S2.7: what replaced the bind-generation read ══════════════════════════

	it('keeps handles on the PAINTED elements through the pending window while the tree moves on', () => {
		// The deleted 'holds the BIND-GENERATION token' case asserted this through
		// `handle.token().position`. There is no second generation to read any more —
		// the tree IS the generation — so the same property is asserted where it still
		// exists: the tree moves the instant adoption runs, the node layer keeps pointing
		// at the elements the adapter actually painted, and `pending()` fails id-bridged
		// resolution closed until the repaint binds the new layout.
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		const tail = pipeline.byElement(text2)
		expect(nodeAt(harness, 2)?.range()).toEqual({start: 6, end: 9})

		expect(harness.splice(0, 0, '@[y]')).toBe(true)

		expect(pipeline.pending()).toBe(true)
		// The tree has moved…
		expect(nodeAt(harness, 4)?.range()).toEqual({start: 10, end: 13})
		// …the painted DOM has not: the same handle still owns the same element.
		expect(pipeline.byElement(text2)).toBe(tail)
		expect(tail?.element()).toBe(text2)

		harness.render()

		expect(pipeline.pending()).toBe(false)
		expect(boundAt(harness, 4)).toBe(tail)
	})

	// ═══ S1.5 Task 6: ported ahead of commit.spec.ts's deletion ════════════════
	// These had no gate outside `commit.spec.ts`, which S1.6a deleted. See the
	// coverage-scope note at the top for what was deliberately left unported.

	it('a no-op splice still announces consistency without touching anything', () => {
		// Ports commit.spec.ts:187. `transactions.ts` commits a splice that changes
		// nothing, adoption diffs it to empty feeds, and the lowering must produce an
		// EMPTY text pass rather than an escalation: `render` false with no changes
		// routes `commitText([])`, which announces and returns true.
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		const epochBefore = pipeline.renderEpoch()
		const tail = boundAt(harness, 2)
		const bindsBefore = bindCount()
		expect(bindsBefore).toBeGreaterThan(0)
		let payload: TokenDelta | undefined
		const changedSpy = vi.fn()
		watch(pipeline.changed, delta => {
			changedSpy()
			payload = delta
		})

		expect(harness.splice(9, 9, '')).toBe(true)

		expect(changedSpy).toHaveBeenCalledTimes(1)
		expect(payload).toEqual({added: [], removed: [], updated: []})
		expect(pipeline.renderEpoch()).toBe(epochBefore)
		// No re-bind either, on the path where the commit changed nothing at all.
		expect(bindCount()).toBe(bindsBefore)
		expect(boundAt(harness, 2)).toBe(tail)
		expect(tail?.element()).toBe(text2)
		expect(pipeline.pending()).toBe(false)
		expect(text2.textContent).toBe('llo')
	})

	it('leaves the epoch standing across N text edits and bumps it exactly once per structural edit', () => {
		// Ports commit.spec.ts:290 — D9's headline, that text edits cost the renderer
		// nothing. Sharper on this path: the memo returns a FRESH array every apply, so
		// the kept reference is control flow (only `commitStructural` writes
		// the epoch) rather than array identity leaking through from the producer.
		const harness = createHarness()
		const {pipeline, container} = harness
		mount(harness)
		const treeSpy = vi.fn()
		watch(pipeline.renderEpoch, treeSpy)
		const changedSpy = vi.fn()
		watch(pipeline.changed, changedSpy)
		const epochBefore = pipeline.renderEpoch()

		harness.splice(9, 9, '!')
		harness.splice(10, 10, '!')
		harness.splice(11, 11, '!')

		expect(treeSpy).toHaveBeenCalledTimes(0)
		expect(pipeline.renderEpoch()).toBe(epochBefore)
		expect(changedSpy).toHaveBeenCalledTimes(3)
		expect(container.children[2].textContent).toBe('llo!!!')

		harness.splice(12, 12, '@[y]')

		expect(treeSpy).toHaveBeenCalledTimes(1)
		expect(changedSpy).toHaveBeenCalledTimes(3)

		harness.render()

		expect(treeSpy).toHaveBeenCalledTimes(1)
		expect(changedSpy).toHaveBeenCalledTimes(4)
	})

	it('a re-render after a text edit re-binds the LIVE tree', () => {
		// Ports commit.spec.ts:204. A text edit does not wake the renderer, so an
		// unrelated re-render arriving afterwards must bind `deps.roots()` — the live tree,
		// which already carries the edit — or the node layer and the patched surface both
		// regress to the painted generation.
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		const seen: TokenDelta[] = []
		watch(pipeline.changed, delta => {
			seen.push(delta)
		})

		expect(harness.splice(9, 9, '!')).toBe(true)
		const handle = pipeline.byElement(text2)
		expect(text2.textContent).toBe('llo!')

		pipeline.onRendered()

		expect(text2.textContent).toBe('llo!')
		expect(joinNodes([harness.tree.roots()[2]])).toBe('llo!')
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
		const epochBefore = pipeline.renderEpoch()
		let payload: TokenDelta | undefined
		const changedSpy = vi.fn()
		watch(pipeline.changed, delta => {
			changedSpy()
			payload = delta
		})

		expect(harness.splice(0, 0, '#[ab]')).toBe(true)

		expect(pipeline.renderEpoch()).not.toBe(epochBefore)
		expect(changedSpy).not.toHaveBeenCalled()
		expect(pipeline.pending()).toBe(true)

		harness.renderNested()

		expect(changedSpy).toHaveBeenCalledTimes(1)
		expect(pipeline.pending()).toBe(false)
		const mark = boundAt(harness, 1)
		const child = boundAt(harness, 1, 0)
		if (!mark || !child) throw new Error('expected the new mark and its slot child')
		expect(payload?.added).toEqual(expect.arrayContaining([mark.id, child.id]))
	})

	// ═══ `deltaOf`'s granularity (moved from the deleted treeInput.spec.ts) ══════
	//
	// The two cases the lowering had to itself. Everything else that suite pinned was
	// the snapshot memo — its reuse, its cache-hit branch, its re-materialization of an
	// ancestor — and went with it; what a consumer can still observe about those edits
	// is asserted directly on the tree above.

	it('lists a node ONCE in `updated` when it is both updated and shifted', () => {
		// `shifted` is not a content signal and must not leak into the announcement.
		const harness = createHarness(['#[__slot__]'])
		const {pipeline} = harness
		harness.boundary.arrive('he#[x]llo')
		harness.renderNested()
		const tailId = nodeAt(harness, 2)?.id
		let payload: TokenDelta | undefined
		watch(pipeline.changed, delta => {
			payload = delta
		})

		expect(harness.splice(9, 9, '!')).toBe(true)

		expect(payload).toEqual({added: [], removed: [], updated: [tailId]})
	})

	it('leaves an ANCESTOR whose own fields never changed out of `updated`', () => {
		// '#[ab]t' → '#[cb]t': the mark's PROJECTION changes and its own props do not, so
		// `TokenDelta`'s per-node rule keeps it out and a consumer needing the subtree
		// re-reads the tree. Length-preserving deliberately — a longer splice would put
		// the mark in `shifted`, which this rule is about not confusing with content.
		const harness = createHarness(['#[__slot__]'])
		const {pipeline} = harness
		harness.boundary.arrive('#[ab]t')
		harness.renderNested()
		const childId = nodeAt(harness, 1, 0)?.id
		let payload: TokenDelta | undefined
		watch(pipeline.changed, delta => {
			payload = delta
		})

		expect(harness.splice(2, 3, 'c')).toBe(true)

		expect(payload).toEqual({added: [], removed: [], updated: [childId]})
		// The precondition, measured rather than assumed: the ancestor DID change.
		expect(joinNodes([nodeAt(harness, 1)!])).toBe('#[cb]')
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
		const markX = boundAt(harness, 1)
		const markY = boundAt(harness, 3)
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

		expect(boundHandles(harness)).toHaveLength(3)
		expect(pipeline.byElement(spans[0])).toBe(boundAt(harness, 0))
		expect(pipeline.byElement(spans[1])).toBe(boundAt(harness, 1))
		expect(pipeline.byElement(button)).toBeUndefined()
		expect(pipeline.isControlRoot(button)).toBe(true)
		expect(pipeline.isControlRoot(spans[0])).toBe(false)
	})

	// ═══ S1.6a: MOVED here when commit.spec.ts was deleted ═════════════════════
	// These four had no other gate. They test the pipeline itself, not a lowering,
	// so they arrive re-fixtured onto the tree harness rather than re-derived.

	it('the structural branch self-heals corruption instead of throwing (bind re-arms every effect)', () => {
		// Moved from commit.spec.ts:557. NOT `harness.render()`: that
		// `replaceChildren()`s with FRESH spans, orphaning the node corrupted below,
		// so the heal is asserted against a detached element (measured: expected
		// 'WRONG' to be 'he'). `onRendered()` re-binds the surfaces already there,
		// which is the sequence the original was written against.
		//
		// S2.7's version of the heal is the re-armed effect's IMMEDIATE first run,
		// which is why `bindElements` disposes and re-creates unconditionally rather
		// than keeping a live effect when the element is unchanged.
		const harness = createHarness()
		const {text1} = mount(harness)
		text1.textContent = 'WRONG'

		harness.splice(2, 6, '@[y]') // render bit set → the structural branch

		expect(() => harness.pipeline.onRendered()).not.toThrow()
		expect(text1.textContent).toBe('he')
	})

	it('normal applies and renders never throw', () => {
		// Moved from commit.spec.ts:566 — the negative twin of the divergence case.
		//
		// WEAK GATE, and recorded as one: no mutation in S1.6a's matrix kills this case
		// alone, because anything that makes the happy path throw takes most of this file
		// with it (probe: an unconditional throw in `apply`'s structural arm → 182 red
		// cases suite-wide, this one among them). Read it as a smoke assertion carried
		// over with its neighbours, not as a distinct guard on a mechanism.
		const harness = createHarness()
		mount(harness)

		expect(() => harness.splice(9, 9, '!')).not.toThrow()
		expect(() => harness.render()).not.toThrow()
		expect(() => harness.splice(10, 10, '@[y]')).not.toThrow()
		expect(() => harness.render()).not.toThrow()
	})
})