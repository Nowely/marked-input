import {afterEach, describe, expect, it, vi} from 'vitest'

import {computed, effect, watch} from '../../../shared/signals/index.js'
import {Store} from '../../../store/Store'
import {markToken, textToken} from '../__testing__/tokenFactories'
import {TokenHandle} from './LiveNode'

function mountSurface(content: string) {
	const container = document.createElement('div')
	const span = document.createElement('span')
	span.textContent = content
	container.append(span)
	document.body.append(container)
	return {container, span}
}

function mountInline(value: string) {
	const store = new Store()
	store.props.set({defaultValue: value})
	const container = document.createElement('div')
	const span = document.createElement('span')
	container.append(span)
	document.body.append(container)
	store.host.container(container)
	store.host.rendered()
	return {store, container, span}
}

/**
 * Block layout: two rows with mark tokens using the block controller pattern
 * (Mark + markup '__slot__\n\n').
 */
function mountBlock(value: string) {
	const store = new Store()
	store.props.set({
		defaultValue: value,
		layout: 'block',
		Mark: () => null,
		options: [{markup: '__slot__\n\n'}],
	})
	const container = document.createElement('div')
	document.body.append(container)
	store.host.container(container)

	// Build DOM rows: one div+span per mark token
	const rows = value.split('\n\n').filter(r => r.length > 0)
	for (const row of rows) {
		const rowEl = document.createElement('div')
		const tokenEl = document.createElement('span')
		tokenEl.textContent = row
		rowEl.append(tokenEl)
		container.append(rowEl)
	}

	store.host.rendered()
	return {store, container}
}

