import {afterEach, describe, expect, it} from 'vitest'

import {Store} from '../../../store/Store'
import {consignRendered} from '../__testing__/mountFixtures'
import {offsetOfAnchor} from '../tree/anchors'
import type {NodeAnchor, TreeNode} from '../tree/types'

/**
 * THE window's observable contract, stated where a consumer can see it: whatever happens to a
 * caret requested between a structural apply and its bind, the caret is correct once the bind
 * lands. That invariant is what any change to the latch must preserve — it holds with the latch
 * (which refuses the request and lets the post-bind re-apply own it) and it must still hold
 * without one (where the request is attempted against the pre-paint DOM and then re-applied).
 *
 * A KEYED repaint, which the shared fixtures deliberately do not have. `mountValue` and
 * `commitPipeline.spec`'s harness both `replaceChildren(...fresh)`, so every surface is detached
 * and rebuilt on every paint — and a detached surface loses the caret. That is fine for asserting
 * what the re-place produces, and useless for asserting what it re-placed OVER. A framework keyed
 * by `node.id` moves the elements it kept; so does this.
 */
function mountKeyed(value: string) {
	const store = new Store()
	store.props.set({separator: null, defaultValue: value, options: [{markup: '@[__value__]'}], Mark: () => null})
	const container = document.createElement('div')
	document.body.append(container)
	const byId = new Map<number, HTMLElement>()

	const render = () => {
		const nodes = store.tokens.nodes()
		const desired = nodes.map(node => {
			const existing = byId.get(node.id)
			if (existing) return existing
			const created = document.createElement('span')
			byId.set(node.id, created)
			return created
		})
		const wanted = new Set<Element>(desired)
		// Backwards over the LIVE collection: removing during a forward walk skips the element
		// that slides into the freed index.
		for (let i = container.children.length - 1; i >= 0; i--) {
			const child = container.children[i]
			if (!wanted.has(child)) child.remove()
		}
		desired.forEach((element, index) => {
			// `insertBefore` with the element already in place is a no-op that would still
			// re-insert it; the guard is what keeps a kept surface attached, and the caret with it.
			if (container.children[index] !== element) {
				container.insertBefore(element, container.children[index] ?? null)
			}
		})
		// Value-only marks render their value. TEXT surfaces are the per-surface effect's to
		// write — a second writer here is exactly the divergence the effect exists to own.
		for (const node of nodes) {
			if (node.kind !== 'mark') continue
			const element = byId.get(node.id)
			if (element && element.textContent !== node.value()) element.textContent = node.value()
		}
		// The keyed pairing this renderer already holds, pushed to core the way a ref does:
		// the container's children ARE the roots in order, so the shared helper says it.
		consignRendered(store, container)
	}

	store.host.container(container)
	render()
	return {store, container, render, byId}
}

/** Where a DOM anchor sits, spelling-independent: two anchors at one boundary compare equal. */
function positionOf(roots: readonly TreeNode[], anchor: NodeAnchor | undefined): number | undefined {
	return anchor === undefined ? undefined : offsetOfAnchor(roots, anchor)
}

describe('the pending window, from a consumer', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	it('places a caret at a SURVIVING mark boundary requested mid-window, once the bind lands', () => {
		// The case a latch-free id bridge has to answer for. The mark keeps its id AND its
		// element across the commit, so mid-window its bindings are live and its boundary is a
		// PARENT coordinate — `parent.childNodes.indexOf(tokenElement)` in the pre-paint DOM,
		// where the new mark ahead of it has not been inserted yet. Whatever the request does
		// there, the position below is what the user must end up with.
		const {store, render} = mountKeyed('he@[x]llo')
		const mark = store.tokens.nodes()[1]
		expect(mark.kind).toBe('mark')

		// Structural: a mark inserted AHEAD of it, so every index after it moves.
		store.edit.replace(store.tokens.anchorAt(0), store.tokens.anchorAt(0), '@[y]')
		// Mid-window request, after the tree moved and before anything painted.
		store.tokens.selection.select({after: mark})

		render()

		const roots = store.tokens.nodes()
		expect(roots.some(node => node.id === mark.id)).toBe(true)
		expect(positionOf(roots, store.tokens.domAnchors()?.anchor)).toBe(positionOf(roots, {after: mark}))
	})

	it('keeps a caret inside a SURVIVING text surface across the window', () => {
		// The other half of "surviving": a text node whose element is kept and whose text the
		// per-surface effect already rewrote. Its offset is LOCAL, so nothing about it is stale
		// — this is the case the latch refused for no gain.
		const {store, render} = mountKeyed('he@[x]llo')
		const tail = store.tokens.nodes()[2]
		if (tail.kind !== 'text') throw new Error('expected the tail root to be a text node')

		store.edit.replace(store.tokens.anchorAt(0), store.tokens.anchorAt(0), '@[y]')
		store.tokens.selection.select({node: tail, offset: 2})

		render()

		const roots = store.tokens.nodes()
		expect(positionOf(roots, store.tokens.domAnchors()?.anchor)).toBe(positionOf(roots, {node: tail, offset: 2}))
	})

	it('places a caret into a node BORN by the commit, once the bind lands', () => {
		// Why the latch was never what made this safe: a new node has no handle in the node
		// layer at all until `bind` creates one, so the id bridge answers `undefined` by
		// ABSENCE. This is the shape `Overlay.spec`'s "restore focus after selection from
		// overlay" exercises through the adapter; here it is the mechanism.
		const {store, render} = mountKeyed('he@[x]llo')
		const before = new Set(store.tokens.nodes().map(node => node.id))

		store.edit.replace(store.tokens.anchorAt(9), store.tokens.anchorAt(9), '@[y]')

		const born = store.tokens.nodes().find(node => !before.has(node.id))
		if (!born) throw new Error('expected the commit to have added a node')
		expect(store.tokens.handle(born.id)).toBeUndefined()
		store.tokens.selection.select({after: born})

		render()

		const roots = store.tokens.nodes()
		expect(store.tokens.handle(born.id)).toBeDefined()
		expect(positionOf(roots, store.tokens.domAnchors()?.anchor)).toBe(positionOf(roots, {after: born}))
	})

	it('leaves a keyed surface attached across a structural repaint', () => {
		// The fixture's own gate. Without it the three cases above would pass against a harness
		// that rebuilds every element, where the caret is lost and re-placed no matter what the
		// id bridge answered — and they would be asserting nothing.
		const {store, render, byId} = mountKeyed('he@[x]llo')
		const tail = store.tokens.nodes()[2]
		const surface = byId.get(tail.id)
		if (!surface) throw new Error('expected a bound surface for the tail')

		store.edit.replace(store.tokens.anchorAt(0), store.tokens.anchorAt(0), '@[y]')
		render()

		expect(byId.get(tail.id)).toBe(surface)
		expect(surface.isConnected).toBe(true)
		expect(surface.textContent).toBe('llo')
	})
})