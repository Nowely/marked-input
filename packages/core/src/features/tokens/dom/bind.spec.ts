import {describe, expect, it} from 'vitest'

import {markToken, textToken} from '../__testing__/tokenFactories'
import type {Token} from '../parser/types'
import {createTokenTree} from '../tree/tree'
import type {TokenTree} from '../tree/tree'
import type {TextNode, TreeNode} from '../tree/types'
import {bind} from './bind'
import type {BindInput} from './bind'
import {focusEditingHost, getCaretIndex, placeAtTextOffset} from './caret'
import type {TokenHandle} from './TokenHandle'

/**
 * Fixtures are LIVE NODES since S2.7: bind projects the tree itself, so a case
 * builds one with `createTokenTree` and edits it in place instead of minting a
 * second token generation and pinning ids across it. `buildNode` allocates from the
 * same tree-local counter, which is how a case inserts a node mid-suite.
 *
 * Ids are 1-based and depth-first (`tree.ts`'s `buildNode` allocates a mark's id
 * before recursing), so `nodes.get(1)` is the first root exactly as it was under the
 * deleted `createIds` stand-in.
 */
function treeOf(tokens: Token[]): {tree: TokenTree; roots: readonly TreeNode[]} {
	const tree = createTokenTree(tokens)
	return {tree, roots: tree.roots()}
}

function inputFor(container: HTMLElement, roots: readonly TreeNode[], overrides: Partial<BindInput> = {}): BindInput {
	return {
		container,
		roots,
		nodes: new Map<number, TokenHandle>(),
		controlElements: new Set<HTMLElement>(),
		childSequenceHostsFor: () => [],
		isBlock: false,
		...overrides,
	}
}

/** The node at a tree POSITION — the bind result is keyed by stable id, so a case resolves the node first. */
function nodeAt(roots: readonly TreeNode[], ...path: number[]): TreeNode | undefined {
	let siblings: readonly TreeNode[] = roots
	let node: TreeNode | undefined
	for (const index of path) {
		// `.at`, not `[]`: `tsconfig` leaves `noUncheckedIndexedAccess` off, so an index read
		// types as `TreeNode` and the out-of-range guard — which several cases below rely on to
		// answer `undefined` — is linted away as an impossible condition.
		const next = siblings.at(index)
		if (!next) return undefined
		node = next
		siblings = node.kind === 'mark' ? node.children() : []
	}
	return node
}

/**
 * `bind` plus the node map it mutated. There is no id-keyed `BindResult.bound` any more —
 * it was a rebuilt-every-walk copy of `input.nodes` — so the cases read the map bind owns.
 */
function bindOf(input: BindInput) {
	return {...bind(input), nodes: input.nodes}
}

/**
 * The handle THIS walk bound at a tree POSITION, or `undefined`. `alive()` is what
 * `bound.has(id)` used to be: the walk unbinds (never removes) a node the DOM missed, so a
 * surviving-but-unbound handle answers `undefined` here exactly as it did before.
 */
function at(result: ReturnType<typeof bindOf>, roots: readonly TreeNode[], ...path: number[]): TokenHandle | undefined {
	const node = nodeAt(roots, ...path)
	const handle = node === undefined ? undefined : result.nodes.get(node.id)
	return handle?.alive() === true ? handle : undefined
}

/** The node at a tree position as a TextNode — the fixtures below know their own shape. */
function textAt(roots: readonly TreeNode[], ...path: number[]): TextNode {
	const node = nodeAt(roots, ...path)
	if (node?.kind !== 'text') throw new Error('expected a text node')
	return node
}

function spanWith(content: string): HTMLElement {
	const span = document.createElement('span')
	span.textContent = content
	return span
}

/**
 * A span that counts DOM WRITES to itself. The one-writer property of S2.7 is otherwise
 * invisible: two writers agree on the value, so only the write count discriminates them.
 *
 * Counted at the DOM's level rather than at one API's. This used to trap the `textContent`
 * setter, which stopped counting anything the moment the writer gained an in-place fast path
 * (`TokenHandle`'s `writeSurface`): an ordinary edit is a `Text.replaceData` now and never
 * touches the element accessor, so the gate would have passed vacuously at zero. A
 * `MutationObserver` sees both — a replace-all as one `childList` record, an in-place splice as
 * one `characterData` record — and keeps counting a third writer nobody has thought of yet.
 *
 * `takeRecords()` is what makes it usable from a synchronous test: it drains the queue on
 * demand, so the count is readable in the same tick as the write. The callback accumulates too,
 * in case a microtask checkpoint delivers the batch first. No `disconnect`: the observer is
 * reachable only from the span it observes, so both go when the test drops it.
 */