describe('TokenHandle (model/LiveNode)', () => {
	afterEach(() => {
		window.getSelection()?.removeAllRanges()
		document.body.replaceChildren()
	})

	describe('creation', () => {
		it('exposes id, token, text, derived address and liveness from (id, token, path)', () => {
			const token = textToken('hello', 0)
			const handle = new TokenHandle(7, token, [0])

			expect(handle.id).toBe(7)
			expect(handle.token()).toBe(token)
			expect(handle.text()).toBe('hello')
			expect(handle.dead()).toBe(false)
			expect(handle.element()).toBeUndefined()
			expect(handle.address()).toEqual({path: [0], token})
		})

		it('derives the address on read: the input path is copied, the value is cached until a change', () => {
			const token = textToken('hello', 0)
			const path = [1]
			const handle = new TokenHandle(1, token, path)

			path.push(99)
			expect(handle.address().path).toEqual([1])
			// Computed caching: the same object until this node changes.
			expect(handle.address()).toBe(handle.address())
		})
	})

	describe('update', () => {
		it('refreshes token and path in place and bumps dirty', () => {
			const handle = new TokenHandle(1, textToken('hello', 0), [0])
			const dirtyBefore = handle.dirty()

			const next = textToken('hello!', 0)
			handle.update(next, [2])

			expect(handle.dirty()).toBe(dirtyBefore + 1)
			expect(handle.token()).toBe(next)
			expect(handle.text()).toBe('hello!')
			expect(handle.address()).toEqual({path: [2], token: next})
		})

		it('fires text with the previous content when content changes', () => {
			const handle = new TokenHandle(1, textToken('hello', 0), [0])
			const onChange = vi.fn()
			watch(handle.changed, onChange)

			handle.update(textToken('hello!', 0), [0])

			expect(onChange).toHaveBeenCalledTimes(1)
			expect(onChange).toHaveBeenCalledWith({kind: 'text', previous: 'hello'}, undefined)
		})

		it('text wins over moved when both content and position change', () => {
			const handle = new TokenHandle(1, textToken('hello', 0), [0])
			const onChange = vi.fn()
			watch(handle.changed, onChange)

			handle.update(textToken('hey', 4), [1])

			expect(onChange).toHaveBeenCalledTimes(1)
			expect(onChange.mock.calls[0][0]).toEqual({kind: 'text', previous: 'hello'})
		})

		it('fires moved with the previous address when only the position shifts', () => {
			const first = textToken('beta', 6)
			const handle = new TokenHandle(2, first, [1])
			const onChange = vi.fn()
			watch(handle.changed, onChange)

			const shifted = textToken('beta', 11)
			handle.update(shifted, [2])

			expect(onChange).toHaveBeenCalledTimes(1)
			const [change] = onChange.mock.calls[0]
			expect(change.kind).toBe('moved')
			expect(change.previousAddress.path).toEqual([1])
			expect(change.previousAddress.token).toBe(first)
			expect(handle.address().path).toEqual([2])
		})

		it('is silent on a path-only refresh (content and position unchanged) but still bumps dirty', () => {
			const token = textToken('beta', 6)
			const handle = new TokenHandle(2, token, [1])
			const onChange = vi.fn()
			watch(handle.changed, onChange)
			const dirtyBefore = handle.dirty()

			handle.update(token, [3])

			expect(onChange).not.toHaveBeenCalled()
			expect(handle.address().path).toEqual([3])
			expect(handle.dirty()).toBe(dirtyBefore + 1)
		})

		it('changed watchers observe the already-updated handle', () => {
			const handle = new TokenHandle(1, textToken('hello', 0), [0])
			let observedText: string | undefined
			let observedPath: readonly number[] | undefined
			watch(handle.changed, () => {
				observedText = handle.text()
				observedPath = handle.address().path
			})

			handle.update(textToken('hello!', 0), [3])

			expect(observedText).toBe('hello!')
			expect(observedPath).toEqual([3])
		})
	})

	describe('fine-grained isolation', () => {
		it('updating node A never re-evaluates node B computeds and keeps B changed silent', () => {
			const {span: spanA} = mountSurface('alpha')
			const {span: spanB} = mountSurface('beta')
			const a = new TokenHandle(1, textToken('alpha', 0), [0])
			const b = new TokenHandle(2, textToken('beta', 6), [1])
			a.bindElements({tokenElement: spanA, textElement: spanA})
			b.bindElements({tokenElement: spanB, textElement: spanB})

			// Evaluation counters over every public computed, with live effect
			// subscribers — the shape adapters actually create over handles.
			let aEvaluations = 0
			let bEvaluations = 0
			const aProbe = computed(() => {
				aEvaluations++
				return [a.token(), a.address(), a.element(), a.text(), a.dead()] as const
			})
			const bProbe = computed(() => {
				bEvaluations++
				return [b.token(), b.address(), b.element(), b.text(), b.dead()] as const
			})
			const stopA = effect(() => void aProbe())
			const stopB = effect(() => void bProbe())
			expect(aEvaluations).toBe(1)
			expect(bEvaluations).toBe(1)

			const bChanged = vi.fn()
			watch(b.changed, bChanged)

			// address() allocates a fresh object per evaluation, so reference
			// stability below is corroborating evidence that the getter never re-ran —
			// the strict proof is the evaluation counters above (a cached computed
			// serves without re-running; the reference check cannot mask that).
			const aAddressBefore = a.address()
			const bAddressBefore = b.address()
			const bTokenBefore = b.token()
			const bDirtyBefore = b.dirty()

			a.update(textToken('alpha!', 0), [0])

			// The instrumentation is sensitive: A recomputed...
			expect(aEvaluations).toBe(2)
			expect(a.address()).not.toBe(aAddressBefore)
			// ...B never did: no propagation reached its subscribers, and a
			// direct re-read serves the cached values without running any getter.
			expect(bEvaluations).toBe(1)
			expect(b.address()).toBe(bAddressBefore)
			expect(b.token()).toBe(bTokenBefore)
			expect(b.dirty()).toBe(bDirtyBefore)
			expect(bChanged).not.toHaveBeenCalled()

			stopA()
			stopB()
		})
	})

	describe('element bindings', () => {
		it('bindElements exposes the live DOM, unbind clears it, rebinding while alive works', () => {
			const {container, span} = mountSurface('hello')
			const row = document.createElement('div')
			const host = document.createElement('div')
			const handle = new TokenHandle(1, textToken('hello', 0), [0])
			expect(handle.node()).toBeUndefined()

			handle.bindElements({tokenElement: span, textElement: span, rowElement: row, childSequenceHost: host})
			expect(handle.element()).toBe(span)
			expect(handle.node()).toEqual({
				tokenElement: span,
				textElement: span,
				rowElement: row,
				childSequenceHost: host,
			})

			handle.unbind()
			expect(handle.element()).toBeUndefined()
			expect(handle.node()).toBeUndefined()
			expect(handle.placeCaret(0)).toBe(false)

			const other = document.createElement('span')
			container.append(other)
			handle.bindElements({tokenElement: other})
			expect(handle.element()).toBe(other)
			expect(handle.node()).toEqual({tokenElement: other})
		})
	})

	describe('measurements', () => {
		it('measures the bound text surface', () => {
			const {span} = mountSurface('hello')
			const handle = new TokenHandle(1, textToken('hello', 0), [0])
			handle.bindElements({tokenElement: span, textElement: span})

			expect(handle.hasTextSurface()).toBe(true)
			expect(handle.textLength()).toBe(5)

			expect(handle.placeCaret(3)).toBe(true)
			expect(handle.caretIndex()).toBe(3)
			expect(handle.caretOnFirstLine()).toBe(true)
			expect(handle.caretOnLastLine()).toBe(true)

			const start = handle.caretRect(0)
			const end = handle.caretRect(4)
			expect(start).toBeInstanceOf(DOMRect)
			expect(end).toBeInstanceOf(DOMRect)
			if (!start || !end) throw new Error('expected caret rects')
			expect(start.left).toBeLessThan(end.left)
			expect(handle.caretRect(99)).toBeUndefined()

			const rect = handle.rect()
			const spanRect = span.getBoundingClientRect()
			expect(rect?.left).toBe(spanRect.left)
			expect(rect?.width).toBe(spanRect.width)
		})

		it('prefers the row element as the measurement scope', () => {
			const container = document.createElement('div')
			const row = document.createElement('div')
			const span = document.createElement('span')
			span.textContent = 'hello'
			const sibling = document.createElement('span')
			sibling.textContent = '!'
			row.append(span, sibling)
			container.append(row)
			document.body.append(container)

			const handle = new TokenHandle(1, markToken('m', 'hello!', 0), [0])
			handle.bindElements({tokenElement: span, textElement: span, rowElement: row})

			expect(handle.textLength()).toBe(6)
			expect(handle.rect()?.width).toBe(row.getBoundingClientRect().width)
		})

		it('returns inert defaults when nothing is bound', () => {
			const handle = new TokenHandle(1, textToken('hello', 0), [0])

			expect(handle.hasTextSurface()).toBe(false)
			expect(handle.textLength()).toBe(0)
			expect(handle.caretIndex()).toBeUndefined()
			expect(handle.caretRect(0)).toBeUndefined()
			expect(handle.rect()).toBeUndefined()
			expect(handle.caretOnFirstLine()).toBe(true)
			expect(handle.caretOnLastLine()).toBe(true)
		})
	})

	describe('commands', () => {
		it('no-ops false when no elements are bound', () => {
			const handle = new TokenHandle(1, textToken('hello', 0), [0])

			expect(handle.placeCaret(0)).toBe(false)
			expect(handle.placeCaretAtBoundary('start')).toBe(false)
			expect(handle.placeCaretAtX(10, 10)).toBe(false)
			expect(handle.focus()).toBe(false)
		})

		it('places the caret in the text surface with clamping (Infinity is end)', () => {
			const {span} = mountSurface('hello')
			const handle = new TokenHandle(1, textToken('hello', 0), [0])
			handle.bindElements({tokenElement: span, textElement: span})

			expect(handle.placeCaret(2)).toBe(true)
			expect(handle.caretIndex()).toBe(2)
			expect(handle.placeCaret(Infinity)).toBe(true)
			expect(handle.caretIndex()).toBe(5)
			expect(handle.placeCaret(-3)).toBe(true)
			expect(handle.caretIndex()).toBe(0)
			expect(handle.placeCaret(99)).toBe(true)
			expect(handle.caretIndex()).toBe(5)

			const selection = window.getSelection()
			expect(selection?.anchorNode && span.contains(selection.anchorNode)).toBe(true)
		})

		it('collapses to child boundaries on tokens without a text surface', () => {
			const container = document.createElement('div')
			const tokenElement = document.createElement('span')
			tokenElement.append(document.createElement('b'), document.createElement('i'))
			container.append(tokenElement)
			document.body.append(container)

			const handle = new TokenHandle(1, markToken('m', '@[m]', 0), [0])
			handle.bindElements({tokenElement})

			expect(handle.placeCaret(0)).toBe(true)
			let selection = window.getSelection()
			expect(selection?.anchorNode).toBe(tokenElement)
			expect(selection?.anchorOffset).toBe(0)

			expect(handle.placeCaret(1)).toBe(true)
			selection = window.getSelection()
			expect(selection?.anchorNode).toBe(tokenElement)
			expect(selection?.anchorOffset).toBe(tokenElement.childNodes.length)

			expect(handle.placeCaretAtBoundary('start')).toBe(true)
			expect(window.getSelection()?.anchorOffset).toBe(0)
			expect(handle.placeCaretAtBoundary('end')).toBe(true)
			expect(window.getSelection()?.anchorOffset).toBe(tokenElement.childNodes.length)
		})

		it('placeCaretAtBoundary targets start and end of the text surface', () => {
			const {span} = mountSurface('hello')
			const handle = new TokenHandle(1, textToken('hello', 0), [0])
			handle.bindElements({tokenElement: span, textElement: span})

			expect(handle.placeCaretAtBoundary('end')).toBe(true)
			expect(handle.caretIndex()).toBe(5)
			expect(handle.placeCaretAtBoundary('start')).toBe(true)
			expect(handle.caretIndex()).toBe(0)
		})

		it('focuses the scope element', () => {
			const {span} = mountSurface('hello')
			span.tabIndex = 0
			const handle = new TokenHandle(1, textToken('hello', 0), [0])
			handle.bindElements({tokenElement: span, textElement: span})

			expect(handle.focus()).toBe(true)
			expect(document.activeElement).toBe(span)
		})

		it('placeCaretAtX resolves a viewport point inside the scope', () => {
			const {span} = mountSurface('hello')
			const handle = new TokenHandle(1, textToken('hello', 0), [0])
			handle.bindElements({tokenElement: span, textElement: span})

			const rect = span.getBoundingClientRect()
			expect(handle.placeCaretAtX(rect.left + 2, rect.top + rect.height / 2)).toBe(true)
			const selection = window.getSelection()
			expect(selection?.anchorNode && span.contains(selection.anchorNode)).toBe(true)
		})
	})

	describe('dead contract', () => {
		it('kill fires unmounted once, freezes reads, disables commands and never resurrects', () => {
			const {span} = mountSurface('hello')
			const token = textToken('hello', 0)
			const handle = new TokenHandle(5, token, [0])
			handle.bindElements({tokenElement: span, textElement: span})
			const onChange = vi.fn()
			watch(handle.changed, onChange)

			handle.kill()

			expect(onChange).toHaveBeenCalledTimes(1)
			expect(onChange).toHaveBeenCalledWith({kind: 'unmounted'}, undefined)
			expect(handle.dead()).toBe(true)
			expect(handle.element()).toBeUndefined()
			expect(handle.node()).toBeUndefined()
			// Stale reads stay safe and serve the last state.
			expect(handle.token()).toBe(token)
			expect(handle.text()).toBe('hello')
			expect(handle.address().path).toEqual([0])

			// Idempotent: a second kill is silent.
			handle.kill()
			expect(onChange).toHaveBeenCalledTimes(1)

			// Commands no-op false, measurements collapse to their unbound defaults.
			expect(handle.placeCaret(0)).toBe(false)
			expect(handle.placeCaretAtBoundary('start')).toBe(false)
			expect(handle.placeCaretAtX(0)).toBe(false)
			expect(handle.focus()).toBe(false)
			expect(handle.textLength()).toBe(0)
			expect(handle.caretIndex()).toBeUndefined()
			expect(handle.hasTextSurface()).toBe(false)

			// Never resurrected: update/bindElements are inert on a dead handle.
			const dirtyAfterKill = handle.dirty()
			handle.update(textToken('zombie', 0), [4])
			handle.bindElements({tokenElement: span, textElement: span})
			expect(handle.dead()).toBe(true)
			expect(handle.token()).toBe(token)
			expect(handle.element()).toBeUndefined()
			expect(handle.dirty()).toBe(dirtyAfterKill)
			expect(onChange).toHaveBeenCalledTimes(1)
		})
	})

	it('path() returns the handle tree position; alive() is true while bound', () => {
		const {store, span} = mountInline('hello')
		const handle = store.tokens.handleAt(span)
		if (!handle || handle === 'control') throw new Error('expected handle')
		expect(handle.path()).toEqual([0])
		expect(handle.alive()).toBe(true)
	})

	it('alive() is false once the handle is killed', () => {
		// Block layout: capture row 1's handle, then shrink to one row so bind kills it.
		const {store, container} = mountBlock('alpha\n\nbeta\n\n')
		const handle = store.tokens.handle(store.tokens.tokens()[1].id!)
		if (!handle) throw new Error('expected handle for row 1')
		const secondRow = container.children[1]
		if (!(secondRow instanceof HTMLElement)) throw new Error('expected HTMLElement')
		secondRow.remove()
		store.value.current('alpha\n\n')
		store.host.rendered()
		expect(handle.alive()).toBe(false)
	})
})