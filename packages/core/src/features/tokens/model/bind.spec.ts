import {describe, expect, it, vi} from 'vitest'

import {watch} from '../../../shared/signals/index.js'
import {markToken, textToken} from '../__testing__/tokenFactories'
import type {Token} from '../parser/types'
import {pathKey} from '../tokenIndex'
import {bind} from './bind'
import type {BindInput} from './bind'
import type {TokenHandle} from './LiveNode'

/**
 * Test stand-in for the identity tracker's read side: bind receives a
 * reconciled tree, where every token (descendants included) already carries
 * an id, and only ever READS ids. `set` pins an id explicitly (simulating
 * id inheritance across token-object replacement), `registerAll` fills the
 * gaps depth-first like reconcile's ensureId sweep.
 */
function createIds() {
	const ids = new WeakMap<Token, number>()
	let next = 1
	const registerAll = (tokens: readonly Token[]): void => {
		for (const token of tokens) {
			if (!ids.has(token)) ids.set(token, next++)
			if (token.type === 'mark') registerAll(token.children)
		}
	}
	return {
		idFor: (token: Token) => ids.get(token),
		set: (token: Token, id: number) => void ids.set(token, id),
		registerAll,
	}
}

function inputFor(
	container: HTMLElement,
	tokens: readonly Token[],
	idFor: (token: Token) => number | undefined,
	overrides: Partial<BindInput> = {}
): BindInput {
	return {
		container,
		tokens,
		idFor,
		nodes: new Map<number, TokenHandle>(),
		controlElements: new Set<HTMLElement>(),
		childSequenceHostsFor: () => [],
		isBlock: false,
		editable: {editable: true, readOnly: false},
		...overrides,
	}
}

function spanWith(content: string): HTMLElement {
	const span = document.createElement('span')
	span.textContent = content
	return span
}