function countingSpan(content: string): {span: HTMLElement; writes: () => number} {
	const span = spanWith(content)
	let seen = 0
	const observer = new MutationObserver(records => {
		seen += records.length
	})
	observer.observe(span, {characterData: true, childList: true, subtree: true})
	return {
		span,
		writes: () => {
			seen += observer.takeRecords().length
			return seen
		},
	}
}

describe('bind', () => {
	describe('structural walk (buildIndex semantics)', () => {
		it('binds a single inline text node to its DOM element and registers the handle', () => {
			const container = document.createElement('div')
			const span = spanWith('hello')
			container.append(span)

			const {roots} = treeOf([textToken('hello', 0)])
			const nodes = new Map<number, TokenHandle>()

			const result = bindOf(inputFor(container, roots, {nodes}))

			const handle = at(result, roots, 0)
			expect(handle).toBeDefined()
			expect(nodes.get(1)).toBe(handle)
			expect(handle?.id).toBe(roots[0].id)
			expect(handle?.element()).toBe(span)
			expect(handle?.node()).toEqual({tokenElement: span, textElement: span})
			expect(result.byElement.get(span)).toBe(handle)
		})

		it('binds inline mark sibling order', () => {
			const container = document.createElement('div')
			const before = document.createElement('span')
			const mark = document.createElement('mark')
			const after = document.createElement('span')
			container.append(before, mark, after)

			const {roots} = treeOf([textToken('hi ', 0), markToken('world', '@[world]', 3), textToken('!', 11)])

			const result = bindOf(inputFor(container, roots))

			expect(at(result, roots, 0)?.element()).toBe(before)
			expect(at(result, roots, 1)?.element()).toBe(mark)
			expect(at(result, roots, 2)?.element()).toBe(after)
			expect(at(result, roots, 1)?.node()?.textElement).toBeUndefined()
			expect(at(result, roots, 1)?.hasTextSurface()).toBe(false)
		})

		it('descends into nested mark children in place', () => {
			const container = document.createElement('div')
			const outer = document.createElement('mark')
			const innerText = document.createElement('span')
			outer.append(innerText)
			container.append(outer)

			const {roots} = treeOf([markToken('x', '@[x]', 0, [textToken('x', 0)])])

			const result = bindOf(inputFor(container, roots))

			expect(at(result, roots, 0)?.element()).toBe(outer)
			expect(at(result, roots, 0, 0)?.element()).toBe(innerText)
			expect(at(result, roots, 0, 0)?.node()?.textElement).toBe(innerText)
		})

		it('completes binding when a nested mark renders no child elements', () => {
			const container = document.createElement('div')
			const outer = document.createElement('mark')
			container.append(outer)

			const {roots} = treeOf([markToken('x', '@[x]', 0, [textToken('a', 0)])])
			const nodes = new Map<number, TokenHandle>()

			const result = bindOf(inputFor(container, roots, {nodes}))

			expect(at(result, roots, 0)?.element()).toBe(outer)
			expect(at(result, roots, 0, 0)).toBeUndefined()
			// No handle is materialized for a tree node the walk never reached.
			expect(nodes.has(2)).toBe(false)
			expect(nodes.size).toBe(1)
		})

		it('peels block-layout rows and binds the single node per row', () => {
			const container = document.createElement('div')
			const row0 = document.createElement('div')
			const tokenEl0 = document.createElement('span')
			row0.append(tokenEl0)
			const row1 = document.createElement('div')
			const tokenEl1 = document.createElement('span')
			row1.append(tokenEl1)
			container.append(row0, row1)

			const {roots} = treeOf([textToken('a', 0), textToken('b', 2)])

			const result = bindOf(inputFor(container, roots, {isBlock: true}))

			expect(at(result, roots, 0)?.element()).toBe(tokenEl0)
			expect(at(result, roots, 0)?.node()?.rowElement).toBe(row0)
			expect(at(result, roots, 1)?.element()).toBe(tokenEl1)
			expect(at(result, roots, 1)?.node()?.rowElement).toBe(row1)
			expect(result.byElement.get(row0)).toBe(at(result, roots, 0))
			expect(result.byElement.get(row1)).toBe(at(result, roots, 1))
		})

		it('treats block-row control children as non-tokens (preserves single-token-per-row invariant)', () => {
			const container = document.createElement('div')
			const row = document.createElement('div')
			const control = document.createElement('button')
			const tokenEl = document.createElement('span')
			row.append(control, tokenEl)
			container.append(row)

			const {roots} = treeOf([textToken('a', 0)])

			const result = bindOf(inputFor(container, roots, {isBlock: true, controlElements: new Set([control])}))

			expect(at(result, roots, 0)?.element()).toBe(tokenEl)
			expect(at(result, roots, 0)?.node()?.rowElement).toBe(row)
		})

		it('bails block alignment when a row has more than one non-control child (fail-loud)', () => {
			const container = document.createElement('div')
			const row0 = document.createElement('div')
			const tokenEl0 = document.createElement('span')
			row0.append(tokenEl0)
			const row1 = document.createElement('div')
			const extra1 = document.createElement('span')
			const extra2 = document.createElement('span')
			row1.append(extra1, extra2)
			container.append(row0, row1)

			const {roots} = treeOf([textToken('a', 0), textToken('b', 2)])
			const nodes = new Map<number, TokenHandle>()

			const result = bindOf(inputFor(container, roots, {isBlock: true, nodes}))

			expect(at(result, roots, 0)).toBeUndefined()
			expect(at(result, roots, 1)).toBeUndefined()
			// All-or-nothing: nothing was indexed, so no handles materialize either.
			expect(nodes.size).toBe(0)
		})

		it('drops a frame AND every descendant frame on a count mismatch', () => {
			// The all-or-nothing frame bail, asserted where it can be told apart from
			// "nothing bound at all": the ROOT frame aligns (one mark, one element) and
			// the mark's own frame does not (two children, three elements). The mark binds;
			// neither child does, and the grandchild inside the second child — whose own
			// frame WOULD align on its own — is never reached, because a dropped frame
			// never enqueues its descendants.
			//
			// MEASURED against the realistic competing design (zip the common prefix
			// instead of dropping): that mutant binds child #2 AND grandchild #4 here, and
			// is killed by 7 cases across the core suite.
			const container = document.createElement('div')
			const outer = document.createElement('mark')
			const childA = document.createElement('span')
			const childB = document.createElement('mark')
			const grandchild = document.createElement('span')
			childB.append(grandchild)
			const stray = document.createElement('span')
			outer.append(childA, childB, stray)
			container.append(outer)

			const {roots} = treeOf([
				markToken('x', '@[x]', 0, [textToken('a', 0), markToken('y', '@[y]', 1, [textToken('b', 1)])]),
			])
			const nodes = new Map<number, TokenHandle>()

			const result = bindOf(inputFor(container, roots, {nodes}))

			expect(at(result, roots, 0)?.element()).toBe(outer)
			expect(at(result, roots, 0, 0)).toBeUndefined()
			expect(at(result, roots, 0, 1)).toBeUndefined()
			expect(at(result, roots, 0, 1, 0)).toBeUndefined()
			// Only the outer mark materialized a handle, and it is the only bound one.
			expect(nodes.size).toBe(1)
			expect([...nodes.values()].filter(handle => handle.alive())).toEqual([at(result, roots, 0)])
		})

		it('skips control elements when zipping nodes with DOM children', () => {
			const container = document.createElement('div')
			const control = document.createElement('button')
			const tokenEl = document.createElement('span')
			container.append(control, tokenEl)

			const {roots} = treeOf([textToken('a', 0)])

			const result = bindOf(inputFor(container, roots, {controlElements: new Set([control])}))

			expect(at(result, roots, 0)?.element()).toBe(tokenEl)
			expect(result.byElement.get(control)).toBeUndefined()
		})

		it('treats elements containing a control as control roots', () => {
			const container = document.createElement('div')
			const wrapper = document.createElement('div')
			const control = document.createElement('button')
			wrapper.append(control)
			const tokenEl = document.createElement('span')
			container.append(wrapper, tokenEl)

			const {roots} = treeOf([textToken('a', 0)])

			const result = bindOf(inputFor(container, roots, {controlElements: new Set([control])}))

			expect(at(result, roots, 0)?.element()).toBe(tokenEl)
		})

		it('uses a registered child-sequence host as the parent for nested children', () => {
			const container = document.createElement('div')
			const outer = document.createElement('mark')
			const host = document.createElement('span')
			const innerA = document.createElement('span')
			const innerB = document.createElement('span')
			host.append(innerA, innerB)
			outer.append(host)
			container.append(outer)

			const {roots} = treeOf([markToken('x', '@[x]', 0, [textToken('a', 0), textToken('b', 1)])])

			const result = bindOf(
				inputFor(container, roots, {
					childSequenceHostsFor: ownerId => (ownerId === roots[0].id ? [host] : []),
				})
			)

			expect(at(result, roots, 0)?.node()?.childSequenceHost).toBe(host)
			expect(at(result, roots, 0, 0)?.element()).toBe(innerA)
			expect(at(result, roots, 0, 1)?.element()).toBe(innerB)
			expect(result.byElement.get(host)).toBe(at(result, roots, 0))
		})

		it('falls back to in-place descent when child-sequence host is duplicated', () => {
			const container = document.createElement('div')
			const outer = document.createElement('mark')
			const hostA = document.createElement('span')
			const hostB = document.createElement('span')
			outer.append(hostA, hostB)
			container.append(outer)

			const {roots} = treeOf([markToken('x', '@[x]', 0, [textToken('a', 0)])])

			const result = bindOf(
				inputFor(container, roots, {
					childSequenceHostsFor: ownerId => (ownerId === roots[0].id ? [hostA, hostB] : []),
				})
			)

			expect(at(result, roots, 0)?.node()?.childSequenceHost).toBeUndefined()
			expect(at(result, roots, 0, 0)).toBeUndefined()
		})

		it('returns controlRoots including controls and their ancestors up to container', () => {
			const container = document.createElement('div')
			const wrapper = document.createElement('div')
			const control = document.createElement('button')
			const tokenEl = document.createElement('span')
			wrapper.append(control)
			container.append(wrapper, tokenEl)

			const {roots} = treeOf([textToken('hi', 0)])

			const result = bindOf(inputFor(container, roots, {controlElements: new Set([control])}))

			expect(result.controlRoots.has(control)).toBe(true)
			expect(result.controlRoots.has(wrapper)).toBe(true)
			expect(result.controlRoots.has(container)).toBe(false)
		})

		it('ignores a child-sequence host registered outside its owner mark element', () => {
			const container = document.createElement('div')
			const leading = document.createElement('span')
			const outer = document.createElement('mark')
			const trailing = document.createElement('span')
			const outsideHost = document.createElement('span')
			leading.append(outsideHost)
			container.append(leading, outer, trailing)

			const {roots} = treeOf([
				textToken('a', 0),
				markToken('x', '@[x]', 1, [textToken('b', 1)]),
				textToken('c', 5),
			])

			const result = bindOf(
				inputFor(container, roots, {
					childSequenceHostsFor: ownerId => (ownerId === roots[1].id ? [outsideHost] : []),
				})
			)

			expect(at(result, roots, 0)?.element()).toBe(leading)
			expect(at(result, roots, 1)?.element()).toBe(outer)
			expect(at(result, roots, 1)?.node()?.childSequenceHost).toBeUndefined()
			expect(at(result, roots, 2)?.element()).toBe(trailing)
			expect(at(result, roots, 1, 0)).toBeUndefined()
		})
	})

	describe('node map lifecycle', () => {
		it('reuses the handle across binds, updating elements in place', () => {
			const container = document.createElement('div')
			container.append(spanWith('hello'))
			const {roots} = treeOf([textToken('hello', 0)])
			const nodes = new Map<number, TokenHandle>()

			bindOf(inputFor(container, roots, {nodes}))
			const handle = nodes.get(1)
			if (!handle) throw new Error('expected handle for id 1')

			// Structural re-render: the node's text moved and the adapter repainted.
			textAt(roots, 0).text('hello!')
			const renderedSpan = spanWith('stale')
			container.replaceChildren(renderedSpan)

			const result = bindOf(inputFor(container, roots, {nodes}))

			expect(nodes.size).toBe(1)
			expect(nodes.get(1)).toBe(handle)
			expect(at(result, roots, 0)).toBe(handle)
			expect(result.byElement.get(renderedSpan)).toBe(handle)
			expect(handle.element()).toBe(renderedSpan)
			expect(renderedSpan.textContent).toBe('hello!')
		})

		it('rebinds when a node shifts to a new position', () => {
			const container = document.createElement('div')
			container.append(spanWith('alpha '), spanWith('beta'))
			const {tree, roots} = treeOf([textToken('alpha ', 0), textToken('beta', 6)])
			const nodes = new Map<number, TokenHandle>()

			bindOf(inputFor(container, roots, {nodes}))
			const handleB = nodes.get(2)
			if (!handleB) throw new Error('expected handle for id 2')

			// A node is prepended: `beta` keeps its identity and shifts one slot right.
			const inserted = tree.buildNode(textToken('x ', 0))
			const spanB2 = spanWith('beta')
			container.replaceChildren(spanWith('x '), spanWith('alpha '), spanB2)

			const result = bindOf(inputFor(container, [inserted, ...roots], {nodes}))

			expect(at(result, [inserted, ...roots], 2)).toBe(handleB)
			expect(handleB.element()).toBe(spanB2)
		})

		it('kills and removes handles whose ids are absent from the new tree', () => {
			const container = document.createElement('div')
			const spanA = spanWith('alpha ')
			container.append(spanA, spanWith('beta'))
			const {roots} = treeOf([textToken('alpha ', 0), textToken('beta', 6)])
			const nodes = new Map<number, TokenHandle>()

			bindOf(inputFor(container, roots, {nodes}))
			const handleA = nodes.get(1)
			const handleB = nodes.get(2)
			if (!handleA || !handleB) throw new Error('expected handles for both ids')

			container.replaceChildren(spanA)
			bindOf(inputFor(container, roots.slice(0, 1), {nodes}))

			expect(handleB.alive()).toBe(false)
			expect(nodes.has(2)).toBe(false)
			expect(nodes.size).toBe(1)
			expect(handleA.alive()).toBe(true)
			expect(handleA.element()).toBe(spanA)
		})

		it('keeps handles alive but unbound when the DOM walk bails (transient misalignment)', () => {
			// DELIBERATE DIVERGENCE from the old TokenModel: #syncHandles killed every
			// handle whose id vanished from #byId, and on a bail #byId was empty — a
			// transiently misaligned DOM (adapter mid-render) killed all handles.
			// Here only ids genuinely absent from the TREE die; on a bail the nodes
			// keep their identity and lose only their element bindings.
			const container = document.createElement('div')
			container.append(spanWith('alpha '), spanWith('beta'))
			const {roots} = treeOf([textToken('alpha ', 0), textToken('beta', 6)])
			const nodes = new Map<number, TokenHandle>()

			bindOf(inputFor(container, roots, {nodes}))
			const handleA = nodes.get(1)
			const handleB = nodes.get(2)
			if (!handleA || !handleB) throw new Error('expected handles for both ids')

			// New generation (text grew), but the DOM is misaligned: one element, two nodes.
			textAt(roots, 0).text('alpha! ')
			container.replaceChildren(spanWith('alpha! '))

			bindOf(inputFor(container, roots, {nodes}))

			// Nothing bound: the walk dropped the frame.
			expect([...nodes.values()].some(handle => handle.alive())).toBe(false)
			// Both handles survive in the node map — not killed, only unbound.
			expect(nodes.size).toBe(2)
			expect(handleA.element()).toBeUndefined()
			expect(handleB.element()).toBeUndefined()
			expect(handleA.node()).toBeUndefined()
		})

		it('keeps an existing handle alive and current when its subtree goes unrendered', () => {
			const container = document.createElement('div')
			const outer = document.createElement('mark')
			outer.append(spanWith('a'))
			container.append(outer)
			const {roots} = treeOf([markToken('x', '@[x]', 0, [textToken('a', 0)])])
			const nodes = new Map<number, TokenHandle>()

			bindOf(inputFor(container, roots, {nodes}))
			const child = nodes.get(2)
			if (!child) throw new Error('expected child handle')
			expect(child.element()).toBeDefined()

			// Next render: the mark renders no child elements, but the child node is
			// still in the tree — its handle must survive, unbound and alive.
			textAt(roots, 0, 0).text('b')
			outer.replaceChildren()

			const result = bindOf(inputFor(container, roots, {nodes}))

			expect(at(result, roots, 0)).toBeDefined()
			expect(at(result, roots, 0, 0)).toBeUndefined()
			// The child survives in the node map — not killed, only unbound.
			expect(nodes.has(2)).toBe(true)
			expect(child.element()).toBeUndefined()
		})
	})

	describe('one-host mount state', () => {
		it('text surfaces carry NO contenteditable attribute; value-only mark roots are ce=false without tabindex', () => {
			const container = document.createElement('div')
			const before = spanWith('hi ')
			// An adapter that renders the attribute itself (or a surface bound under the old
			// policy): the text arm has to STRIP it, not merely decline to write one.
			before.contentEditable = 'true'
			const mark = document.createElement('mark')
			// A mark root the previous policy left as a tab stop: the attribute must go.
			mark.tabIndex = 0
			const after = spanWith('!')
			container.append(before, mark, after)

			const {roots} = treeOf([textToken('hi ', 0), markToken('world', '@[world]', 3), textToken('!', 11)])

			bindOf(inputFor(container, roots))

			for (const span of [before, after]) {
				expect(span.hasAttribute('contenteditable')).toBe(false)
			}
			expect(mark.getAttribute('contenteditable')).toBe('false')
			expect(mark.hasAttribute('tabindex')).toBe(false)
		})

		it('a slot mark leaves root and host BARE and freezes only the chrome beside them', () => {
			// The slot lives in the ONE editing host: a nested `contenteditable=true` here
			// would be a `display: contents` host in both adapters — boxless, unfocusable,
			// and Chromium fires no beforeinput for it. Atomicity is the chrome's, not the
			// slot's, so the sweep walks host→root and freezes what hangs off that path.
			const container = document.createElement('div')
			const outer = document.createElement('mark')
			const label = spanWith('@')
			const wrapper = document.createElement('span')
			const badge = spanWith('!')
			const host = document.createElement('span')
			const inner = spanWith('a')
			host.append(inner)
			wrapper.append(badge, host)
			outer.append(label, wrapper)
			container.append(outer)

			const {roots} = treeOf([markToken('x', '@[x]', 0, [textToken('a', 0)])])

			bindOf(
				inputFor(container, roots, {
					childSequenceHostsFor: ownerId => (ownerId === roots[0].id ? [host] : []),
				})
			)

			// On the path: nothing written, so the container's editability reaches the slot.
			expect(outer.hasAttribute('contenteditable')).toBe(false)
			expect(wrapper.hasAttribute('contenteditable')).toBe(false)
			expect(host.hasAttribute('contenteditable')).toBe(false)
			expect(inner.hasAttribute('contenteditable')).toBe(false)
			// Off the path, at every level up to the root: chrome, hence atomic.
			expect(badge.getAttribute('contenteditable')).toBe('false')
			expect(label.getAttribute('contenteditable')).toBe('false')
			expect(outer.hasAttribute('tabindex')).toBe(false)
		})

		it('a slot host that appears or is replaced under a surviving root re-applies the policy', () => {
			// The root element survives the re-render, so the newly-bound-root check alone
			// would skip it: a mark that GROWS a slot would keep the `ce=false` that made it
			// atomic — a slot nobody can type in — and a replaced host would leave its new
			// chrome unfrozen.
			const container = document.createElement('div')
			const outer = document.createElement('mark')
			outer.append(document.createTextNode('x'))
			container.append(outer)
			const {roots} = treeOf([markToken('x', '@[x]', 0, [textToken('a', 0)])])
			const nodes = new Map<number, TokenHandle>()
			const hostFor = (host: HTMLElement) => (ownerId: number) => (ownerId === roots[0].id ? [host] : [])

			// Value-only to begin with: no host, so the whole mark is atomic.
			bindOf(inputFor(container, roots, {nodes}))
			expect(outer.getAttribute('contenteditable')).toBe('false')

			// A slot appears under the same root element.
			const chromeA = spanWith('@')
			const hostA = document.createElement('span')
			hostA.append(spanWith('a'))
			outer.replaceChildren(chromeA, hostA)
			bindOf(inputFor(container, roots, {nodes, childSequenceHostsFor: hostFor(hostA)}))

			expect(outer.hasAttribute('contenteditable')).toBe(false)
			expect(hostA.hasAttribute('contenteditable')).toBe(false)
			expect(chromeA.getAttribute('contenteditable')).toBe('false')

			// …and is replaced by a fresh one, chrome and all.
			const chromeB = spanWith('#')
			const hostB = document.createElement('span')
			hostB.append(spanWith('a'))
			outer.replaceChildren(chromeB, hostB)
			bindOf(inputFor(container, roots, {nodes, childSequenceHostsFor: hostFor(hostB)}))

			expect(hostB.hasAttribute('contenteditable')).toBe(false)
			expect(chromeB.getAttribute('contenteditable')).toBe('false')
		})

		it('does not reapply the editable state to a surface that stays bound', () => {
			// bind only handles MOUNT-time state, and this conditional is what keeps a
			// live surface out of the way of an attribute write mid-edit.
			const container = document.createElement('div')
			const span = spanWith('hello')
			container.append(span)
			const {roots} = treeOf([textToken('hello', 0)])
			const nodes = new Map<number, TokenHandle>()

			bindOf(inputFor(container, roots, {nodes}))
			expect(span.hasAttribute('contenteditable')).toBe(false)

			span.contentEditable = 'true'
			bindOf(inputFor(container, roots, {nodes}))

			expect(span.getAttribute('contenteditable')).toBe('true')
		})
	})

	describe('the per-surface text effect (S2.7: ONE writer)', () => {
		it('writes textContent of a newly bound surface the renderer left stale', () => {
			// The effect's IMMEDIATE first run is the mount-time reconciliation the
			// deleted `applyMountState` textContent write used to do.
			const container = document.createElement('div')
			const span = spanWith('')
			container.append(span)

			bindOf(inputFor(container, treeOf([textToken('hello', 0)]).roots))

			expect(span.textContent).toBe('hello')
		})

		it('patches a surface that stays bound when the node text changes, with NO re-bind', () => {
			// THE point of the phase: the commit pipeline no longer replays text. A live
			// edit to the node reaches its surface through the effect alone.
			const container = document.createElement('div')
			const span = spanWith('hello')
			container.append(span)
			const {roots} = treeOf([textToken('hello', 0)])

			bindOf(inputFor(container, roots))
			textAt(roots, 0).text('hello world')

			expect(span.textContent).toBe('hello world')
		})

		it('heals a surface corrupted between binds on the next bind', () => {
			// The re-arm's first run is what makes the structural branch self-healing.
			const container = document.createElement('div')
			const span = spanWith('hello')
			container.append(span)
			const {roots} = treeOf([textToken('hello', 0)])
			const nodes = new Map<number, TokenHandle>()

			bindOf(inputFor(container, roots, {nodes}))
			span.textContent = 'WRONG'
			bindOf(inputFor(container, roots, {nodes}))

			expect(span.textContent).toBe('hello')
		})

		it('keeps the caret when a re-bind finds the surface already correct (conditional write)', () => {
			// THE caret case, and it needs a SPLIT surface — measured, because on a
			// single-Text-child element Chromium's `textContent` setter takes a fast path
			// (`setData` on the existing node, itself a no-op for an identical string) and
			// the caret survives an unconditional write anyway. Two Text children is not
			// exotic: it is what `splitText` — and what the browser's own editing of a
			// contenteditable surface — leaves behind. There the setter is a genuine
			// replace-all: measured, `textContent = <same string>` collapses two children
			// into one and drops the caret from 4 to 0.
			const container = document.createElement('div')
			// The editing host, because that is where focus sits while the browser edits.
			container.contentEditable = 'true'
			const span = spanWith('hello')
			container.append(span)
			document.body.append(container)
			const {roots} = treeOf([textToken('hello', 0)])
			const nodes = new Map<number, TokenHandle>()

			bindOf(inputFor(container, roots, {nodes}))
			// The browser's own editing leaves a surface split like this.
			const only = span.firstChild
			if (!(only instanceof Text)) throw new Error('expected one text child')
			only.splitText(2)
			focusEditingHost(span)
			placeAtTextOffset(span, 4)
			expect(getCaretIndex(span)).toBe(4)

			bindOf(inputFor(container, roots, {nodes}))

			expect(span.childNodes).toHaveLength(2)
			expect(getCaretIndex(span)).toBe(4)
			document.body.replaceChildren()
		})

		it('preserves the text node when content already matches (conditional write)', () => {
			const container = document.createElement('div')
			const span = document.createElement('span')
			span.append(document.createTextNode('hello'))
			container.append(span)
			const initialTextNode = span.firstChild
			const {roots} = treeOf([textToken('hello', 0)])
			const nodes = new Map<number, TokenHandle>()

			bindOf(inputFor(container, roots, {nodes}))
			expect(span.firstChild).toBe(initialTextNode)

			bindOf(inputFor(container, roots, {nodes}))
			expect(span.firstChild).toBe(initialTextNode)

			// A no-op edit (same string) does not disturb it either: the signal does not
			// move, so the effect does not even re-run.
			textAt(roots, 0).text('hello')
			expect(span.firstChild).toBe(initialTextNode)
		})

		it('writes ONCE per text change, however many times the surface was re-bound', () => {
			// The failure mode of the phase: `bind` re-arming without disposing would
			// leave one live effect per bind, each writing the same value in turn. Only
			// the write COUNT tells them apart.
			const container = document.createElement('div')
			const {span, writes} = countingSpan('hello')
			container.append(span)
			const {roots} = treeOf([textToken('hello', 0)])
			const nodes = new Map<number, TokenHandle>()

			bindOf(inputFor(container, roots, {nodes}))
			bindOf(inputFor(container, roots, {nodes}))
			bindOf(inputFor(container, roots, {nodes}))
			expect(writes()).toBe(0)

			textAt(roots, 0).text('hello!')

			expect(writes()).toBe(1)
			expect(span.textContent).toBe('hello!')
		})

		it('stops writing an unbound surface, however many binds armed it', () => {
			// The effect dies with the binding: a node whose element left the DOM must
			// not keep writing the detached one.
			//
			// TWO arming binds before the unbind, and that is the mutation gate: with the
			// re-arm's `dispose` dropped, the write COUNT is still 1 (the second effect
			// finds the surface already correct and the conditional skips it), so the
			// leaked effect is invisible until the binding goes away and only the LAST
			// one is disposed.
			const container = document.createElement('div')
			const spanA = spanWith('alpha ')
			container.append(spanA, spanWith('beta'))
			const {roots} = treeOf([textToken('alpha ', 0), textToken('beta', 6)])
			const nodes = new Map<number, TokenHandle>()

			bindOf(inputFor(container, roots, {nodes}))
			bindOf(inputFor(container, roots, {nodes}))
			// Misaligned DOM: the walk bails and every handle is unbound.
			container.replaceChildren(spanA)
			bindOf(inputFor(container, roots, {nodes}))
			expect(nodes.get(1)?.element()).toBeUndefined()

			textAt(roots, 0).text('alpha!')

			expect(spanA.textContent).toBe('alpha ')
		})

		it('stops writing a killed node’s surface', () => {
			const container = document.createElement('div')
			const spanA = spanWith('alpha ')
			const spanB = spanWith('beta')
			container.append(spanA, spanB)
			const {roots} = treeOf([textToken('alpha ', 0), textToken('beta', 6)])
			const nodes = new Map<number, TokenHandle>()

			bindOf(inputFor(container, roots, {nodes}))
			const dying = textAt(roots, 1)
			container.replaceChildren(spanA)
			bindOf(inputFor(container, roots.slice(0, 1), {nodes}))
			expect(nodes.has(2)).toBe(false)

			dying.text('gone')

			expect(spanB.textContent).toBe('beta')
		})
	})

	/**
	 * The writer's SPLICE, exercised through the same effect the tests above drive. The property
	 * throughout is node IDENTITY: `textContent =` replaces every child, so the only way to tell
	 * an in-place write apart from a replace-all is that the `Text` object survives it — which is
	 * what keeps a DOM Range anchored in that node alive across a commit.
	 */
	describe('the surface splice', () => {
		/** Bind one text node to one span and hand back both, plus the span's live `Text`. */
		function mountSurface(initial: string) {
			const container = document.createElement('div')
			const span = spanWith(initial)
			container.append(span)
			const {roots} = treeOf([textToken(initial, 0)])
			bindOf(inputFor(container, roots))
			return {span, node: textAt(roots, 0), text: () => span.firstChild}
		}

		it('keeps the text node when the string grows, shrinks or is appended to', () => {
			const {span, node, text} = mountSurface('hello')
			const original = text()
			expect(original).toBeInstanceOf(Text)

			node.text('heXllo')
			expect(text()).toBe(original)
			expect(span.textContent).toBe('heXllo')

			node.text('hllo')
			expect(text()).toBe(original)
			expect(span.textContent).toBe('hllo')

			node.text('hllo!')
			expect(text()).toBe(original)
			expect(span.textContent).toBe('hllo!')
		})

		it('splices only the changed span, so an unrelated DOM range is left alone', () => {
			// The whole point of computing a minimal splice rather than replacing the node's
			// whole data: `replaceData` only moves ranges that the replaced span covers.
			const {node, text} = mountSurface('abcdef')
			const surface = text()
			if (!(surface instanceof Text)) throw new Error('expected a text node')
			const range = document.createRange()
			range.setStart(surface, 5)
			range.collapse(true)

			node.text('abcXdef')

			expect(range.startContainer).toBe(surface)
			// Past the splice, so it shifts by the delta rather than collapsing to 0.
			expect(range.startOffset).toBe(6)
		})

		it('rewrites a surrogate pair without producing a lone surrogate', () => {
			// The splice is computed in code UNITS, so the common prefix here stops between the
			// pair's two halves. `replaceData` applies it atomically, so the only observable is
			// the final string.
			const {span, node, text} = mountSurface('a\u{1F600}b')
			const original = text()

			node.text('a\u{1F601}b')

			expect(text()).toBe(original)
			expect(span.textContent).toBe('a\u{1F601}b')
		})

		it('drops to a whole-content write for an empty string, leaving no text node', () => {
			// Deliberate: an empty surface has always had NO `Text` child, and that is the shape
			// every other DOM reader has seen. There is no caret inside it to preserve either.
			const {span, node} = mountSurface('hello')

			node.text('')

			expect(span.firstChild).toBeNull()
			expect(span.textContent).toBe('')

			// And it grows back into a fresh node, which every later write then splices.
			node.text('hi')
			const grown = span.firstChild
			expect(grown).toBeInstanceOf(Text)
			node.text('hi!')
			expect(span.firstChild).toBe(grown)
		})

		it('normalises a surface the browser split, then splices every later write', () => {
			// Two `Text` children is what `splitText` and the browser's own editing leave behind.
			// The first changed write cannot preserve a caret there — it is a replace-all — but it
			// restores the single-node shape, so the surface self-corrects from then on.
			const {span, node, text} = mountSurface('hello')
			const first = text()
			if (!(first instanceof Text)) throw new Error('expected a text node')
			first.splitText(2)
			expect(span.childNodes.length).toBe(2)

			node.text('hello!')

			expect(span.childNodes.length).toBe(1)
			expect(span.textContent).toBe('hello!')

			const normalised = span.firstChild
			node.text('hello!!')
			expect(span.firstChild).toBe(normalised)
		})
	})
})