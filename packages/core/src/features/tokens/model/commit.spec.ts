import {afterEach, describe, expect, it, vi} from 'vitest'

import {watch} from '../../../shared/signals/index.js'
import {Parser} from '../parser/Parser'
import type {Token} from '../parser/types'
import {createIdentityTracker} from '../tokenIdentity'
import {createCommitPipeline} from './commit'
import {fromReconcile} from './commitInput'
import type {TokenDelta} from './commitInput'
import type {TokenHandle} from './TokenHandle'

/**
 * Inline fixture (TokenModel.facade.spec lineage): 'he@[x]llo' parses to
 * text 'he' [0,2], mark '@[x]' [2,6], text 'llo' [6,9].
 *
 * The harness drives the pipeline exactly as the model shell (T4) will:
 * parse → reconcile → apply, plus a manual adapter that paints `tree()` and
 * reports `onRendered()`. Marks render their value as a bare text node —
 * value-only markups are childless, so bind never descends into them.
 */
function createHarness() {
	const tracker = createIdentityTracker()
	const parser = new Parser(['@[__value__]'])
	const nodes = new Map<number, TokenHandle>()
	const controls = new Set<HTMLElement>()
	const container = document.createElement('div')
	document.body.append(container)
	let mounted: HTMLElement | null = container
	const pipeline = createCommitPipeline({
		container: () => mounted,
		nodes,
		idFor: token => tracker.idFor(token),
		editableState: () => ({editable: true, readOnly: false}),
		controlElements: () => controls,
		childSequenceHostsFor: () => [],
		isBlock: () => false,
	})
	const apply = (value: string) => {
		const result = tracker.reconcile(parser.parse(value))
		pipeline.apply(fromReconcile(result))
		return result
	}
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
	const unmount = () => {
		mounted = null
	}
	return {pipeline, tracker, nodes, controls, container, apply, render, unmount}
}

type Harness = ReturnType<typeof createHarness>

function mountValue(harness: Harness, value = 'he@[x]llo') {
	harness.apply(value)
	const [text1, mark, text2] = harness.render()
	return {text1, mark, text2}
}

