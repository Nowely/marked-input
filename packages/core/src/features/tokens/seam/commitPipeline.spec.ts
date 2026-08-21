import {afterEach, describe, expect, it, vi} from 'vitest'

import {batch, watch} from '../../../shared/signals/index.js'
import {bind} from '../dom/bind'
import {createCommitPipeline} from '../dom/commit'
import {createControlRoots} from '../dom/controlRoots'
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
 * the tree core. Value-only marks render their value as a bare text node, so the fixture
 * consigns no element below them.
 *
 * What the cases assert is what the pipeline DOES: the DOM, handle identity/liveness, the
 * two CLOCKS and the renderer wake-up. Neither clock carries a payload any more, so every
 * case that was about the delta's id lists — the ledger's cancellation arithmetic, the
 * text-vs-structural announce split, the fold merging two applies into one delta — is gone
 * rather than restated.
 *
 * WHICH CLOCK a case reads follows from its own subject: `committed` fires from `apply`,
 * once per commit and including the commits that move no element, so a value or model
 * assertion reads it; `bound` fires once per BINDING — the commit's own whole-tree bind, and
 * each single-id rebind a ref drives — so a case about elements, handles or the caret reads that
 * one. Every commit therefore pulses both, and the paint that follows pulses `bound` alone.
 *
 * S2.7 took the whole text BRANCH out of `commit.ts` — `bind` arms one effect per bound
 * text surface, so a text-only commit reaches the DOM before the pipeline is called and
 * `apply` is left with the divergence check and the announcement. S2.8 then took the
 * lowering: `treeInput.ts` and the `CommitInput` it built are gone and `apply` takes the
 * adoption result. The two granularity cases this file absorbed from `treeInput.spec.ts`
 * were both about which id landed in `updated`, so the clock split took them with the
 * ledger; what a consumer can still observe about those same edits is asserted directly on
 * the tree by the in-slot cases above.
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
 *   — the accessor is gone (ADR-0008); the window is asserted through the silent DOM
 *   CLOCK by the cold-start, mark-value, fold and text cases below.
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
 * id-keyed `bound` map — a per-paint copy of exactly this. Bound ⇔ alive: bind unbinds
 * (never removes) a node no adapter consigned, and deletes only ids gone from the tree.
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
	const container = document.createElement('div')
	document.body.append(container)
	let mounted: HTMLElement | null = container
	const controls = createControlRoots(() => mounted)
	// bind takes its elements from here now, so the harness consigns what it renders.
	const consigned = new Map<number, HTMLElement>()
	const pipeline = createCommitPipeline({
		container: () => mounted,
		nodes,
		roots: () => tree.roots(),
		source: {
			tokenElement: id => consigned.get(id),
			childSequenceHost: () => undefined,
		},
	})
	const boundary = createBoundary({
		tree,
		parser: () => parser,
		controlled: () => false,
		onChange: () => {},
		onResult: () => pipeline.apply(),
	})
	const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
	// FLAT paint: a value-only mark renders its value as a bare text node, so nothing
	// below a mark is painted. This is the default for every case but the slot one.
	// `leading` paints extra non-token elements ahead of the spans — the control
	// case needs one, and threading it here beats a second copy of the paint.
	//
	// The paint CONSIGNS what it made, which is what an adapter's refs do: elements
	// reach bind through the registry, not by being found in the container. `leading`
	// belongs to no token, so it is consigned under no id. `clear()` first because
	// `replaceChildren` detaches the previous generation, whose refs would have fired null.
	const render = (...leading: HTMLElement[]) => {
		const roots = tree.roots()
		const spans = roots.map(node => {
			const span = document.createElement('span')
			if (node.kind === 'mark') span.append(document.createTextNode(node.value()))
			return span
		})
		container.replaceChildren(...leading, ...spans)
		consigned.clear()
		roots.forEach((node, index) => consigned.set(node.id, spans[index]))
		pipeline.bindNow()
		return spans
	}
	// NESTED paint, for slot markups: a mark renders its CHILDREN as spans, so each
	// child text token is consigned an element of its own and owns a surface. Same
	// recursion as createSlotHarness's `paint` at commit.spec.ts:598-606 — and it lives
	// HERE, inside createHarness, for the same reason that one does: it needs
	// `container`, `consigned` and `pipeline.bindNow()`, none of which a free
	// function has.
	const renderNested = () => {
		consigned.clear()
		const paint = (nodes: readonly TreeNode[]): HTMLElement[] =>
			nodes.map(node => {
				const span = document.createElement('span')
				consigned.set(node.id, span)
				if (node.kind === 'mark') span.append(...paint(node.children()))
				return span
			})
		const spans = paint(tree.roots())
		container.replaceChildren(...spans)
		pipeline.bindNow()
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
		/** The ref's null call for one token: its element is gone and no other takes its place. */
		deconsign: (id: number) => void consigned.delete(id),
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

	it('cold start: the seed commits at once, and binds nothing because nothing is consigned', () => {
		// BOTH clocks, because this is the case that separates them: the seed is a commit the
		// instant `arrive` returns, and every commit binds — but a bind can only name elements
		// that have been consigned, and at a cold start there are none. The DOM clock pulses;
		// the node layer stays empty. That is the distinction the split actually carries now.
		const harness = createHarness()
		const {pipeline} = harness
		const committedSpy = vi.fn()
		const boundSpy = vi.fn()
		watch(pipeline.committed, committedSpy)
		watch(pipeline.bound, boundSpy)

		harness.boundary.arrive('he@[x]llo')

		expect(committedSpy).toHaveBeenCalledTimes(1)
		expect(boundSpy).toHaveBeenCalledTimes(1)
		expect(boundHandles(harness)).toHaveLength(0)
		expect(harness.container.childElementCount).toBe(0)

		const [text1, mark, text2] = harness.render()

		expect(committedSpy).toHaveBeenCalledTimes(1)
		expect(boundSpy).toHaveBeenCalledTimes(2)
		expect(boundHandles(harness)).toHaveLength(3)
		expect(text1.textContent).toBe('he')
		expect(mark.textContent).toBe('x')
		expect(text2.textContent).toBe('llo')
		expect(text1.hasAttribute('contenteditable')).toBe(false)
		expect(mark.getAttribute('contenteditable')).toBe('false')
	})

	it('a tail text edit patches in place and commits once', () => {
		// The DOM write is the EFFECT's, not this pipeline's: by the time `apply` runs,
		// adoption's batch has already flushed it. What the pipeline still owes is the
		// order — `committed` fires only once the surface is consistent — which
		// `domAtEvent` below is the witness for.
		//
		// It binds too — every commit does — and the assertions under the splice are what that
		// costs and what it must not disturb: exactly ONE bind, the same handle, the same
		// element. An idempotent re-projection, not a new generation.
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		const tail = boundAt(harness, 2)
		if (!tail) throw new Error('expected tail handle')
		const bindsBefore = bindCount()
		// The counter is LIVE: the paint inside `mount` bound, so the equality below is a
		// measurement and not a vacuous 0 === 0.
		expect(bindsBefore).toBeGreaterThan(0)
		const committedSpy = vi.fn()
		const boundSpy = vi.fn()
		let domAtEvent: string | null = null
		watch(pipeline.committed, () => {
			committedSpy()
			domAtEvent = text2.textContent
		})
		watch(pipeline.bound, boundSpy)

		expect(harness.splice(9, 9, '!')).toBe(true)

		expect(text2.textContent).toBe('llo!')
		expect(domAtEvent).toBe('llo!')
		// ONE re-bind, counted rather than inferred — the price of the commit clock and the DOM
		// clock agreeing on every commit. It re-arms every text effect and re-projects the whole
		// registry, and the two assertions under it are what makes that safe rather than merely
		// green: the same handle, still on the same element.
		expect(bindCount()).toBe(bindsBefore + 1)
		expect(boundAt(harness, 2)).toBe(tail)
		expect(tail.element()).toBe(text2)
		expect(committedSpy).toHaveBeenCalledTimes(1)
		expect(boundSpy).toHaveBeenCalledTimes(1)
	})

	it('a mark value change commits at once even though it adds and removes nothing', () => {
		// THE commit the DOM clock cannot DESCRIBE: the id space and the element set are both
		// untouched, so the bind that follows it re-projects the very same pairing and reports
		// nothing new. Only `committed` carries the fact that anything happened, which is why the
		// model clock cannot be derived from the bind.
		const harness = createHarness()
		const {pipeline} = harness
		const {mark} = mount(harness)
		const markHandle = boundAt(harness, 1)
		if (!markHandle) throw new Error('expected mark handle')
		const committedSpy = vi.fn()
		const boundSpy = vi.fn()
		watch(pipeline.committed, committedSpy)
		watch(pipeline.bound, boundSpy)

		// '@[x]' spans [2,6]; replacing it whole is what MarkController lowers to.
		expect(harness.splice(2, 6, '@[y]')).toBe(true)

		expect(committedSpy).toHaveBeenCalledTimes(1)
		expect(boundSpy).toHaveBeenCalledTimes(1)
		expect(markHandle.element()).toBe(mark)

		harness.render()

		expect(committedSpy).toHaveBeenCalledTimes(1)
		expect(boundSpy).toHaveBeenCalledTimes(2)
		// Handle continuity across a re-render is the pinned contract (id-keyed).
		expect(boundAt(harness, 1)).toBe(markHandle)
		expect(harness.container.children[1].textContent).toBe('y')
	})

	it('a removal routes structural and kills the handle at the commit', () => {
		const harness = createHarness()
		const {nodes} = harness
		mount(harness)
		const markHandle = boundAt(harness, 1)
		if (!markHandle) throw new Error('expected mark handle')

		expect(harness.splice(2, 6, '')).toBe(true)
		// The commit binds, and the bind's kill sweep is tree-driven — so an id the tree has
		// dropped dies with the commit rather than outliving it until the next paint. That is
		// what makes the whole-tree walk worth keeping on the commit clock: the per-id path can
		// never learn about a token that no longer exists to have a ref.
		expect(markHandle.alive()).toBe(false)
		expect(nodes.size).toBe(1)

		harness.render()

		expect(markHandle.alive()).toBe(false)
		expect(nodes.size).toBe(1)
	})

	it('an edit landing before the paint writes through, and each apply binds on its own', () => {
		// The fold merges nothing: each apply is its own commit, pulses `committed` on its own
		// and binds on its own. What is left of the "window" is that the PAINT has not happened
		// yet — the elements are still the previous generation's, and both binds re-project onto
		// them rather than waiting.
		//
		// The DOM half is the S2.7 behavior change and is unaffected by the clocks: `commitText`
		// used to refuse to run while a structural apply was unpainted, so the surface stayed on
		// the painted generation. The per-surface effect has no such gate and writes at once —
		// the element is still bound to the same node, so showing that node's new text is not a
		// guess about a layout nobody painted.
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		const committedSpy = vi.fn()
		const boundSpy = vi.fn()
		watch(pipeline.committed, committedSpy)
		watch(pipeline.bound, boundSpy)

		harness.splice(2, 6, '@[y]') // structural, and unpainted
		harness.splice(9, 9, '!') // a text edit against the un-painted tree

		expect(committedSpy).toHaveBeenCalledTimes(2)
		expect(boundSpy).toHaveBeenCalledTimes(2)
		// DOM: written through before the paint, on the surface still bound.
		expect(text2.textContent).toBe('llo!')

		harness.render()

		expect(committedSpy).toHaveBeenCalledTimes(2)
		expect(boundSpy).toHaveBeenCalledTimes(3)
		expect(harness.container.children[2].textContent).toBe('llo!')
	})

	it('a text edit against an UNCONSIGNED node commits and recovers at the next paint', () => {
		// What the two deleted `commitText`-miss cases guarded, restated for the one
		// remaining path. It used to reach the unbound state by MISALIGNING the DOM, which
		// made the walk drop the whole frame; a mismatch is not representable now, so the
		// node reaches it the only way left — its element is not consigned. The edit then
		// finds no surface at all: there is no branch to abandon and nothing to escalate.
		// The commit still pulses `committed` — a missing element is not a missing commit —
		// the handle survives unbound rather than killed, and the next paint consigns a fresh
		// element whose armed effect writes the current text.
		const harness = createHarness()
		const {pipeline, nodes, container} = harness
		mount(harness)
		const tail = boundAt(harness, 2)
		if (!tail) throw new Error('expected tail handle')

		container.lastElementChild?.remove()
		harness.deconsign(tail.id)
		pipeline.bindNow()
		expect(boundAt(harness, 2)).toBeUndefined()
		expect(nodes.get(tail.id)).toBe(tail)
		expect(tail.element()).toBeUndefined()
		const committedSpy = vi.fn()
		watch(pipeline.committed, committedSpy)

		expect(harness.splice(9, 9, '!')).toBe(true)

		expect(committedSpy).toHaveBeenCalledTimes(1)
		expect(joinNodes([harness.tree.roots()[2]])).toBe('llo!')
		expect(nodes.size).toBe(3)

		harness.render()

		expect(boundHandles(harness)).toHaveLength(3)
		expect(container.children[2].textContent).toBe('llo!')
		expect(boundAt(harness, 2)).toBe(tail)
	})

	it('a surface corrupted between commits is HEALED by the next commit, not reported', () => {
		// BEHAVIOUR CHANGE, and it is the detector's own: this case used to throw
		// `TokenModel divergence` naming the untouched head surface. Once every commit binds,
		// every commit also disposes and re-arms every per-surface effect, and the re-arm's
		// first run rewrites the surface — so the corruption is gone before the sweep, which
		// runs behind the bind, ever looks.
		//
		// What that leaves of the detector is recorded rather than assumed: the class it was
		// written for — a surface the writer missed, on a node this commit never touched — is
		// no longer reachable through a commit. It is kept because "unreachable" is an argument
		// and this repo has been wrong with those; deleting it is its own step, with its own
		// evidence.
		const harness = createHarness()
		const {text1} = mount(harness)
		text1.textContent = 'WRONG'

		expect(() => harness.splice(9, 9, '!')).not.toThrow()

		expect(text1.textContent).toBe('he')
	})

	it('a BATCHED edit reaches the DOM and reports no false divergence', () => {
		// THE regression this phase nearly shipped. `EditController.replace` wraps the
		// whole write in `batch`, so the per-surface effects adoption queues do NOT flush
		// until that outer batch closes — after `apply` has returned. Measured with the
		// check called inline at the end of `apply`: every `store.edit.replace` fixture in
		// the suite threw a false divergence (13 red cases across 4 files). The check is a
		// `committed` SUBSCRIBER for that reason, queued behind the writers.
		const harness = createHarness()
		const {text2} = mount(harness)

		expect(() => batch(() => void harness.splice(9, 9, '!'))).not.toThrow()

		expect(text2.textContent).toBe('llo!')
	})

	it('the heal reaches a corrupted surface from inside a caller batch too', () => {
		// The batched twin of the case above, and the one that pins the ORDER inside a batch:
		// the bind effect and the sweep are both queued at the close, effects ahead of event
		// subscribers, so the re-arm still lands first.
		const harness = createHarness()
		const {text1} = mount(harness)
		text1.textContent = 'WRONG'

		expect(() => batch(() => void harness.splice(9, 9, '!'))).not.toThrow()

		expect(text1.textContent).toBe('he')
	})

	it('an in-slot edit routes TEXT and patches the child surface', () => {
		// Slot harness: marks render their CHILDREN, so the child text token is consigned
		// an element of its own and owns a surface. '#[ab]tail' → text ''[0,0], mark '#[ab]'[0,5]
		// {child 'ab'[2,4]}, text 'tail'[5,9].
		const harness = createHarness(['#[__slot__]'])
		harness.boundary.arrive('#[ab]tail')
		harness.renderNested()
		const childHandle = boundAt(harness, 1, 0)
		const childSurface = childHandle?.node()?.textElement
		if (!childSurface) throw new Error('expected the child surface')

		expect(harness.splice(3, 3, 'X')).toBe(true)

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
		harness.boundary.arrive('#[ab]t')
		harness.renderNested()
		const childSurface = boundAt(harness, 1, 0)?.node()?.textElement
		if (!childSurface) throw new Error('expected the slot child surface')

		expect(harness.splice(2, 3, 'c')).toBe(true)

		// "with no re-render", stated where a consumer sees it. It used to read
		// `pending() === false`, which ADR-0008 removed from the pipeline's face.
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

	// Beyond the plan's case list: a `commit.spec.ts` case whose live-path behavior came from
	// reconcile's recursion (its `collectChanges`/`collectRemovedIds`, deleted at S1.6d), so a
	// roots-only lowering is a real parity break. Its two neighbours here were the ledger's
	// born-then-edited and born-then-killed arithmetic, and went with the ledger.

	it('a shift re-materializes the descendants of a shifted mark, not just its root', () => {
		// Ports commit.spec.ts's 'shifted suffix' case to a mark WITH children.
		// Adoption lists subtree ROOTS in `shifted`, and a root's delta is NOT its
		// descendants', so the memo walks the subtree itself. 'a#[bc]d' → text 'a'[0,1],
		// mark '#[bc]'[1,6] {child 'bc'[3,5]}, text 'd'[6,7]; prepending 'X' moves all
		// three right by one and touches only 'a', so the mark stays out of `updated`
		// and `render` is false — no re-render republishes the tree.
		const harness = createHarness(['#[__slot__]'])
		harness.boundary.arrive('a#[bc]d')
		harness.renderNested()
		expect(nodeAt(harness, 1, 0)?.range()).toEqual({start: 3, end: 5})

		expect(harness.splice(0, 0, 'X')).toBe(true)

		// `render` is false: no re-render republishes the tree (was `pending() === false`).
		expect(nodeAt(harness, 1)?.range()).toEqual({start: 2, end: 7})
		expect(nodeAt(harness, 1, 0)?.range()).toEqual({start: 4, end: 6})
	})

	// ═══ S2.7: what replaced the bind-generation read ══════════════════════════

	it('keeps handles on the PAINTED elements while the tree moves on ahead of the repaint', () => {
		// The deleted 'holds the BIND-GENERATION token' case asserted this through
		// `handle.token().position`. There is no second generation to read any more —
		// the tree IS the generation — so the same property is asserted where it still
		// exists: the tree moves the instant adoption runs, and the node layer keeps pointing at
		// the elements the adapter actually painted, INCLUDING across the bind the commit itself
		// runs. That bind re-projects from the registries, which still hold the painted
		// generation, so it cannot invent the new layout either.
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		const tail = pipeline.byElement(text2)
		expect(nodeAt(harness, 2)?.range()).toEqual({start: 6, end: 9})
		const boundSpy = vi.fn()
		watch(pipeline.bound, boundSpy)

		expect(harness.splice(0, 0, '@[y]')).toBe(true)

		// The commit bound, once.
		expect(boundSpy).toHaveBeenCalledTimes(1)
		// The tree has moved…
		expect(nodeAt(harness, 4)?.range()).toEqual({start: 10, end: 13})
		// …the painted DOM has not: the same handle still owns the same element.
		expect(pipeline.byElement(text2)).toBe(tail)
		expect(tail?.element()).toBe(text2)

		harness.render()

		expect(boundSpy).toHaveBeenCalledTimes(2)
		expect(boundAt(harness, 4)).toBe(tail)
	})

	// ═══ S1.5 Task 6: ported ahead of commit.spec.ts's deletion ════════════════
	// These had no gate outside `commit.spec.ts`, which S1.6a deleted. See the
	// coverage-scope note at the top for what was deliberately left unported.

	it('a no-op splice still commits without touching anything', () => {
		// Ports commit.spec.ts:187. `transactions.ts` commits a splice that changes
		// nothing, adoption diffs it to empty feeds, and `apply` must still pulse the model
		// clock: a commit that changed nothing is a commit, and a consumer polling on it
		// re-reads the tree and finds it unmoved.
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		const tail = boundAt(harness, 2)
		const bindsBefore = bindCount()
		expect(bindsBefore).toBeGreaterThan(0)
		const committedSpy = vi.fn()
		watch(pipeline.committed, committedSpy)

		expect(harness.splice(9, 9, '')).toBe(true)

		expect(committedSpy).toHaveBeenCalledTimes(1)
		// And it binds, like every commit — a commit that changed nothing still re-projects,
		// because "nothing changed" is adoption's answer about the TREE and says nothing about
		// which elements are currently consigned.
		expect(bindCount()).toBe(bindsBefore + 1)
		expect(boundAt(harness, 2)).toBe(tail)
		expect(tail?.element()).toBe(text2)
		expect(text2.textContent).toBe('llo')
	})

	it('a re-render after a text edit re-binds the LIVE tree', () => {
		// Ports commit.spec.ts:204. A text edit does not wake the renderer, so an unrelated
		// re-render arriving afterwards must bind `deps.roots()` — the live tree, which already
		// carries the edit — or the node layer and the patched surface both regress to the
		// painted generation. The edit's own bind does not make this vacuous: the assertion is
		// about the SECOND bind, the one no commit asked for.
		const harness = createHarness()
		const {pipeline} = harness
		const {text2} = mount(harness)
		const committedSpy = vi.fn()
		const boundSpy = vi.fn()
		watch(pipeline.committed, committedSpy)
		watch(pipeline.bound, boundSpy)

		expect(harness.splice(9, 9, '!')).toBe(true)
		const handle = pipeline.byElement(text2)
		expect(text2.textContent).toBe('llo!')

		pipeline.bindNow()

		expect(text2.textContent).toBe('llo!')
		expect(joinNodes([harness.tree.roots()[2]])).toBe('llo!')
		expect(pipeline.byElement(text2)).toBe(handle)
		// The two clocks are INDEPENDENT here, which is the case's other half: the second bind
		// is one nobody committed for, and it invents no commit while pulsing the DOM clock.
		expect(boundSpy).toHaveBeenCalledTimes(2)
		expect(committedSpy).toHaveBeenCalledTimes(1)
	})

	it('an add binds the whole new subtree, and not before the paint', () => {
		// Ports commit.spec.ts:228 onto a mark WITH a slot child. The ids of the new subtree
		// are no longer announced, so the observable that replaces `delta.added` is the one it
		// was derived from: after the paint every node of the subtree HAS a live handle, and
		// before it none does — which is exactly why the caret reads this clock.
		const harness = createHarness(['#[__slot__]'])
		const {pipeline} = harness
		harness.boundary.arrive('tail')
		harness.renderNested()
		const boundSpy = vi.fn()
		watch(pipeline.bound, boundSpy)

		expect(harness.splice(0, 0, '#[ab]')).toBe(true)

		// The commit bound, and it changed nothing about the new subtree: a bind can only name
		// elements that exist, and the adapter has not painted these yet.
		expect(boundSpy).toHaveBeenCalledTimes(1)
		expect(boundAt(harness, 1)).toBeUndefined()

		harness.renderNested()

		expect(boundSpy).toHaveBeenCalledTimes(2)
		const mark = boundAt(harness, 1)
		const child = boundAt(harness, 1, 0)
		if (!mark || !child) throw new Error('expected the new mark and its slot child')
	})

	it('a bind without a container binds nothing and leaves the DOM clock silent', () => {
		// Ports commit.spec.ts:374. It read `pending() === true` until ADR-0008 took that
		// accessor off the pipeline's face; the observable half — nothing bound, no DOM
		// pulse — is what it was always gating.
		//
		// `bound`, not `committed`: the arrival IS a commit and pulses the model clock even
		// unmounted, which the first assertion pins. Only the DOM half is refused.
		const harness = createHarness()
		const {pipeline} = harness
		const committedSpy = vi.fn()
		const boundSpy = vi.fn()
		watch(pipeline.committed, committedSpy)
		watch(pipeline.bound, boundSpy)

		// UNMOUNTED FIRST, and the order is the case now: every commit binds, so arriving while
		// still mounted would pulse the DOM clock before the refusal could be observed.
		harness.unmount()
		harness.boundary.arrive('he@[x]llo')

		expect(committedSpy).toHaveBeenCalledTimes(1)
		expect(() => pipeline.bindNow()).not.toThrow()
		expect(boundSpy).not.toHaveBeenCalled()
		expect(boundHandles(harness)).toHaveLength(0)
	})

	it('a bind from a bound watcher is a second bind, not a re-entry', () => {
		// Ports commit.spec.ts:525, INVERTED by the atomic commit. `bound` used to fire from
		// inside the bind, with the pipeline's guard still closed, so a watcher calling
		// `bindNow` re-entered it and threw. Now the whole commit lands in one batch and the
		// clocks flush after it, so the same call is simply the next operation: it runs, it
		// completes, and the edit that triggered it is in the tree.
		//
		// The hazard is GONE rather than undetected — measured before this case was rewritten:
		// one watcher run, no recursion, no throw, the tree holding the edit.
		const harness = createHarness()
		mount(harness)
		let runs = 0
		watch(harness.pipeline.bound, () => {
			runs++
			if (runs < 20) harness.pipeline.bindNow()
		})

		expect(() => harness.splice(2, 6, '@[y]')).not.toThrow()
		expect(harness.tree.value()).toBe('he@[y]llo')
	})

	it('an arrival from a committed watcher is a second commit, not a re-entry', () => {
		// The mirror of the case above, through `arrive` rather than a verb: the two guards are
		// LAYERED and the transaction one still fires first for a VERB — a write called from a
		// commit watcher is refused by `transactions.assertIdle` (gated by
		// transactions.spec.ts:203), which the atomic commit does not change, because the
		// dispatcher is still on the stack. `arrive` is the entry that bypasses the dispatcher
		// — a props echo — and under the atomic commit it lands as its own commit.
		const harness = createHarness()
		mount(harness)
		let runs = 0
		watch(harness.pipeline.committed, () => {
			runs++
			if (runs < 20) harness.boundary.arrive('he@[x]llo!!')
		})

		expect(() => harness.splice(9, 9, '!')).not.toThrow()
		expect(harness.tree.value()).toBe('he@[x]llo!!')
		expect(runs).toBe(1)
	})

	it('byElement resolves bound elements and controlRoots flags control ancestry', () => {
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
		expect(controls.has(button)).toBe(true)
		expect(controls.has(spans[0])).toBe(false)
	})

	// ═══ S1.6a: MOVED here when commit.spec.ts was deleted ═════════════════════
	// These four had no other gate. They test the pipeline itself, not a lowering,
	// so they arrive re-fixtured onto the tree harness rather than re-derived.

	it('the structural branch self-heals corruption instead of throwing (bind re-arms every effect)', () => {
		// Moved from commit.spec.ts:557. NOT `harness.render()`: that
		// `replaceChildren()`s with FRESH spans, orphaning the node corrupted below,
		// so the heal is asserted against a detached element (measured: expected
		// 'WRONG' to be 'he'). A direct `bindNow()` re-binds the surfaces already there,
		// which is the sequence the original was written against.
		//
		// S2.7's version of the heal is the re-armed effect's IMMEDIATE first run,
		// which is why `bindElements` disposes and re-creates unconditionally rather
		// than keeping a live effect when the element is unchanged.
		const harness = createHarness()
		const {text1} = mount(harness)
		text1.textContent = 'WRONG'

		harness.splice(2, 6, '@[y]') // render bit set → the structural branch

		expect(() => harness.pipeline.bindNow()).not.toThrow()
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