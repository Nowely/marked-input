import {describe, it, expect, vi} from 'vitest'

import {markToken, nodesOf, rowToken, textToken, treeShape} from '../features/tokens/__testing__/tokenFactories'
import {DEFAULT_OPTIONS} from '../shared/constants'
import {Store} from './Store'

import styles from '../../styles.module.css'

describe('Store', () => {
	it('construct with no arguments', () => {
		const store = new Store()
		// The fresh read: nothing is reconciled before a container mounts.
		expect(treeShape(store.tokens.nodes())).toEqual([])
		expect(store.props.readOnly()).toBe(false)
	})

	it('return default for showOverlayOn when not set', () => {
		const store = new Store()
		expect(store.props.showOverlayOn()).toBe('change')
	})

	it('return default for options when not set', () => {
		const store = new Store()
		expect(store.props.options()).toEqual(DEFAULT_OPTIONS)
	})

	// `MarkputHandler`'s `overlay` getter is NOT ported: §2.3's export table drops it as
	// consumer-free, confirmed by grep over both adapters, the storybook and the demo apps.
	// `MarkputHandle`'s own verb matrix lives in `MarkputHandle.spec.ts`; what stays here is the
	// wiring claim — the store hands out one live host object.
	describe('handle', () => {
		it('reflect dom container via handle.container', () => {
			const store = new Store()
			const handle = store.handle
			expect(handle.container).toBe(null)
			const el = document.createElement('div')
			store.host.container(el)
			expect(handle.container).toBe(el)
		})
	})

	describe('internal state signals', () => {
		it('update when written directly', () => {
			const store = new Store()
			// The READ BEFORE the write is load-bearing, and it stopped being implicit at S1.8
			// step 5. `ValueModel.current` was a writable computed, and a writable computed
			// evaluates its getter before the set to short-circuit an equal write — which is
			// what caught `TokenModel#seeded` degrading from a signal to a plain field (the
			// computed caches the `#seed` arm and its dep set, and a field write then notifies
			// nothing). Writing through `tokens.replace` has no such implicit read, so without
			// this line the computed is cold at the assertion and re-derives correctly under
			// the mutation. Measured: 3 cases died before the port, 1 after; this line and the
			// one in `current` › 'returns written current value' restore the other two.
			expect(store.tokens.value()).toBe('')
			store.tokens.setValue('hello')
			expect(store.tokens.value()).toBe('hello')
		})
	})

	describe('props.set()', () => {
		it('sets individual prop signals', () => {
			const store = new Store()
			store.props.set({separator: null, value: 'hello'})
			expect(store.props.value()).toBe('hello')
		})

		it('sets multiple prop signals atomically', () => {
			const store = new Store()
			store.props.set({separator: null, value: 'foo', readOnly: true, className: 'bar'})
			expect(store.props.value()).toBe('foo')
			expect(store.props.readOnly()).toBe(true)
			expect(store.props.className()).toBe('bar')
		})

		it('ignores unknown keys gracefully', () => {
			const store = new Store()
			// TypeScript prevents this at compile time, but guard handles JS callers
			// oxlint-disable-next-line no-unsafe-type-assertion
			expect(() => store.props.set({separator: null, nonExistentKey: 'x'} as never)).not.toThrow()
		})

		it('reflects controlled value via tokens without changing internal state', () => {
			const store = new Store()
			store.tokens.setValue('internal')
			store.props.set({separator: null, value: 'controlled'})
			expect(store.tokens.value()).toBe('controlled')
			store.props.set({separator: null, value: undefined})
			expect(store.tokens.value()).toBe('internal')
		})

		it('ignores direct signal writes on props (readonly guard)', () => {
			const store = new Store()
			store.props.set({separator: null, value: 'initial'})
			store.props.value('hacked')
			expect(store.props.value()).toBe('initial')
		})
	})

	describe('value edits', () => {
		// Tokens publish only on a mounted store; with a bare container every
		// commit settles structurally and the live tree is the parse of the accepted value.
		it('updates tokens and current when uncontrolled replacement is accepted', () => {
			const store = new Store()
			store.props.set({separator: null})
			store.host.container(document.createElement('div'))
			store.tokens.setValue('hello')
			expect(treeShape(store.tokens.nodes())).toMatchObject([
				{kind: 'text', content: 'hello', position: {start: 0, end: 5}},
			])
			expect(store.tokens.value()).toBe('hello')
		})

		it('calls onChange when uncontrolled replacement is accepted', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.set({separator: null, onChange})
			store.tokens.setValue('world')
			expect(onChange).toHaveBeenCalledOnce()
			expect(onChange).toHaveBeenCalledWith('world')
		})

		it('emits without committing until controlled replacement is echoed', () => {
			const store = new Store()
			store.host.container(document.createElement('div'))
			const onChange = vi.fn()
			store.props.set({separator: null, value: 'hello', onChange})
			store.tokens.setValue('world')
			expect(onChange).toHaveBeenCalledWith('world')
			expect(store.tokens.value()).toBe('hello')
			expect(treeShape(store.tokens.nodes())).toMatchObject([
				{kind: 'text', content: 'hello', position: {start: 0, end: 5}},
			])
		})

		it('not throw when onChange is not set', () => {
			const store = new Store()
			expect(() => store.tokens.setValue('test')).not.toThrow()
		})
	})

	describe('containerProps (computed)', () => {
		it('include base Container class when nothing is set', () => {
			const store = new Store()
			expect(store.slots.containerProps().className).toContain('Container')
		})

		it('merge user className into containerProps.className', () => {
			const store = new Store()
			store.props.set({separator: null, className: 'my-editor'})
			const {className} = store.slots.containerProps()
			expect(className).toContain('my-editor')
			expect(className).toContain('Container')
		})

		it('merge slotProps.container.className into containerProps.className', () => {
			const store = new Store()
			store.props.set({separator: null, slotProps: {container: {className: 'slot-class'}}})
			expect(store.slots.containerProps().className).toContain('slot-class')
		})

		it('merge style and slotProps.container.style into containerProps.style', () => {
			const store = new Store()
			store.props.set({separator: null, style: {color: 'red'}, slotProps: {container: {style: {fontSize: 14}}}})
			expect(store.slots.containerProps().style).toEqual({color: 'red', fontSize: 14})
		})

		// The gutter is a CSS-ready STRING, not the bare `24` this used to assert: a number is
		// only CSS under React's JSX convention, and Vue drops it.
		it("add paddingLeft: '24px' to style when the document has rows and draggable is true", () => {
			const store = new Store()
			store.props.set({separator: '\n\n', draggable: true, style: {color: 'red'}})
			expect(store.slots.containerProps().style).toEqual({paddingLeft: '24px', color: 'red'})
		})

		it("add paddingLeft: '24px' with no base style when the document has rows and draggable is true", () => {
			const store = new Store()
			store.props.set({separator: '\n\n', draggable: true})
			expect(store.slots.containerProps().style).toEqual({paddingLeft: '24px'})
		})

		it('NOT add paddingLeft when draggable and rowed but readOnly is true', () => {
			const store = new Store()
			store.props.set({separator: '\n\n', draggable: true, readOnly: true, style: {color: 'red'}})
			expect(store.slots.containerProps().style).toEqual({color: 'red'})
		})

		it('not include className or style keys from slotProps in otherSlotProps spread', () => {
			const store = new Store()
			store.props.set({separator: null, slotProps: {container: {className: 'x', style: {color: 'red'}}}})
			const props = store.slots.containerProps()
			// className and style handled explicitly — no duplicate keys at the same level
			const keys = Object.keys(props)
			expect(keys.filter(k => k === 'className')).toHaveLength(1)
			expect(keys.filter(k => k === 'style')).toHaveLength(1)
		})

		it('include data-* slotProps in containerProps', () => {
			const store = new Store()
			store.props.set({separator: null, slotProps: {container: {dataTestId: 'root'}}})
			expect(store.slots.containerProps()).toMatchObject({'data-test-id': 'root'})
		})

		it('return same reference when values unchanged (shallow stable)', () => {
			const store = new Store()
			store.props.set({separator: null, style: {color: 'red'}})
			const first = store.slots.containerProps()
			const second = store.slots.containerProps()
			expect(first).toBe(second)
		})

		it('react to style changes', () => {
			const store = new Store()
			store.props.set({separator: null, style: {color: 'red'}})
			expect(store.slots.containerProps().style).toEqual({color: 'red'})
			store.props.set({separator: null, style: {color: 'blue'}})
			expect(store.slots.containerProps().style).toEqual({color: 'blue'})
		})
	})

	describe('containerComponent (computed)', () => {
		it('return "div" by default', () => {
			const store = new Store()
			expect(store.slots.containerComponent()).toBe('div')
		})

		it('return user-provided slot component', () => {
			const store = new Store()
			store.props.set({separator: null, slots: {container: 'section'}})
			expect(store.slots.containerComponent()).toBe('section')
		})
	})

	describe('the paragraph slot', () => {
		it('resolves a row with no kind to "div" by default', () => {
			const store = new Store()
			const [node] = nodesOf([rowToken('hello', 0, [textToken('hello', 0)])])
			expect(store.slots.node()(node)[0]).toBe('div')
		})

		it('resolves it to the user-provided slot component', () => {
			const store = new Store()
			store.props.set({separator: null, slots: {paragraph: 'article'}})
			const [node] = nodesOf([rowToken('hello', 0, [textToken('hello', 0)])])
			expect(store.slots.node()(node)[0]).toBe('article')
		})

		it('carries the row slotProps onto the row, class and style merged', () => {
			const store = new Store()
			store.props.set({separator: null, slotProps: {row: {dataBlock: 'true', className: 'mine'}}})
			const [node] = nodesOf([rowToken('hello', 0, [textToken('hello', 0)])])
			expect(store.slots.node()(node)[1]).toMatchObject({
				'data-block': 'true',
				className: `${styles.Row} mine`,
			})
		})

		it('resolves a TYPED row through its own kind component', () => {
			const store = new Store()
			store.props.set({
				defaultValue: '# Title',
				separator: '\n\n',
				options: [{markup: '# __slot__', row: {Component: 'h1'}}],
			})
			store.host.container(document.createElement('div'))
			const [node] = store.tokens.nodes()
			expect(store.slots.node()(node)[0]).toBe('h1')
		})
	})

	describe('drag-enabled container padding', () => {
		it('skip drag-handle padding when the value never splits, even if draggable is true', () => {
			const store = new Store()
			store.props.set({separator: null, draggable: true})
			expect(store.slots.containerProps().style?.paddingLeft).toBeUndefined()
		})

		it('skip drag-handle padding when draggable is false', () => {
			const store = new Store()
			store.props.set({separator: '\n\n', draggable: false})
			expect(store.slots.containerProps().style?.paddingLeft).toBeUndefined()
		})

		it('apply drag-handle padding when the document has rows and draggable is true', () => {
			const store = new Store()
			store.props.set({separator: '\n\n', draggable: true})
			expect(store.slots.containerProps().style?.paddingLeft).toBe('24px')
		})

		it('apply drag-handle padding when draggable is a DraggableConfig', () => {
			const store = new Store()
			store.props.set({separator: '\n\n', draggable: {alwaysShowHandle: true}})
			expect(store.slots.containerProps().style?.paddingLeft).toBe('24px')
		})

		it('skip drag-handle padding in read-only mode', () => {
			const store = new Store()
			store.props.set({separator: '\n\n', draggable: true, readOnly: true})
			expect(store.slots.containerProps().style?.paddingLeft).toBeUndefined()
		})
	})

	describe('computed slots', () => {
		it('resolve mark slot for text node using span fallback', () => {
			const store = new Store()
			const [node] = nodesOf([textToken('hello', 0)])
			const [component, props] = store.slots.node()(node)
			expect(component).toBe('span')
			expect(props).toEqual({})
		})

		it('pass value prop to custom Span component for text node', () => {
			const CustomSpan = () => null
			const store = new Store()
			store.props.set({separator: null, Span: CustomSpan})
			const [node] = nodesOf([textToken('hello', 0)])
			const [component, props] = store.slots.node()(node)
			expect(component).toBe(CustomSpan)
			expect(props).toEqual({value: 'hello'})
		})

		it('throw for mark node without Mark component', () => {
			const store = new Store()
			const [node] = nodesOf([markToken('@john', '@[@john]', 0)])
			expect(() => store.slots.node()(node)).toThrow('No mark component found')
		})

		it('resolve overlay from global Overlay component', () => {
			const CustomOverlay = () => null
			const store = new Store()
			store.props.set({separator: null, Overlay: CustomOverlay})
			const [Component, props] = store.overlay.slot()()
			expect(Component).toBe(CustomOverlay)
			expect(props).toEqual({})
		})
	})

	describe('current', () => {
		it('returns empty string by default', () => {
			const store = new Store()
			expect(store.tokens.value()).toBe('')
		})

		it('returns written current value', () => {
			const store = new Store()
			// The read before the write is load-bearing — see `internal state signals` ›
			// 'update when written directly' for the measurement.
			expect(store.tokens.value()).toBe('')
			store.tokens.setValue('cached')
			expect(store.tokens.value()).toBe('cached')
		})

		it('reacts to current changes', () => {
			const store = new Store()
			expect(store.tokens.value()).toBe('')
			store.tokens.setValue('updated')
			expect(store.tokens.value()).toBe('updated')
		})

		it('reacts to props.value changes when controlled', () => {
			const store = new Store()
			store.props.set({separator: null, value: 'initial'})
			expect(store.tokens.value()).toBe('initial')
			store.props.set({separator: null, value: 'changed'})
			expect(store.tokens.value()).toBe('changed')
		})
	})
})