describe('bind', () => {
	describe('structural walk (buildIndex semantics)', () => {
		it('binds a single inline text token to its DOM element and registers the handle', () => {
			const container = document.createElement('div')
			const span = spanWith('hello')
			container.append(span)

			const tokens: Token[] = [textToken('hello', 0)]
			const ids = createIds()
			ids.registerAll(tokens)
			const nodes = new Map<number, TokenHandle>()

			const result = bind(inputFor(container, tokens, ids.idFor, {nodes}))

			const handle = result.byPath.get('0')
			expect(handle).toBeDefined()
			expect(nodes.get(1)).toBe(handle)
			expect(handle?.token()).toBe(tokens[0])
			expect(handle?.address()).toEqual({path: [0], token: tokens[0]})
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

			const tokens: Token[] = [textToken('hi ', 0), markToken('world', '@[world]', 3), textToken('!', 11)]
			const ids = createIds()
			ids.registerAll(tokens)

			const result = bind(inputFor(container, tokens, ids.idFor))

			expect(result.byPath.get('0')?.element()).toBe(before)
			expect(result.byPath.get('1')?.element()).toBe(mark)
			expect(result.byPath.get('2')?.element()).toBe(after)
			expect(result.byPath.get('1')?.node()?.textElement).toBeUndefined()
			expect(result.byPath.get('1')?.hasTextSurface()).toBe(false)
		})

		it('descends into nested mark children in place', () => {
			const container = document.createElement('div')
			const outer = document.createElement('mark')
			const innerText = document.createElement('span')
			outer.append(innerText)
			container.append(outer)

			const tokens: Token[] = [markToken('x', '@[x]', 0, [textToken('x', 0)])]
			const ids = createIds()
			ids.registerAll(tokens)

			const result = bind(inputFor(container, tokens, ids.idFor))

			expect(result.byPath.get('0')?.element()).toBe(outer)
			expect(result.byPath.get('0.0')?.element()).toBe(innerText)
			expect(result.byPath.get('0.0')?.node()?.textElement).toBe(innerText)
		})

		it('completes binding when a nested mark renders no child elements', () => {
			const container = document.createElement('div')
			const outer = document.createElement('mark')
			container.append(outer)

			const tokens: Token[] = [markToken('x', '@[x]', 0, [textToken('a', 0)])]
			const ids = createIds()
			ids.registerAll(tokens)
			const nodes = new Map<number, TokenHandle>()

			const result = bind(inputFor(container, tokens, ids.idFor, {nodes}))

			expect(result.byPath.get('0')?.element()).toBe(outer)
			expect(result.byPath.get('0.0')).toBeUndefined()
			// No handle is materialized for a tree token the walk never reached.
			expect(nodes.has(2)).toBe(false)
			expect(nodes.size).toBe(1)
		})

		it('peels block-layout rows and binds the single token per row', () => {
			const container = document.createElement('div')
			const row0 = document.createElement('div')
			const tokenEl0 = document.createElement('span')
			row0.append(tokenEl0)
			const row1 = document.createElement('div')
			const tokenEl1 = document.createElement('span')
			row1.append(tokenEl1)
			container.append(row0, row1)

			const tokens: Token[] = [textToken('a', 0), textToken('b', 2)]
			const ids = createIds()
			ids.registerAll(tokens)

			const result = bind(inputFor(container, tokens, ids.idFor, {isBlock: true}))

			expect(result.byPath.get('0')?.element()).toBe(tokenEl0)
			expect(result.byPath.get('0')?.node()?.rowElement).toBe(row0)
			expect(result.byPath.get('1')?.element()).toBe(tokenEl1)
			expect(result.byPath.get('1')?.node()?.rowElement).toBe(row1)
			expect(result.byElement.get(row0)).toBe(result.byPath.get('0'))
			expect(result.byElement.get(row1)).toBe(result.byPath.get('1'))
		})

		it('treats block-row control children as non-tokens (preserves single-token-per-row invariant)', () => {
			const container = document.createElement('div')
			const row = document.createElement('div')
			const control = document.createElement('button')
			const tokenEl = document.createElement('span')
			row.append(control, tokenEl)
			container.append(row)

			const tokens: Token[] = [textToken('a', 0)]
			const ids = createIds()
			ids.registerAll(tokens)

			const result = bind(
				inputFor(container, tokens, ids.idFor, {isBlock: true, controlElements: new Set([control])})
			)

			expect(result.byPath.get('0')?.element()).toBe(tokenEl)
			expect(result.byPath.get('0')?.node()?.rowElement).toBe(row)
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

			const tokens: Token[] = [textToken('a', 0), textToken('b', 2)]
			const ids = createIds()
			ids.registerAll(tokens)
			const nodes = new Map<number, TokenHandle>()

			const result = bind(inputFor(container, tokens, ids.idFor, {isBlock: true, nodes}))

			expect(result.byPath.get('0')).toBeUndefined()
			expect(result.byPath.get('1')).toBeUndefined()
			// All-or-nothing: nothing was indexed, so no handles materialize either.
			expect(nodes.size).toBe(0)
		})

		it('skips control elements when zipping tokens with DOM children', () => {
			const container = document.createElement('div')
			const control = document.createElement('button')
			const tokenEl = document.createElement('span')
			container.append(control, tokenEl)

			const tokens: Token[] = [textToken('a', 0)]
			const ids = createIds()
			ids.registerAll(tokens)

			const result = bind(inputFor(container, tokens, ids.idFor, {controlElements: new Set([control])}))

			expect(result.byPath.get('0')?.element()).toBe(tokenEl)
			expect(result.byElement.get(control)).toBeUndefined()
		})

		it('treats elements containing a control as control roots', () => {
			const container = document.createElement('div')
			const wrapper = document.createElement('div')
			const control = document.createElement('button')
			wrapper.append(control)
			const tokenEl = document.createElement('span')
			container.append(wrapper, tokenEl)

			const tokens: Token[] = [textToken('a', 0)]
			const ids = createIds()
			ids.registerAll(tokens)

			const result = bind(inputFor(container, tokens, ids.idFor, {controlElements: new Set([control])}))

			expect(result.byPath.get('0')?.element()).toBe(tokenEl)
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

			const tokens: Token[] = [markToken('x', '@[x]', 0, [textToken('a', 0), textToken('b', 1)])]
			const ids = createIds()
			ids.registerAll(tokens)

			const result = bind(
				inputFor(container, tokens, ids.idFor, {
					childSequenceHostsFor: path => (pathKey(path) === '0' ? [host] : []),
				})
			)

			expect(result.byPath.get('0')?.node()?.childSequenceHost).toBe(host)
			expect(result.byPath.get('0.0')?.element()).toBe(innerA)
			expect(result.byPath.get('0.1')?.element()).toBe(innerB)
			expect(result.byElement.get(host)).toBe(result.byPath.get('0'))
		})

		it('falls back to in-place descent when child-sequence host is duplicated', () => {
			const container = document.createElement('div')
			const outer = document.createElement('mark')
			const hostA = document.createElement('span')
			const hostB = document.createElement('span')
			outer.append(hostA, hostB)
			container.append(outer)

			const tokens: Token[] = [markToken('x', '@[x]', 0, [textToken('a', 0)])]
			const ids = createIds()
			ids.registerAll(tokens)

			const result = bind(
				inputFor(container, tokens, ids.idFor, {
					childSequenceHostsFor: path => (pathKey(path) === '0' ? [hostA, hostB] : []),
				})
			)

			expect(result.byPath.get('0')?.node()?.childSequenceHost).toBeUndefined()
			expect(result.byPath.get('0.0')).toBeUndefined()
		})

		it('returns controlRoots including controls and their ancestors up to container', () => {
			const container = document.createElement('div')
			const wrapper = document.createElement('div')
			const control = document.createElement('button')
			const tokenEl = document.createElement('span')
			wrapper.append(control)
			container.append(wrapper, tokenEl)

			const tokens: Token[] = [textToken('hi', 0)]
			const ids = createIds()
			ids.registerAll(tokens)

			const result = bind(inputFor(container, tokens, ids.idFor, {controlElements: new Set([control])}))

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

			const tokens: Token[] = [
				textToken('a', 0),
				markToken('x', '@[x]', 1, [textToken('b', 1)]),
				textToken('c', 5),
			]
			const ids = createIds()
			ids.registerAll(tokens)

			const result = bind(
				inputFor(container, tokens, ids.idFor, {
					childSequenceHostsFor: path => (pathKey(path) === '1' ? [outsideHost] : []),
				})
			)

			expect(result.byPath.get('0')?.element()).toBe(leading)
			expect(result.byPath.get('1')?.element()).toBe(outer)
			expect(result.byPath.get('1')?.node()?.childSequenceHost).toBeUndefined()
			expect(result.byPath.get('2')?.element()).toBe(trailing)
			expect(result.byPath.get('1.0')).toBeUndefined()
		})
	})

	describe('node map lifecycle', () => {
		it('reuses the handle across binds, updating token and elements in place', () => {
			const container = document.createElement('div')
			container.append(spanWith('hello'))
			const first = textToken('hello', 0)
			const ids = createIds()
			ids.registerAll([first])
			const nodes = new Map<number, TokenHandle>()

			bind(inputFor(container, [first], ids.idFor, {nodes}))
			const handle = nodes.get(1)
			if (!handle) throw new Error('expected handle for id 1')

			const onChange = vi.fn()
			watch(handle.changed, onChange)

			// Structural re-render: new token object (id inherited), new DOM.
			const next = textToken('hello!', 0)
			ids.set(next, 1)
			const renderedSpan = spanWith('hello!')
			container.replaceChildren(renderedSpan)

			const result = bind(inputFor(container, [next], ids.idFor, {nodes}))

			expect(nodes.size).toBe(1)
			expect(nodes.get(1)).toBe(handle)
			expect(result.byPath.get('0')).toBe(handle)
			expect(result.byElement.get(renderedSpan)).toBe(handle)
			expect(handle.token()).toBe(next)
			expect(handle.element()).toBe(renderedSpan)
			expect(onChange).toHaveBeenCalledTimes(1)
			expect(onChange).toHaveBeenCalledWith({kind: 'text', previous: 'hello'}, undefined)
		})

		it('fires moved and rebinds when a token shifts to a new path', () => {
			const container = document.createElement('div')
			container.append(spanWith('alpha '), spanWith('beta'))
			const a = textToken('alpha ', 0)
			const b = textToken('beta', 6)
			const ids = createIds()
			ids.registerAll([a, b])
			const nodes = new Map<number, TokenHandle>()

			bind(inputFor(container, [a, b], ids.idFor, {nodes}))
			const handleB = nodes.get(2)
			if (!handleB) throw new Error('expected handle for id 2')

			const onChange = vi.fn()
			watch(handleB.changed, onChange)

			// A token is prepended: b keeps content, shifts position and path.
			const inserted = textToken('x ', 0)
			const a2 = textToken('alpha ', 2)
			const b2 = textToken('beta', 8)
			ids.set(a2, 1)
			ids.set(b2, 2)
			ids.registerAll([inserted])
			const spanB2 = spanWith('beta')
			container.replaceChildren(spanWith('x '), spanWith('alpha '), spanB2)

			const result = bind(inputFor(container, [inserted, a2, b2], ids.idFor, {nodes}))

			expect(result.byPath.get('2')).toBe(handleB)
			expect(handleB.address().path).toEqual([2])
			expect(handleB.element()).toBe(spanB2)
			expect(onChange).toHaveBeenCalledTimes(1)
			const [change] = onChange.mock.calls[0]
			expect(change.kind).toBe('moved')
			expect(change.previousAddress.path).toEqual([1])
		})

		it('kills and removes handles whose ids are absent from the new tree', () => {
			const container = document.createElement('div')
			const spanA = spanWith('alpha ')
			container.append(spanA, spanWith('beta'))
			const a = textToken('alpha ', 0)
			const b = textToken('beta', 6)
			const ids = createIds()
			ids.registerAll([a, b])
			const nodes = new Map<number, TokenHandle>()

			bind(inputFor(container, [a, b], ids.idFor, {nodes}))
			const handleA = nodes.get(1)
			const handleB = nodes.get(2)
			if (!handleA || !handleB) throw new Error('expected handles for both ids')

			const onChange = vi.fn()
			watch(handleB.changed, onChange)

			container.replaceChildren(spanA)
			bind(inputFor(container, [a], ids.idFor, {nodes}))

			expect(handleB.dead()).toBe(true)
			expect(onChange).toHaveBeenCalledTimes(1)
			expect(onChange).toHaveBeenCalledWith({kind: 'unmounted'}, undefined)
			expect(nodes.has(2)).toBe(false)
			expect(nodes.size).toBe(1)
			expect(handleA.dead()).toBe(false)
			expect(handleA.element()).toBe(spanA)
		})

		it('keeps handles alive but unbound when the DOM walk bails (transient misalignment)', () => {
			// DELIBERATE DIVERGENCE from the old TokenModel: #syncHandles killed every
			// handle whose id vanished from #byId, and on a bail #byId was empty — a
			// transiently misaligned DOM (adapter mid-render) killed all handles.
			// Here only ids genuinely absent from the TREE die; on a bail the nodes
			// keep token/path (refreshed from the authoritative tree) and lose only
			// their element bindings.
			const container = document.createElement('div')
			container.append(spanWith('alpha '), spanWith('beta'))
			const a = textToken('alpha ', 0)
			const b = textToken('beta', 6)
			const ids = createIds()
			ids.registerAll([a, b])
			const nodes = new Map<number, TokenHandle>()

			bind(inputFor(container, [a, b], ids.idFor, {nodes}))
			const handleA = nodes.get(1)
			const handleB = nodes.get(2)
			if (!handleA || !handleB) throw new Error('expected handles for both ids')

			const changesA = vi.fn()
			const changesB = vi.fn()
			watch(handleA.changed, changesA)
			watch(handleB.changed, changesB)

			// New tree (text grew), but the DOM is misaligned: one element, two tokens.
			const a2 = textToken('alpha! ', 0)
			const b2 = textToken('beta', 7)
			ids.set(a2, 1)
			ids.set(b2, 2)
			container.replaceChildren(spanWith('alpha! '))

			const result = bind(inputFor(container, [a2, b2], ids.idFor, {nodes}))

			expect(result.byPath.size).toBe(0)
			expect(nodes.size).toBe(2)
			expect(handleA.dead()).toBe(false)
			expect(handleB.dead()).toBe(false)
			expect(handleA.element()).toBeUndefined()
			expect(handleB.element()).toBeUndefined()
			expect(handleA.node()).toBeUndefined()
			// Token and path stay current with the tree even while unbound.
			expect(handleA.token()).toBe(a2)
			expect(handleB.token()).toBe(b2)
			expect(handleB.address().path).toEqual([1])
			expect(changesA).toHaveBeenCalledWith({kind: 'text', previous: 'alpha '}, undefined)
			expect(changesB.mock.calls[0][0].kind).toBe('moved')
		})

		it('keeps an existing handle alive and current when its subtree goes unrendered', () => {
			const container = document.createElement('div')
			const outer = document.createElement('mark')
			outer.append(spanWith('a'))
			container.append(outer)
			const tokens: Token[] = [markToken('x', '@[x]', 0, [textToken('a', 0)])]
			const ids = createIds()
			ids.registerAll(tokens)
			const nodes = new Map<number, TokenHandle>()

			bind(inputFor(container, tokens, ids.idFor, {nodes}))
			const child = nodes.get(2)
			if (!child) throw new Error('expected child handle')
			expect(child.element()).toBeDefined()

			// Next render: the mark renders no child elements, but the child token
			// is still in the tree — its handle must survive, unbound and current.
			const childToken2 = textToken('b', 0)
			const mark2 = markToken('x', '@[x]', 0, [childToken2])
			ids.set(mark2, 1)
			ids.set(childToken2, 2)
			outer.replaceChildren()

			const result = bind(inputFor(container, [mark2], ids.idFor, {nodes}))

			expect(result.byPath.get('0')).toBeDefined()
			expect(result.byPath.get('0.0')).toBeUndefined()
			expect(nodes.has(2)).toBe(true)
			expect(child.dead()).toBe(false)
			expect(child.element()).toBeUndefined()
			expect(child.token()).toBe(childToken2)
			expect(child.text()).toBe('b')
		})

		it('throws before mutating anything when a tree token has no id', () => {
			const container = document.createElement('div')
			const span = spanWith('hello')
			container.append(span)
			const first = textToken('hello', 0)
			const ids = createIds()
			ids.registerAll([first])
			const nodes = new Map<number, TokenHandle>()

			bind(inputFor(container, [first], ids.idFor, {nodes}))
			const handle = nodes.get(1)
			if (!handle) throw new Error('expected handle for id 1')

			const unregistered = textToken('rogue', 0)
			expect(() => bind(inputFor(container, [unregistered], ids.idFor, {nodes}))).toThrow(/no id/)

			// Pre-pass failed before any mutation: the node layer is untouched.
			expect(nodes.size).toBe(1)
			expect(handle.dead()).toBe(false)
			expect(handle.element()).toBe(span)
		})
	})

	describe('mount-time editable state', () => {
		it('applies contentEditable to newly bound text surfaces per the editable flag', () => {
			const editableSpan = spanWith('a')
			const editableContainer = document.createElement('div')
			editableContainer.append(editableSpan)
			const editableToken = textToken('a', 0)

			const frozenSpan = spanWith('b')
			const frozenContainer = document.createElement('div')
			frozenContainer.append(frozenSpan)
			const frozenToken = textToken('b', 0)

			const ids = createIds()
			ids.registerAll([editableToken, frozenToken])

			bind(inputFor(editableContainer, [editableToken], ids.idFor))
			bind(
				inputFor(frozenContainer, [frozenToken], ids.idFor, {
					editable: {editable: false, readOnly: false},
				})
			)

			expect(editableSpan.contentEditable).toBe('true')
			expect(frozenSpan.contentEditable).toBe('false')
		})

		it('applies tabindex to newly bound mark roots per readOnly', () => {
			const interactiveMark = document.createElement('mark')
			const interactiveContainer = document.createElement('div')
			interactiveContainer.append(interactiveMark)
			const interactiveToken = markToken('a', '@[a]', 0)

			const readOnlyMark = document.createElement('mark')
			readOnlyMark.tabIndex = 0
			const readOnlyContainer = document.createElement('div')
			readOnlyContainer.append(readOnlyMark)
			const readOnlyToken = markToken('b', '@[b]', 0)

			const ids = createIds()
			ids.registerAll([interactiveToken, readOnlyToken])

			bind(inputFor(interactiveContainer, [interactiveToken], ids.idFor))
			bind(
				inputFor(readOnlyContainer, [readOnlyToken], ids.idFor, {
					editable: {editable: false, readOnly: true},
				})
			)

			expect(interactiveMark.tabIndex).toBe(0)
			expect(readOnlyMark.hasAttribute('tabindex')).toBe(false)
		})

		it('does not reapply contentEditable to a surface that stays bound', () => {
			// Prop-change application is the model shell's job (scoped editable
			// setter); bind only handles MOUNT-time state. A surface that stays
			// bound keeps whatever the shell last wrote.
			const container = document.createElement('div')
			const span = spanWith('hello')
			container.append(span)
			const token = textToken('hello', 0)
			const ids = createIds()
			ids.registerAll([token])
			const nodes = new Map<number, TokenHandle>()

			bind(inputFor(container, [token], ids.idFor, {nodes}))
			expect(span.contentEditable).toBe('true')

			span.contentEditable = 'false'
			bind(inputFor(container, [token], ids.idFor, {nodes}))

			expect(span.contentEditable).toBe('false')
		})
	})

	describe('text surface reconciliation (the absorbed sweep)', () => {
		it('writes textContent of a newly bound surface the renderer left stale', () => {
			const container = document.createElement('div')
			const span = spanWith('')
			container.append(span)
			const token = textToken('hello', 0)
			const ids = createIds()
			ids.registerAll([token])

			bind(inputFor(container, [token], ids.idFor))

			expect(span.textContent).toBe('hello')
		})

		it('patches stale textContent of a surface that stays bound across a structural commit', () => {
			// The structural branch endpoint must absorb the old per-commit sweep:
			// a structural commit can ALSO carry text changes (e.g. paste replacing
			// a mark and editing text), and the renderer only re-renders structure —
			// a kept element's textContent would stay stale without this.
			const container = document.createElement('div')
			const span = spanWith('hello')
			container.append(span)
			const first = textToken('hello', 0)
			const ids = createIds()
			ids.registerAll([first])
			const nodes = new Map<number, TokenHandle>()

			bind(inputFor(container, [first], ids.idFor, {nodes}))

			const next = textToken('hello world', 0)
			ids.set(next, 1)
			bind(inputFor(container, [next], ids.idFor, {nodes}))

			expect(span.textContent).toBe('hello world')
		})

		it('preserves the text node when content already matches (conditional write)', () => {
			const container = document.createElement('div')
			const span = document.createElement('span')
			span.append(document.createTextNode('hello'))
			container.append(span)
			const initialTextNode = span.firstChild
			const first = textToken('hello', 0)
			const ids = createIds()
			ids.registerAll([first])
			const nodes = new Map<number, TokenHandle>()

			bind(inputFor(container, [first], ids.idFor, {nodes}))
			expect(span.firstChild).toBe(initialTextNode)

			const next = textToken('hello', 0)
			ids.set(next, 1)
			bind(inputFor(container, [next], ids.idFor, {nodes}))
			expect(span.firstChild).toBe(initialTextNode)
		})
	})

	describe('batching', () => {
		it('flushes changed watchers only after the whole layer is bound', () => {
			const container = document.createElement('div')
			container.append(spanWith('alpha '), spanWith('beta'))
			const a = textToken('alpha ', 0)
			const b = textToken('beta', 6)
			const ids = createIds()
			ids.registerAll([a, b])
			const nodes = new Map<number, TokenHandle>()

			bind(inputFor(container, [a, b], ids.idFor, {nodes}))
			const handleA = nodes.get(1)
			const handleB = nodes.get(2)
			if (!handleA || !handleB) throw new Error('expected handles for both ids')

			// A is updated before B in tree order; its watcher must still observe
			// B's POST-bind state — the whole walk commits as one batch.
			let observedText: string | undefined
			let observedElement: HTMLElement | undefined
			watch(handleA.changed, () => {
				observedText = handleB.text()
				observedElement = handleB.element()
			})

			const a2 = textToken('alpha! ', 0)
			const b2 = textToken('beta!', 7)
			ids.set(a2, 1)
			ids.set(b2, 2)
			const spanB2 = spanWith('beta!')
			container.replaceChildren(spanWith('alpha! '), spanB2)

			bind(inputFor(container, [a2, b2], ids.idFor, {nodes}))

			expect(observedText).toBe('beta!')
			expect(observedElement).toBe(spanB2)
		})
	})
})