describe('createCommitPipeline', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	describe('cold start', () => {
		it('first apply (kind full) is structural: tree set, changed quiet until rendered, then bind completes it', () => {
			const harness = createHarness()
			const {pipeline, container, nodes} = harness
			const changedSpy = vi.fn()
			watch(pipeline.changed, changedSpy)
			expect(pipeline.renderTree()).toEqual([])
			expect(pipeline.pending()).toBe(false)

			const result = harness.apply('he@[x]llo')

			expect(result.structural).toBe(true)
			expect(result.changes.every(c => c.kind === 'add')).toBe(true)
			expect(pipeline.renderTree()).toBe(result.tokens)
			expect(pipeline.pending()).toBe(true)
			expect(changedSpy).not.toHaveBeenCalled()
			// Nothing painted, nothing bound: the first paint belongs to the adapter.
			expect(container.childElementCount).toBe(0)
			expect(nodes.size).toBe(0)

			const [text1, mark, text2] = harness.render()

			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(pipeline.pending()).toBe(false)
			expect(nodes.size).toBe(3)
			expect(pipeline.byPath().size).toBe(3)
			// bind reconciled the freshly painted surfaces (content + mount-time editable).
			expect(text1.textContent).toBe('he')
			expect(mark.textContent).toBe('x')
			expect(text2.textContent).toBe('llo')
			expect(text1.contentEditable).toBe('true')
			expect(mark.tabIndex).toBe(0)
		})
	})

	describe('text branch (patch without render)', () => {
		it('tail text edit without rendered() patches the surface in place and fires changed once, after the DOM is consistent', () => {
			const harness = createHarness()
			const {pipeline} = harness
			const {text2} = mountValue(harness)
			expect(text2.textContent).toBe('llo')

			const tail = pipeline.byPath().get('2')
			if (!tail) throw new Error('expected tail handle')
			const changedSpy = vi.fn()
			let domAtEvent: string | null = null
			watch(pipeline.changed, () => {
				changedSpy()
				domAtEvent = text2.textContent
			})

			// Append '!': text 'llo' [6,9] → 'llo!' [6,10] — pure text path; the
			// adapter never re-renders, render() is deliberately not called again.
			const result = harness.apply('he@[x]llo!')

			expect(result.structural).toBe(false)
			expect(result.changes.map(c => c.kind)).toContain('text')
			expect(text2.textContent).toBe('llo!')
			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(domAtEvent).toBe('llo!')
			expect(tail.alive()).toBe(true)
			expect(tail.token().content).toBe('llo!')
			expect(tail.path()).toEqual([2])
			expect(tail.token()).toBe(result.tokens[2])
			expect(text2.contentEditable).toBe('true')
			expect(pipeline.pending()).toBe(false)
		})

		it('touches only the changed nodes: an untouched handle keeps its token and element', () => {
			const harness = createHarness()
			const {pipeline} = harness
			mountValue(harness)
			const he = pipeline.byPath().get('0')
			const tail = pipeline.byPath().get('2')
			if (!he || !tail) throw new Error('expected handles')

			const heTokenBefore = he.token()
			const heElementBefore = he.element()
			const tailTokenBefore = tail.token()

			harness.apply('he@[x]llo!')

			// The edited tail refreshed its token in place; the untouched 'he' did not.
			expect(tail.token()).not.toBe(tailTokenBefore)
			expect(tail.token().content).toBe('llo!')
			expect(he.token()).toBe(heTokenBefore)
			expect(he.element()).toBe(heElementBefore)
		})

		it('shifted suffix: positions refresh in place, paths/elements/lookups stay untouched', () => {
			const harness = createHarness()
			const {pipeline} = harness
			const {text1, mark} = mountValue(harness)
			const markHandle = pipeline.byPath().get('1')
			if (!markHandle) throw new Error('expected mark handle')
			const byPathBefore = pipeline.byPath()
			const treeBefore = pipeline.renderTree()
			const changedSpy = vi.fn()
			watch(pipeline.changed, changedSpy)

			// Prepend 'XX': 'he' is textChanged, mark and tail shift right by 2.
			harness.apply('XXhe@[x]llo')

			expect(text1.textContent).toBe('XXhe')
			expect(mark.textContent).toBe('x')
			expect(markHandle.token().position).toEqual({start: 4, end: 8})
			expect(markHandle.element()).toBe(mark)
			expect(markHandle.path()).toEqual([1])
			// O(change) producer behavior: no lookup or tree rebuilds on the text path.
			expect(pipeline.byPath()).toBe(byPathBefore)
			expect(pipeline.renderTree()).toBe(treeBefore)
			expect(changedSpy).toHaveBeenCalledTimes(1)
		})

		it('a no-op apply (empty delta) still announces consistency without touching anything', () => {
			const harness = createHarness()
			const {pipeline} = harness
			const {text2} = mountValue(harness)
			const treeBefore = pipeline.renderTree()
			const changedSpy = vi.fn()
			watch(pipeline.changed, changedSpy)

			const result = harness.apply('he@[x]llo')

			expect(result.structural).toBe(false)
			expect(result.changes).toEqual([])
			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(pipeline.renderTree()).toBe(treeBefore)
			expect(text2.textContent).toBe('llo')
		})

		it('a re-render after a text apply re-binds the FRESH tokens, never the stale render tree', () => {
			// tree() keeps its reference across text applies — its token objects
			// are the pre-edit generation. An unrelated adapter re-render (any
			// parent update) must re-bind the reconciled tokens: binding the
			// render tree would regress the node layer AND rewrite the patched
			// surface text back to the pre-edit content.
			const harness = createHarness()
			const {pipeline} = harness
			const {text2} = mountValue(harness)

			harness.apply('he@[x]llo!')
			expect(text2.textContent).toBe('llo!')
			const handle = pipeline.byElement(text2)
			expect(handle?.token().content).toBe('llo!')

			pipeline.onRendered()

			expect(text2.textContent).toBe('llo!')
			expect(pipeline.byElement(text2)?.token().content).toBe('llo!')
			expect(pipeline.byElement(text2)).toBe(handle)
		})
	})

	describe('structural branch (quiet until rendered)', () => {
		it('an added token stays quiet until onRendered: tree reference changes, changed fires only after bind', () => {
			const harness = createHarness()
			const {pipeline} = harness
			const {text2} = mountValue(harness)
			const treeBefore = pipeline.renderTree()
			const changedSpy = vi.fn()
			let boundAtEvent = 0
			watch(pipeline.changed, () => {
				changedSpy()
				boundAtEvent = pipeline.byPath().size
			})

			// Insert a second mark: added tokens — the renderer owns this change.
			const result = harness.apply('he@[x]llo@[y]')

			expect(result.structural).toBe(true)
			expect(result.changes.some(c => c.kind === 'add')).toBe(true)
			expect(pipeline.renderTree()).not.toBe(treeBefore)
			expect(pipeline.renderTree()).toBe(result.tokens)
			expect(changedSpy).not.toHaveBeenCalled()
			expect(text2.textContent).toBe('llo')
			expect(pipeline.pending()).toBe(true)

			harness.render()

			expect(changedSpy).toHaveBeenCalledTimes(1)
			// 5 tokens: the parse tiles the whole value, so a trailing mark is
			// followed by an empty text token (inline mode keeps it).
			expect(boundAtEvent).toBe(5)
			expect(pipeline.pending()).toBe(false)
			expect(pipeline.byPath().get('3')?.token()).toBe(result.tokens[3])
		})

		it('removed tokens route structural and their handles die at bind', () => {
			const harness = createHarness()
			const {pipeline, nodes} = harness
			mountValue(harness)
			const markHandle = pipeline.byPath().get('1')
			const tailHandle = pipeline.byPath().get('2')
			if (!markHandle || !tailHandle) throw new Error('expected handles')
			const markId = markHandle.id
			const changedSpy = vi.fn()
			watch(pipeline.changed, changedSpy)

			// Remove the mark: 'he@[x]llo' → 'hello' (removed non-empty).
			const result = harness.apply('hello')

			expect(result.structural).toBe(true)
			expect(result.removedIds).toContain(markId)
			expect(changedSpy).not.toHaveBeenCalled()
			expect(markHandle.alive()).toBe(true)
			expect(pipeline.pending()).toBe(true)

			harness.render()

			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(markHandle.alive()).toBe(false)
			expect(tailHandle.alive()).toBe(false)
			expect(nodes.size).toBe(1)
			expect(pipeline.byPath().get('0')?.token().content).toBe('hello')
		})

		it('tree() stays reference-stable across N text applies and breaks exactly once per structural apply', () => {
			const harness = createHarness()
			const {pipeline, container} = harness
			mountValue(harness)
			const treeSpy = vi.fn()
			watch(pipeline.renderTree, treeSpy)
			const changedSpy = vi.fn()
			watch(pipeline.changed, changedSpy)
			const treeBefore = pipeline.renderTree()

			harness.apply('he@[x]llo!')
			harness.apply('he@[x]llo!!')
			harness.apply('he@[x]llo!!!')

			// Gate: text edits → 0 renderer invalidations, every edit still committed.
			expect(treeSpy).toHaveBeenCalledTimes(0)
			expect(pipeline.renderTree()).toBe(treeBefore)
			expect(changedSpy).toHaveBeenCalledTimes(3)
			expect(container.children[2].textContent).toBe('llo!!!')

			harness.apply('he@[x]llo!!!@[y]')

			expect(treeSpy).toHaveBeenCalledTimes(1)
			expect(changedSpy).toHaveBeenCalledTimes(3)

			harness.render()

			expect(treeSpy).toHaveBeenCalledTimes(1)
			expect(changedSpy).toHaveBeenCalledTimes(4)
		})
	})

	describe('pendingStructural latch', () => {
		it('pending() spans exactly the structural apply → rendered window', () => {
			const harness = createHarness()
			const {pipeline} = harness
			expect(pipeline.pending()).toBe(false)

			harness.apply('he@[x]llo')
			expect(pipeline.pending()).toBe(true)
			harness.render()
			expect(pipeline.pending()).toBe(false)

			harness.apply('he@[x]llo!')
			expect(pipeline.pending()).toBe(false)

			harness.apply('he@[x]llo!@[y]')
			expect(pipeline.pending()).toBe(true)
			harness.render()
			expect(pipeline.pending()).toBe(false)
		})

		it('an apply landing in the pending window folds into the structural pass (fail-closed, no half-patch)', () => {
			const harness = createHarness()
			const {pipeline} = harness
			const {text2} = mountValue(harness)
			const tail = pipeline.byPath().get('2')
			if (!tail) throw new Error('expected tail handle')
			const changedSpy = vi.fn()
			watch(pipeline.changed, changedSpy)

			harness.apply('he@[x]llo@[y]')
			const treeAfterFirst = pipeline.renderTree()
			// Looks like a pure text edit relative to the PENDING tree — but the node
			// layer is one generation stale, so it must fold into the latched window.
			const second = harness.apply('he@[x]llo!@[y]')

			expect(pipeline.renderTree()).not.toBe(treeAfterFirst)
			expect(pipeline.renderTree()).toBe(second.tokens)
			expect(pipeline.pending()).toBe(true)
			expect(changedSpy).not.toHaveBeenCalled()
			// Fail-closed: neither the handle nor the DOM was half-patched.
			expect(tail.token().content).toBe('llo')
			expect(text2.textContent).toBe('llo')

			harness.render()

			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(pipeline.pending()).toBe(false)
			expect(tail.token().content).toBe('llo!')
			expect(harness.container.children[2].textContent).toBe('llo!')
			expect(pipeline.byPath().size).toBe(5)
		})

		it('onRendered without a container leaves the latch closed', () => {
			const harness = createHarness()
			const {pipeline} = harness
			const changedSpy = vi.fn()
			watch(pipeline.changed, changedSpy)

			harness.apply('he@[x]llo')
			harness.unmount()

			expect(() => pipeline.onRendered()).not.toThrow()
			expect(pipeline.pending()).toBe(true)
			expect(changedSpy).not.toHaveBeenCalled()
		})
	})

	describe('escalation (abandon the text branch, self-heal structurally)', () => {
		// ports the old routing case: a refused-descend MARK routes structural
		it('a refused-descend MARK routes structural: new tree reference, quiet until rendered, handle survives', () => {
			const harness = createHarness()
			const {pipeline} = harness
			const {mark} = mountValue(harness)
			const markHandle = pipeline.byPath().get('1')
			if (!markHandle) throw new Error('expected mark handle')
			const treeBefore = pipeline.renderTree()
			const changedSpy = vi.fn()
			watch(pipeline.changed, changedSpy)

			// '@[x]' → '@[y]': same descriptor, same-index pairing — a value-markup
			// mark has no slot, so the deep descend is REFUSED and reconcile sets
			// result.structural directly (Phase 2: the routing decision moved out of
			// the commit-time type-walk). Mark components render value as a framework
			// prop, so the renderer must run — this is a plain structural apply that
			// waits for the adapter render; handle continuity across it (id-keyed) is
			// the pinned contract this spec guards.
			const result = harness.apply('he@[y]llo')

			expect(result.structural).toBe(true)
			expect(pipeline.renderTree()).not.toBe(treeBefore)
			expect(pipeline.renderTree()).toBe(result.tokens)
			// Quiet until the renderer paints — the renderer owns a refused-descend mark.
			expect(changedSpy).not.toHaveBeenCalled()
			expect(pipeline.pending()).toBe(true)
			expect(markHandle.element()).toBe(mark)

			// The adapter paints the new value; bind completes the structural pass.
			harness.render()

			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(pipeline.pending()).toBe(false)
			// Handle continuity: same object (id-keyed), now carrying the new token.
			expect(pipeline.byPath().get('1')).toBe(markHandle)
			expect(markHandle.alive()).toBe(true)
			expect(markHandle.token()).toBe(result.tokens[1])
			expect(harness.container.children[1].textContent).toBe('y')
		})

		// ports the old patch pass-1 case: changed id missing from the node map escalates
		it('a textChanged id with no handle abandons the patch and self-heals through an immediate bind', () => {
			const harness = createHarness()
			const {pipeline, nodes} = harness
			const {text2} = mountValue(harness)
			const tail = pipeline.byPath().get('2')
			if (!tail) throw new Error('expected tail handle')
			// Simulate a lost projection (the old pass-1 "changed id missing" case):
			// the shell owns the map, so the seam is the map itself.
			nodes.delete(tail.id)
			const changedSpy = vi.fn()
			watch(pipeline.changed, changedSpy)

			harness.apply('he@[x]llo!')

			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(pipeline.pending()).toBe(false)
			// bind re-materialized the handle and wrote the surface itself.
			const healed = pipeline.byPath().get('2')
			expect(healed).toBeDefined()
			expect(healed?.token().content).toBe('llo!')
			expect(healed?.element()).toBe(text2)
			expect(text2.textContent).toBe('llo!')
		})

		// ports the old patch pass-1 case: missing text surface escalates
		it('a text target without a surface (unbound after a DOM bail) escalates and keeps the node layer current', () => {
			const harness = createHarness()
			const {pipeline, nodes, container} = harness
			mountValue(harness)
			const tail = pipeline.byPath().get('2')
			if (!tail) throw new Error('expected tail handle')

			// Adapter mid-render misalignment: one span vanishes, the walk bails —
			// handles survive alive but unbound (bind.spec semantics).
			container.lastElementChild?.remove()
			pipeline.onRendered()
			expect(pipeline.byPath().size).toBe(0)
			// Survives in the node layer — not killed, only unbound after the bail.
			expect(tail.element()).toBeUndefined()
			const changedSpy = vi.fn()
			watch(pipeline.changed, changedSpy)

			harness.apply('he@[x]llo!')

			// Escalated: the immediate bind bails again on the misaligned DOM, but
			// the node layer is refreshed from the authoritative tree.
			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(pipeline.pending()).toBe(false)
			expect(tail.token().content).toBe('llo!')
			expect(nodes.size).toBe(3)

			// The adapter re-renders from the (new-reference) tree and heals fully.
			harness.render()
			expect(pipeline.byPath().size).toBe(3)
			expect(container.children[2].textContent).toBe('llo!')
			expect(pipeline.byPath().get('2')).toBe(tail)
		})

		// ports the old routing case: id absent from the new tree routes structural
		it('a textChanged id absent from the new tree routes structural (conservative stale-tree guard)', () => {
			const harness = createHarness()
			const {pipeline} = harness
			mountValue(harness)
			const changedSpy = vi.fn()
			watch(pipeline.changed, changedSpy)

			const tokens = [...pipeline.renderTree()]
			// A `text` change whose id has no handle abandons the text branch and
			// self-heals structurally (the conservative stale-tree guard).
			pipeline.apply(
				fromReconcile({
					tokens,
					structural: false,
					changes: [{id: 99999, token: tokens[0], path: [0], kind: 'text'}],
					removedIds: [],
				})
			)

			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(pipeline.pending()).toBe(false)
			expect(pipeline.renderTree()).toBe(tokens)
			expect(pipeline.byPath().size).toBe(3)
		})
	})

	describe('re-entry guard', () => {
		it('a synchronous apply from a changed watcher fails loud', () => {
			const harness = createHarness()
			mountValue(harness)
			watch(harness.pipeline.changed, () => harness.apply('he@[x]llo!!'))

			expect(() => harness.apply('he@[x]llo!')).toThrow(/re-entry/)
		})

		it('a synchronous onRendered from a changed watcher fails loud', () => {
			const harness = createHarness()
			mountValue(harness)
			watch(harness.pipeline.changed, () => harness.pipeline.onRendered())

			harness.apply('he@[x]llo@[y]')
			expect(() => harness.render()).toThrow(/re-entry/)
		})
	})

	describe('divergence detector', () => {
		// Black-box at this seam: the per-commit surface sweep is gone, so the text
		// branch heals only its own targets — a hand-corrupted NON-target survives
		// to the post-apply check and must throw with its path.
		// ports: patch.spec 'divergence triplet — throws with path, DOM value, model value'
		it('a text apply throws with the path when an untouched bound surface diverges', () => {
			const harness = createHarness()
			const {text1} = mountValue(harness)
			text1.textContent = 'WRONG'

			let message = ''
			try {
				harness.apply('he@[x]llo!')
			} catch (e) {
				message = e instanceof Error ? e.message : String(e)
			}
			expect(message).toMatch(/TokenModel divergence/)
			expect(message).toContain('[0]')
			expect(message).toContain('"WRONG"')
			expect(message).toContain('"he"')
		})

		it('the structural branch self-heals corruption instead of throwing (bind rewrites every surface)', () => {
			const harness = createHarness()
			const {text1} = mountValue(harness)
			text1.textContent = 'WRONG'

			expect(() => harness.pipeline.onRendered()).not.toThrow()
			expect(text1.textContent).toBe('he')
		})

		it('normal applies and renders never throw', () => {
			const harness = createHarness()
			mountValue(harness)

			expect(() => harness.apply('he@[x]llo!')).not.toThrow()
			expect(() => harness.apply('he@[x]llo!@[y]')).not.toThrow()
			expect(() => harness.render()).not.toThrow()
			expect(() => harness.pipeline.onRendered()).not.toThrow()
		})
	})

	describe('deep reconcile integration (in-slot edits ride the text path)', () => {
		// Slot harness: marks render their CHILDREN as nested spans (the real
		// adapters' shape for slot markups), so bind descends into the mark and
		// the child text token owns a text surface of its own.
		// '#[ab]tail' → text '' [0,0], mark '#[ab]' [0,5] {child text 'ab' [2,4]}, text 'tail' [5,9]
		function createSlotHarness() {
			const tracker = createIdentityTracker()
			const parser = new Parser(['#[__slot__]'])
			const nodes = new Map<number, TokenHandle>()
			const container = document.createElement('div')
			document.body.append(container)
			const pipeline = createCommitPipeline({
				container: () => container,
				nodes,
				idFor: token => tracker.idFor(token),
				editableState: () => ({editable: true, readOnly: false}),
				controlElements: () => new Set<HTMLElement>(),
				childSequenceHostsFor: () => [],
				isBlock: () => false,
			})
			const apply = (value: string) => {
				const result = tracker.reconcile(parser.parse(value))
				pipeline.apply(fromReconcile(result))
				return result
			}
			const render = () => {
				const paint = (tokens: readonly Token[]): HTMLElement[] =>
					tokens.map(token => {
						const span = document.createElement('span')
						if (token.type === 'mark') span.append(...paint(token.children))
						return span
					})
				container.replaceChildren(...paint(pipeline.renderTree()))
				pipeline.onRendered()
			}
			return {pipeline, apply, render, container}
		}

		it('an in-slot edit routes TEXT: child surface patched, tree untouched, changed once, mark handle fires text', () => {
			const harness = createSlotHarness()
			const {pipeline} = harness
			harness.apply('#[ab]tail')
			harness.render()
			const markHandle = pipeline.byPath().get('1')
			const childHandle = pipeline.byPath().get('1.0')
			const tailHandle = pipeline.byPath().get('2')
			if (!markHandle || !childHandle || !tailHandle) throw new Error('expected handles')
			const childSurface = childHandle.node()?.textElement
			if (!childSurface) throw new Error('expected child surface')
			expect(childSurface.textContent).toBe('ab')
			const markElement = markHandle.element()
			const treeBefore = pipeline.renderTree()
			const byPathBefore = pipeline.byPath()
			const changedSpy = vi.fn()
			let domAtEvent: string | null = null
			watch(pipeline.changed, () => {
				changedSpy()
				domAtEvent = childSurface.textContent
			})

			// Keystroke inside the slot: '#[ab]tail' → '#[aXb]tail'. The renderer
			// is deliberately never invoked — render() is not called again.
			const result = harness.apply('#[aXb]tail')

			// routed TEXT: no tree change, no lookup rebuilds, no pending latch
			expect(result.structural).toBe(false)
			expect(pipeline.renderTree()).toBe(treeBefore)
			expect(pipeline.byPath()).toBe(byPathBefore)
			expect(pipeline.pending()).toBe(false)
			expect(changedSpy).toHaveBeenCalledTimes(1)
			// the child surface was patched in place, before changed fired
			expect(childSurface.textContent).toBe('aXb')
			expect(domAtEvent).toBe('aXb')
			expect(childHandle.node()?.textElement).toBe(childSurface)
			expect(markHandle.element()).toBe(markElement)
			// handle-layer honesty: the in-slot edit refreshed the mark and child
			// content in place; the shifted tail stays alive at its path.
			expect(markHandle.token().content).toBe('#[aXb]')
			expect(childHandle.token().content).toBe('aXb')
			expect(tailHandle.alive()).toBe(true)
			expect(tailHandle.path()).toEqual([2])
		})
	})

	describe('changed payload (spec §2.3) and fold merging (D9)', () => {
		it('merges the removals of every apply folded into one pending structural pass', () => {
			// 'a@[x]b@[y]c' → text 'a'[0,1], mark '@[x]'[1,5], text 'b'[5,6],
			// mark '@[y]'[6,10], text 'c'[10,11] — five spans, byPath '0'..'4'.
			const harness = createHarness()
			const {pipeline} = harness
			harness.apply('a@[x]b@[y]c')
			harness.render()
			const markX = pipeline.byPath().get('1')
			const markY = pipeline.byPath().get('3')
			if (!markX || !markY) throw new Error('expected both mark handles')
			let payload: TokenDelta | undefined
			watch(pipeline.changed, delta => {
				payload = delta
			})

			// Two structural applies, ONE bind. The overwrite this replaces
			// (`pendingRemovedIds = removedIds`) dropped the FIRST removal, so
			// BlockController never pruned that row's drag state — a real leak.
			harness.apply('ab@[y]c') // drops @[x]
			harness.apply('abc') // drops @[y]
			harness.render()

			expect(payload?.removed).toContain(markX.id)
			expect(payload?.removed).toContain(markY.id)
		})

		it('a node added and removed inside one pending window is announced as neither', () => {
			const harness = createHarness()
			const {pipeline} = harness
			mountValue(harness)
			let payload: TokenDelta | undefined
			watch(pipeline.changed, delta => {
				payload = delta
			})

			harness.apply('he@[x]llo@[y]') // adds the mark and its trailing empty text
			const addedId = pipeline.renderTree()[3]?.id
			harness.apply('he@[x]llo') // takes them straight back out
			harness.render()

			// Ids are never reused, so composition is exact: a consumer that never
			// saw the node must not be told to prune it either.
			expect(addedId).toBeDefined()
			expect(payload?.added).not.toContain(addedId)
			expect(payload?.removed).not.toContain(addedId)
		})

		it('announces the edited id as updated on the text branch and nothing on a bare re-bind', () => {
			const harness = createHarness()
			const {pipeline} = harness
			mountValue(harness)
			const tail = pipeline.byPath().get('2')
			if (!tail) throw new Error('expected tail handle')
			const seen: TokenDelta[] = []
			watch(pipeline.changed, delta => {
				seen.push(delta)
			})

			harness.apply('he@[x]llo!')
			pipeline.onRendered()

			expect(seen[0].updated).toContain(tail.id)
			expect(seen[0].added).toEqual([])
			expect(seen[0].removed).toEqual([])
			// A re-bind with no pending change announces an empty delta.
			expect(seen[1]).toEqual({added: [], removed: [], updated: []})
		})

		it('removedIds() still answers, now off the payload', () => {
			const harness = createHarness()
			const {pipeline} = harness
			mountValue(harness)
			const markId = pipeline.byPath().get('1')?.id
			harness.apply('hello')
			harness.render()
			expect(pipeline.removedIds()).toContain(markId)
		})
	})

	describe('lookups (the read surface T4 builds locate on)', () => {
		it('byElement resolves bound elements and isControlRoot flags control ancestry', () => {
			const harness = createHarness()
			const {pipeline, controls, container} = harness
			harness.apply('he@[x]llo')

			// Manual adapter render with a control alongside the token elements.
			const button = document.createElement('button')
			controls.add(button)
			const spans = pipeline.renderTree().map(token => {
				const span = document.createElement('span')
				if (token.type === 'mark') span.append(document.createTextNode(token.value))
				return span
			})
			container.replaceChildren(button, ...spans)
			pipeline.onRendered()

			expect(pipeline.byPath().size).toBe(3)
			expect(pipeline.byElement(spans[0])).toBe(pipeline.byPath().get('0'))
			expect(pipeline.byElement(spans[1])).toBe(pipeline.byPath().get('1'))
			expect(pipeline.byElement(button)).toBeUndefined()
			expect(pipeline.isControlRoot(button)).toBe(true)
			expect(pipeline.isControlRoot(spans[0])).toBe(false)
		})
	})
})