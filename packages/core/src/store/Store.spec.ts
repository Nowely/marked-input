import {describe, it, expect, vi} from 'vitest'

import {DEFAULT_OPTIONS} from '../shared/constants'
import {effect, batch} from '../shared/signals'
import {Store} from './Store'

describe('Store', () => {
	it('construct with no arguments', () => {
		const store = new Store()
		expect(store.tokens.current()).toEqual([])
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

	it('have events', () => {
		const store = new Store()
		expect(typeof store.tokens.invalidate).toBe('function')
	})

	describe('handler', () => {
		it('return an object with container, overlay, and focus properties', () => {
			const store = new Store()
			const handler = store.handler
			expect('container' in handler).toBe(true)
			expect('overlay' in handler).toBe(true)
			expect('focus' in handler).toBe(true)
		})

		it('reflect dom container via handler.container', () => {
			const store = new Store()
			const handler = store.handler
			expect(handler.container).toBe(null)
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub for reference identity check only, no DOM methods used
			const stub = {} as HTMLDivElement
			store.dom.container(stub)
			expect(handler.container).toBe(stub)
		})

		it('reflect state.overlay via handler.overlay', () => {
			const store = new Store()
			const handler = store.handler
			expect(handler.overlay).toBe(null)
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub for reference identity check only, no DOM methods used
			const stub = {} as HTMLElement
			store.overlay.element(stub)
			expect(handler.overlay).toBe(stub)
		})

		it('expose focus as a callable function', () => {
			const store = new Store()
			const handler = store.handler
			expect(typeof handler.focus).toBe('function')
		})
	})

	describe('internal state signals', () => {
		it('update when written directly', () => {
			const store = new Store()
			store.value.current('hello')
			expect(store.value.current()).toBe('hello')
		})

		it('leave other keys unchanged when one signal is updated', () => {
			const store = new Store()
			store.selection.isUserSelecting(true)
			expect(store.selection.isUserSelecting()).toBe(true)
			expect(store.tokens.current()).toEqual([])
		})

		it('batch multiple internal writes so effects fire once', () => {
			const store = new Store()
			const effectSpy = vi.fn()
			effect(() => {
				store.tokens.current()
				store.selection.isUserSelecting()
				effectSpy()
			})
			effectSpy.mockClear()
			const token = {type: 'text' as const, content: 'a', position: {start: 0, end: 1}}
			batch(() => {
				store.tokens.set([token])
				store.selection.isUserSelecting(true)
			})
			expect(effectSpy).toHaveBeenCalledTimes(1)
		})
	})

	describe('props.set()', () => {
		it('sets individual prop signals', () => {
			const store = new Store()
			store.props.set({value: 'hello'})
			expect(store.props.value()).toBe('hello')
		})

		it('sets multiple prop signals atomically', () => {
			const store = new Store()
			store.props.set({value: 'foo', readOnly: true, className: 'bar'})
			expect(store.props.value()).toBe('foo')
			expect(store.props.readOnly()).toBe(true)
			expect(store.props.className()).toBe('bar')
		})

		it('ignores unknown keys gracefully', () => {
			const store = new Store()
			// TypeScript prevents this at compile time, but guard handles JS callers
			// oxlint-disable-next-line no-unsafe-type-assertion
			store.props.set({nonExistentKey: 'x'} as never)
			// Should not throw
		})

		it('does not modify state when props.set is called', () => {
			const store = new Store()
			const tokensBefore = store.tokens.current()
			store.props.set({value: 'test'})
			expect(store.tokens.current()).toBe(tokensBefore)
		})

		it('ignores direct signal writes on props (readonly guard)', () => {
			const store = new Store()
			store.props.set({value: 'initial'})
			store.props.value('hacked')
			expect(store.props.value()).toBe('initial')
		})
	})

	describe('value edits', () => {
		it('updates tokens and current when uncontrolled replacement is accepted', () => {
			const store = new Store()
			store.lifecycle.mounted()
			store.value.current('hello')
			expect(store.tokens.current()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
			expect(store.value.current()).toBe('hello')
		})

		it('calls onChange when uncontrolled replacement is accepted', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.set({onChange})
			store.lifecycle.mounted()
			store.value.current('world')
			expect(onChange).toHaveBeenCalledOnce()
			expect(onChange).toHaveBeenCalledWith('world')
		})

		it('emits without committing until controlled replacement is echoed', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.set({value: 'hello', onChange})
			store.lifecycle.mounted()
			store.value.current('world')
			expect(onChange).toHaveBeenCalledWith('world')
			expect(store.value.current()).toBe('hello')
			expect(store.tokens.current()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
		})

		it('not throw when onChange is not set', () => {
			const store = new Store()
			store.lifecycle.mounted()
			expect(() => store.value.current('test')).not.toThrow()
		})
	})

	describe('containerProps (computed)', () => {
		it('include base Container class when nothing is set', () => {
			const store = new Store()
			expect(store.slots.containerProps().className).toContain('Container')
		})

		it('merge user className into containerProps.className', () => {
			const store = new Store()
			store.props.set({className: 'my-editor'})
			const {className} = store.slots.containerProps()
			expect(className).toContain('my-editor')
			expect(className).toContain('Container')
		})

		it('merge slotProps.container.className into containerProps.className', () => {
			const store = new Store()
			store.props.set({slotProps: {container: {className: 'slot-class'}}})
			expect(store.slots.containerProps().className).toContain('slot-class')
		})

		it('merge style and slotProps.container.style into containerProps.style', () => {
			const store = new Store()
			store.props.set({
				style: {color: 'red'},
				slotProps: {container: {style: {fontSize: 14}}},
			})
			expect(store.slots.containerProps().style).toEqual({color: 'red', fontSize: 14})
		})

		it('add paddingLeft: 24 to style when layout is block and draggable is true', () => {
			const store = new Store()
			store.props.set({layout: 'block', draggable: true, style: {color: 'red'}})
			expect(store.slots.containerProps().style).toEqual({paddingLeft: 24, color: 'red'})
		})

		it('add paddingLeft: 24 with no base style when layout is block and draggable is true', () => {
			const store = new Store()
			store.props.set({layout: 'block', draggable: true})
			expect(store.slots.containerProps().style).toEqual({paddingLeft: 24})
		})

		it('NOT add paddingLeft when draggable and block but readOnly is true', () => {
			const store = new Store()
			store.props.set({layout: 'block', draggable: true, readOnly: true, style: {color: 'red'}})
			expect(store.slots.containerProps().style).toEqual({color: 'red'})
		})

		it('not include className or style keys from slotProps in otherSlotProps spread', () => {
			const store = new Store()
			store.props.set({slotProps: {container: {className: 'x', style: {color: 'red'}}}})
			const props = store.slots.containerProps()
			// className and style handled explicitly — no duplicate keys at the same level
			const keys = Object.keys(props)
			expect(keys.filter(k => k === 'className')).toHaveLength(1)
			expect(keys.filter(k => k === 'style')).toHaveLength(1)
		})

		it('include data-* slotProps in containerProps', () => {
			const store = new Store()
			store.props.set({slotProps: {container: {dataTestId: 'root'}}})
			expect(store.slots.containerProps()).toMatchObject({'data-test-id': 'root'})
		})

		it('return same reference when values unchanged (shallow stable)', () => {
			const store = new Store()
			store.props.set({style: {color: 'red'}})
			const first = store.slots.containerProps()
			const second = store.slots.containerProps()
			expect(first).toBe(second)
		})

		it('react to style changes', () => {
			const store = new Store()
			store.props.set({style: {color: 'red'}})
			expect(store.slots.containerProps().style).toEqual({color: 'red'})
			store.props.set({style: {color: 'blue'}})
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
			store.props.set({slots: {container: 'section'}})
			expect(store.slots.containerComponent()).toBe('section')
		})
	})

	describe('blockComponent / blockProps (computed)', () => {
		it('return "div" for blockComponent by default', () => {
			const store = new Store()
			expect(store.slots.blockComponent()).toBe('div')
		})

		it('return user-provided slot component', () => {
			const store = new Store()
			store.props.set({slots: {block: 'article'}})
			expect(store.slots.blockComponent()).toBe('article')
		})

		it('return undefined for blockProps by default', () => {
			const store = new Store()
			expect(store.slots.blockProps()).toBeUndefined()
		})

		it('resolve block slotProps', () => {
			const store = new Store()
			store.props.set({slotProps: {block: {dataBlock: 'true'}}})
			expect(store.slots.blockProps()).toMatchObject({'data-block': 'true'})
		})
	})

	describe('isBlock', () => {
		it('return false when layout is inline', () => {
			const store = new Store()
			store.props.set({layout: 'inline'})
			expect(store.slots.isBlock()).toBe(false)
		})

		it('return true when layout is block', () => {
			const store = new Store()
			store.props.set({layout: 'block'})
			expect(store.slots.isBlock()).toBe(true)
		})

		it('default to false', () => {
			const store = new Store()
			expect(store.slots.isBlock()).toBe(false)
		})
	})

	describe('isDragEnabled', () => {
		it('returns false when layout is inline even if draggable is true', () => {
			const store = new Store()
			store.props.set({layout: 'inline', draggable: true})
			expect(store.slots.isDragEnabled()).toBe(false)
		})

		it('returns false when draggable is false', () => {
			const store = new Store()
			store.props.set({layout: 'block', draggable: false})
			expect(store.slots.isDragEnabled()).toBe(false)
		})

		it('returns true when layout is block and draggable is true', () => {
			const store = new Store()
			store.props.set({layout: 'block', draggable: true})
			expect(store.slots.isDragEnabled()).toBe(true)
		})

		it('returns true when layout is block and draggable is a DraggableConfig', () => {
			const store = new Store()
			store.props.set({layout: 'block', draggable: {alwaysShowHandle: true}})
			expect(store.slots.isDragEnabled()).toBe(true)
		})

		it('defaults to false', () => {
			const store = new Store()
			expect(store.slots.isDragEnabled()).toBe(false)
		})
	})

	describe('computed slots', () => {
		it('resolve mark slot for text token using span fallback', () => {
			const store = new Store()
			const token = {type: 'text', content: 'hello', position: {start: 0, end: 5}} as const
			const [component, props] = store.slots.mark()(token)
			expect(component).toBe('span')
			expect(props).toEqual({})
		})

		it('pass value prop to custom Span component for text token', () => {
			const CustomSpan = () => null
			const store = new Store()
			store.props.set({Span: CustomSpan})
			const token = {type: 'text', content: 'hello', position: {start: 0, end: 5}} as const
			const [component, props] = store.slots.mark()(token)
			expect(component).toBe(CustomSpan)
			expect(props).toEqual({value: 'hello'})
		})

		it('throw for mark token without Mark component', () => {
			const store = new Store()
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub for test
			const token = {
				type: 'mark',
				value: '@john',
				meta: undefined,
				descriptor: {index: 0},
				position: {start: 0, end: 5},
			} as any
			expect(() => store.slots.mark()(token)).toThrow('No mark component found')
		})

		it('resolve overlay from global Overlay component', () => {
			const CustomOverlay = () => null
			const store = new Store()
			store.props.set({Overlay: CustomOverlay})
			const [Component, props] = store.overlay.slot()()
			expect(Component).toBe(CustomOverlay)
			expect(props).toEqual({})
		})
	})

	describe('current', () => {
		it('returns empty string by default', () => {
			const store = new Store()
			expect(store.value.current()).toBe('')
		})

		it('returns written current value', () => {
			const store = new Store()
			store.value.current('cached')
			expect(store.value.current()).toBe('cached')
		})

		it('reacts to current changes', () => {
			const store = new Store()
			expect(store.value.current()).toBe('')
			store.value.current('updated')
			expect(store.value.current()).toBe('updated')
		})

		it('reacts to props.value changes when ValueModel is enabled', () => {
			const store = new Store()
			store.props.set({value: 'initial'})
			store.lifecycle.mounted()
			expect(store.value.current()).toBe('initial')
			store.props.set({value: 'changed'})
			expect(store.value.current()).toBe('changed')
		})
	})
})