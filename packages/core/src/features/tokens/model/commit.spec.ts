import {afterEach, describe, expect, it, vi} from 'vitest'

import {computed, effect, watch} from '../../../shared/signals/index.js'
import {Parser} from '../parser/Parser'
import {createIdentityTracker} from '../tokenIdentity'
import {createCommitPipeline} from './commit'
import type {TokenChange, TokenHandle} from './LiveNode'

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
		pipeline.apply(result)
		return result
	}
	const render = () => {
		const spans = pipeline.tree().map(token => {
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
			expect(pipeline.tree()).toEqual([])
			expect(pipeline.pending()).toBe(false)

			const result = harness.apply('he@[x]llo')

			expect(result.changeset).toEqual({kind: 'full'})
			expect(pipeline.tree()).toBe(result.tokens)
			expect(pipeline.pending()).toBe(true)
			expect(changedSpy).not.toHaveBeenCalled()
			// Nothing painted, nothing bound: the first paint belongs to the adapter.
			expect(container.childElementCount).toBe(0)
			expect(nodes.size).toBe(0)

			const [text1, mark, text2] = harness.render()

			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(changedSpy.mock.calls[0][0]).toBe(result.changeset)
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
			const changes: TokenChange[] = []
			watch(tail.changed, change => changes.push(change))
			const changedSpy = vi.fn()
			let domAtEvent: string | null = null
			watch(pipeline.changed, changeset => {
				changedSpy(changeset)
				domAtEvent = text2.textContent
			})

			// Append '!': text 'llo' [6,9] → 'llo!' [6,10] — pure text path; the
			// adapter never re-renders, render() is deliberately not called again.
			const result = harness.apply('he@[x]llo!')

			expect(text2.textContent).toBe('llo!')
			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(changedSpy).toHaveBeenCalledWith(result.changeset)
			expect(domAtEvent).toBe('llo!')
			expect(changes).toEqual([{kind: 'text', previous: 'llo'}])
			expect(tail.text()).toBe('llo!')
			expect(tail.address()).toEqual({path: [2], token: result.tokens[2]})
			expect(text2.contentEditable).toBe('true')
			expect(pipeline.pending()).toBe(false)
		})

		it('bumps only the changed nodes: an untouched handle never recomputes and its changed stays silent', () => {
			const harness = createHarness()
			const {pipeline} = harness
			mountValue(harness)
			const he = pipeline.byPath().get('0')
			const tail = pipeline.byPath().get('2')
			if (!he || !tail) throw new Error('expected handles')

			// Evaluation counters with live effect subscribers — the adapters' shape.
			let heEvaluations = 0
			let tailEvaluations = 0
			const heProbe = computed(() => {
				heEvaluations++
				return [he.token(), he.address(), he.element(), he.text(), he.dead()] as const
			})
			const tailProbe = computed(() => {
				tailEvaluations++
				return [tail.token(), tail.address(), tail.element(), tail.text(), tail.dead()] as const
			})
			const stopHe = effect(() => void heProbe())
			const stopTail = effect(() => void tailProbe())
			expect(heEvaluations).toBe(1)
			expect(tailEvaluations).toBe(1)
			const heChanged = vi.fn()
			watch(he.changed, heChanged)
			const heDirtyBefore = he.dirty()

			harness.apply('he@[x]llo!')

			expect(tailEvaluations).toBe(2)
			expect(heEvaluations).toBe(1)
			expect(he.dirty()).toBe(heDirtyBefore)
			expect(heChanged).not.toHaveBeenCalled()

			stopHe()
			stopTail()
		})

		it('shifted suffix: positions refresh in place, paths/elements/lookups stay untouched', () => {
			const harness = createHarness()
			const {pipeline} = harness
			const {text1, mark} = mountValue(harness)
			const markHandle = pipeline.byPath().get('1')
			if (!markHandle) throw new Error('expected mark handle')
			const byPathBefore = pipeline.byPath()
			const treeBefore = pipeline.tree()
			const markChanges: TokenChange[] = []
			watch(markHandle.changed, change => markChanges.push(change))
			const changedSpy = vi.fn()
			watch(pipeline.changed, changeset => changedSpy(changeset))

			// Prepend 'XX': 'he' is textChanged, mark and tail shift right by 2.
			const result = harness.apply('XXhe@[x]llo')

			expect(text1.textContent).toBe('XXhe')
			expect(mark.textContent).toBe('x')
			expect(markHandle.token().position).toEqual({start: 4, end: 8})
			expect(markHandle.element()).toBe(mark)
			expect(markChanges).toHaveLength(1)
			expect(markChanges[0].kind).toBe('moved')
			expect(markHandle.address().path).toEqual([1])
			// O(change) producer behavior: no lookup or tree rebuilds on the text path.
			expect(pipeline.byPath()).toBe(byPathBefore)
			expect(pipeline.tree()).toBe(treeBefore)
			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(changedSpy).toHaveBeenCalledWith(result.changeset)
		})

		it('a no-op apply (empty delta) still announces consistency without touching anything', () => {
			const harness = createHarness()
			const {pipeline} = harness
			const {text2} = mountValue(harness)
			const treeBefore = pipeline.tree()
			const changedSpy = vi.fn()
			watch(pipeline.changed, changeset => changedSpy(changeset))

			harness.apply('he@[x]llo')

			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(changedSpy).toHaveBeenCalledWith({
				kind: 'delta',
				textChanged: [],
				added: [],
				removed: [],
				shifted: [],
			})
			expect(pipeline.tree()).toBe(treeBefore)
			expect(text2.textContent).toBe('llo')
		})
	})

	describe('structural branch (quiet until rendered)', () => {
		it('an added token stays quiet until onRendered: tree reference changes, changed fires only after bind', () => {
			const harness = createHarness()
			const {pipeline} = harness
			const {text2} = mountValue(harness)
			const treeBefore = pipeline.tree()
			const changedSpy = vi.fn()
			let boundAtEvent = 0
			watch(pipeline.changed, changeset => {
				changedSpy(changeset)
				boundAtEvent = pipeline.byPath().size
			})

			// Insert a second mark: added tokens — the renderer owns this change.
			const result = harness.apply('he@[x]llo@[y]')

			expect(pipeline.tree()).not.toBe(treeBefore)
			expect(pipeline.tree()).toBe(result.tokens)
			expect(changedSpy).not.toHaveBeenCalled()
			expect(text2.textContent).toBe('llo')
			expect(pipeline.pending()).toBe(true)

			harness.render()

			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(changedSpy).toHaveBeenCalledWith(result.changeset)
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
			const unmounted = vi.fn()
			watch(markHandle.changed, unmounted)
			const changedSpy = vi.fn()
			watch(pipeline.changed, changedSpy)

			// Remove the mark: 'he@[x]llo' → 'hello' (removed non-empty).
			harness.apply('hello')

			expect(changedSpy).not.toHaveBeenCalled()
			expect(markHandle.dead()).toBe(false)
			expect(pipeline.pending()).toBe(true)

			harness.render()

			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(markHandle.dead()).toBe(true)
			expect(tailHandle.dead()).toBe(true)
			expect(unmounted).toHaveBeenCalledWith({kind: 'unmounted'}, undefined)
			expect(nodes.size).toBe(1)
			expect(pipeline.byPath().get('0')?.text()).toBe('hello')
		})

		it('tree() stays reference-stable across N text applies and breaks exactly once per structural apply', () => {
			const harness = createHarness()
			const {pipeline, container} = harness
			mountValue(harness)
			const treeSpy = vi.fn()
			watch(pipeline.tree, treeSpy)
			const changedSpy = vi.fn()
			watch(pipeline.changed, changedSpy)
			const treeBefore = pipeline.tree()

			harness.apply('he@[x]llo!')
			harness.apply('he@[x]llo!!')
			harness.apply('he@[x]llo!!!')

			// Gate: text edits → 0 renderer invalidations, every edit still committed.
			expect(treeSpy).toHaveBeenCalledTimes(0)
			expect(pipeline.tree()).toBe(treeBefore)
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
			watch(pipeline.changed, changeset => changedSpy(changeset))

			harness.apply('he@[x]llo@[y]')
			const treeAfterFirst = pipeline.tree()
			// Looks like a pure text edit relative to the PENDING tree — but the node
			// layer is one generation stale, so it must fold into the latched window.
			const second = harness.apply('he@[x]llo!@[y]')

			expect(pipeline.tree()).not.toBe(treeAfterFirst)
			expect(pipeline.tree()).toBe(second.tokens)
			expect(pipeline.pending()).toBe(true)
			expect(changedSpy).not.toHaveBeenCalled()
			// Fail-closed: neither the handle nor the DOM was half-patched.
			expect(tail.text()).toBe('llo')
			expect(text2.textContent).toBe('llo')

			harness.render()

			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(changedSpy).toHaveBeenCalledWith(second.changeset)
			expect(pipeline.pending()).toBe(false)
			expect(tail.text()).toBe('llo!')
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
		it('a textChanged MARK routes structural: new tree reference, immediate bind, changed fired without a render', () => {
			const harness = createHarness()
			const {pipeline} = harness
			const {mark} = mountValue(harness)
			const markHandle = pipeline.byPath().get('1')
			if (!markHandle) throw new Error('expected mark handle')
			const treeBefore = pipeline.tree()
			const markChanges: TokenChange[] = []
			watch(markHandle.changed, change => markChanges.push(change))
			const changedSpy = vi.fn()
			watch(pipeline.changed, changeset => changedSpy(changeset))

			// '@[x]' → '@[y]': same descriptor, 1:1 slot pairing — reconcile reports
			// the MARK as textChanged with added/removed empty. Mark components
			// render value as a framework prop, so the renderer must run.
			const result = harness.apply('he@[y]llo')

			expect(pipeline.tree()).not.toBe(treeBefore)
			expect(pipeline.tree()).toBe(result.tokens)
			// Self-heal bound the current DOM immediately — no render needed first.
			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(changedSpy).toHaveBeenCalledWith(result.changeset)
			expect(pipeline.pending()).toBe(false)
			expect(markHandle.token()).toBe(result.tokens[1])
			expect(markChanges).toEqual([{kind: 'text', previous: '@[x]'}])
			expect(markHandle.element()).toBe(mark)

			// The adapter reacts to the tree change; the follow-up bind is idempotent
			// and announces a re-bind (empty delta — nothing changed token-wise).
			harness.render()

			expect(changedSpy).toHaveBeenCalledTimes(2)
			expect(changedSpy).toHaveBeenLastCalledWith({
				kind: 'delta',
				textChanged: [],
				added: [],
				removed: [],
				shifted: [],
			})
			expect(harness.container.children[1].textContent).toBe('y')
			expect(pipeline.byPath().get('1')).toBe(markHandle)
		})

		it('a textChanged id with no handle abandons the patch and self-heals through an immediate bind', () => {
			const harness = createHarness()
			const {pipeline, nodes} = harness
			const {text2} = mountValue(harness)
			const tail = pipeline.byPath().get('2')
			if (!tail) throw new Error('expected tail handle')
			// Simulate a lost projection (the old preparePatch "changed id missing"
			// case): the shell owns the map, so the seam is the map itself.
			nodes.delete(tail.id)
			const changedSpy = vi.fn()
			watch(pipeline.changed, changedSpy)

			harness.apply('he@[x]llo!')

			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(pipeline.pending()).toBe(false)
			// bind re-materialized the handle and wrote the surface itself.
			const healed = pipeline.byPath().get('2')
			expect(healed).toBeDefined()
			expect(healed?.text()).toBe('llo!')
			expect(healed?.element()).toBe(text2)
			expect(text2.textContent).toBe('llo!')
		})

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
			expect(tail.dead()).toBe(false)
			expect(tail.element()).toBeUndefined()
			const changedSpy = vi.fn()
			watch(pipeline.changed, changeset => changedSpy(changeset))

			const result = harness.apply('he@[x]llo!')

			// Escalated: the immediate bind bails again on the misaligned DOM, but
			// the node layer is refreshed from the authoritative tree.
			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(changedSpy).toHaveBeenCalledWith(result.changeset)
			expect(pipeline.pending()).toBe(false)
			expect(tail.text()).toBe('llo!')
			expect(nodes.size).toBe(3)

			// The adapter re-renders from the (new-reference) tree and heals fully.
			harness.render()
			expect(pipeline.byPath().size).toBe(3)
			expect(container.children[2].textContent).toBe('llo!')
			expect(pipeline.byPath().get('2')).toBe(tail)
		})

		it('a textChanged id absent from the new tree routes structural (conservative stale-tree guard)', () => {
			const harness = createHarness()
			const {pipeline} = harness
			mountValue(harness)
			const changedSpy = vi.fn()
			watch(pipeline.changed, changedSpy)

			const tokens = [...pipeline.tree()]
			pipeline.apply({
				tokens,
				changeset: {kind: 'delta', textChanged: [99999], added: [], removed: [], shifted: []},
			})

			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(pipeline.pending()).toBe(false)
			expect(pipeline.tree()).toBe(tokens)
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

	describe('lookups (the read surface T4 builds locate on)', () => {
		it('byElement resolves bound elements and isControlRoot flags control ancestry', () => {
			const harness = createHarness()
			const {pipeline, controls, container} = harness
			harness.apply('he@[x]llo')

			// Manual adapter render with a control alongside the token elements.
			const button = document.createElement('button')
			controls.add(button)
			const spans = pipeline.tree().map(token => {
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