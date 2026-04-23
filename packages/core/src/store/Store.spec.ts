import {describe, it, expect, vi} from 'vitest'

import {parseWithParser} from '../features/parsing'
import {DEFAULT_OPTIONS} from '../shared/constants'
import {effect, effectScope, watch, batch} from '../shared/signals'
import {Store} from './Store'

describe('Store', () => {
	it('construct with no arguments', () => {
		const store = new Store()
		expect(store.parsing.tokens()).toEqual([])
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
		expect(typeof store.parsing.reparse).toBe('function')
		expect(typeof store.value.change).toBe('function')
		expect(typeof store.mark.remove).toBe('function')
	})

	describe('handler', () => {
		it('return an object with container, overlay, and focus properties', () => {
			const store = new Store()
			const handler = store.handler
			expect('container' in handler).toBe(true)
			expect('overlay' in handler).toBe(true)
			expect('focus' in handler).toBe(true)
		})

		it('reflect state.container via handler.container', () => {
			const store = new Store()
			const handler = store.handler
			expect(handler.container).toBe(null)
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub for reference identity check only, no DOM methods used
			const stub = {} as HTMLDivElement
			store.slots.container(stub)
			expect(handler.container).toBe(stub)
		})

		it('reflect state.overlay via handler.overlay', () => {
			const store = new Store()
			const handler = store.handler
			expect(handler.overlay).toBe(null)
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub for reference identity check only, no DOM methods used
			const stub = {} as HTMLElement
			store.overlay.overlay(stub)
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
			store.value.last('hello')
			expect(store.value.last()).toBe('hello')
		})

		it('leave other keys unchanged when one signal is updated', () => {
			const store = new Store()
			store.caret.selecting('drag')
			expect(store.caret.selecting()).toBe('drag')
			expect(store.parsing.tokens()).toEqual([])
		})

		it('batch multiple internal writes so effects fire once', () => {
			const store = new Store()
			const effectSpy = vi.fn()
			effect(() => {
				store.parsing.tokens()
				store.caret.selecting()
				effectSpy()
			})
			effectSpy.mockClear()
			const token = {type: 'text' as const, content: 'a', position: {start: 0, end: 1}}
			batch(() => {
				store.parsing.tokens([token])
				store.caret.selecting('all')
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
			const tokensBefore = store.parsing.tokens()
			store.props.set({value: 'test'})
			expect(store.parsing.tokens()).toBe(tokensBefore)
		})

		it('ignores direct signal writes on props (readonly guard)', () => {
			const store = new Store()
			store.props.set({value: 'initial'})
			store.props.value('hacked')
			expect(store.props.value()).toBe('initial')
		})
	})

	describe('next', () => {
		it('update tokens and last when next is set', () => {
			const store = new Store()
			const dispose = effectScope(() => {
				watch(store.value.next, newValue => {
					if (newValue === undefined) return
					const newTokens = parseWithParser(store, newValue)
					batch(() => {
						store.parsing.tokens(newTokens)
						store.value.last(newValue)
					})
					store.props.onChange()?.(newValue)
				})
			})
			store.value.next('hello')
			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
			expect(store.value.last()).toBe('hello')
			dispose()
		})

		it('call onChange when set', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.set({onChange})
			const dispose = effectScope(() => {
				watch(store.value.next, newValue => {
					if (newValue === undefined) return
					const newTokens = parseWithParser(store, newValue)
					batch(() => {
						store.parsing.tokens(newTokens)
						store.value.last(newValue)
					})
					store.props.onChange()?.(newValue)
				})
			})
			store.value.next('world')
			expect(onChange).toHaveBeenCalledOnce()
			expect(onChange).toHaveBeenCalledWith('world')
			dispose()
		})

		it('not throw when onChange is not set', () => {
			const store = new Store()
			const dispose = effectScope(() => {
				watch(store.value.next, newValue => {
					if (newValue === undefined) return
					const newTokens = parseWithParser(store, newValue)
					batch(() => {
						store.parsing.tokens(newTokens)
						store.value.last(newValue)
					})
					store.props.onChange()?.(newValue)
				})
			})
			expect(() => store.value.next('test')).not.toThrow()
			dispose()
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

	describe('spanComponent / spanProps (computed)', () => {
		it('return "span" for spanComponent by default', () => {
			const store = new Store()
			expect(store.slots.spanComponent()).toBe('span')
		})

		it('return undefined for spanProps by default', () => {
			const store = new Store()
			expect(store.slots.spanProps()).toBeUndefined()
		})

		it('resolve custom span slot', () => {
			const store = new Store()
			store.props.set({slots: {span: 'strong'}})
			expect(store.slots.spanComponent()).toBe('strong')
		})

		it('resolve span slotProps', () => {
			const store = new Store()
			store.props.set({slotProps: {span: {className: 'bold'}}})
			expect(store.slots.spanProps()).toMatchObject({className: 'bold'})
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

	describe('isDraggable', () => {
		it('return false when draggable is false', () => {
			const store = new Store()
			store.props.set({draggable: false})
			expect(store.slots.isDraggable()).toBe(false)
		})

		it('return true when draggable is true', () => {
			const store = new Store()
			store.props.set({draggable: true})
			expect(store.slots.isDraggable()).toBe(true)
		})

		it('return true when draggable is a DraggableConfig', () => {
			const store = new Store()
			store.props.set({draggable: {alwaysShowHandle: true}})
			expect(store.slots.isDraggable()).toBe(true)
		})

		it('default to false', () => {
			const store = new Store()
			expect(store.slots.isDraggable()).toBe(false)
		})
	})

	describe('enabled (computed)', () => {
		it('return false when no Mark override and no per-option Mark', () => {
			const store = new Store()
			expect(store.mark.enabled()).toBe(false)
		})

		it('return true when Mark override is set', () => {
			const store = new Store()
			store.props.set({Mark: () => null})
			expect(store.mark.enabled()).toBe(true)
		})

		it('return true when option has per-option Mark', () => {
			const store = new Store()
			store.props.set({options: [{markup: '@[__value__]', Mark: () => null} as Record<string, unknown>]})
			expect(store.mark.enabled()).toBe(true)
		})

		it('return true when Mark override is set even without per-option Mark', () => {
			const store = new Store()
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
			expect(store.mark.enabled()).toBe(true)
		})

		it('return false when option has Mark set to null', () => {
			const store = new Store()
			store.props.set({options: [{markup: '@[__value__]', Mark: null} as Record<string, unknown>]})
			expect(store.mark.enabled()).toBe(false)
		})

		it('react to Mark override changes', () => {
			const store = new Store()
			expect(store.mark.enabled()).toBe(false)
			store.props.set({Mark: () => null})
			expect(store.mark.enabled()).toBe(true)
			store.props.set({Mark: undefined})
			expect(store.mark.enabled()).toBe(false)
		})
	})

	describe('computed slots', () => {
		it('resolve mark slot for text token using span fallback', () => {
			const store = new Store()
			const token = {type: 'text', content: 'hello', position: {start: 0, end: 5}} as const
			const [component, props] = store.mark.slot()(token)
			expect(component).toBe('span')
			expect(props).toEqual({})
		})

		it('pass value prop to custom Span component for text token', () => {
			const CustomSpan = () => null
			const store = new Store()
			store.props.set({Span: CustomSpan})
			const token = {type: 'text', content: 'hello', position: {start: 0, end: 5}} as const
			const [component, props] = store.mark.slot()(token)
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
			expect(() => store.mark.slot()(token)).toThrow('No mark component found')
		})

		it('resolve overlay from global Overlay component', () => {
			const CustomOverlay = () => null
			const store = new Store()
			store.props.set({Overlay: CustomOverlay})
			const [Component, props] = store.overlay.overlaySlot()()
			expect(Component).toBe(CustomOverlay)
			expect(props).toEqual({})
		})
	})

	describe('current (computed)', () => {
		it('return empty string when both last and value are undefined', () => {
			const store = new Store()
			expect(store.value.current()).toBe('')
		})

		it('return last when set', () => {
			const store = new Store()
			store.value.last('cached')
			expect(store.value.current()).toBe('cached')
		})

		it('fall back to props.value when last is undefined', () => {
			const store = new Store()
			store.props.set({value: 'prop-value'})
			expect(store.value.current()).toBe('prop-value')
		})

		it('prefer last over props.value', () => {
			const store = new Store()
			store.value.last('cached')
			store.props.set({value: 'prop-value'})
			expect(store.value.current()).toBe('cached')
		})

		it('react to last changes', () => {
			const store = new Store()
			expect(store.value.current()).toBe('')
			store.value.last('updated')
			expect(store.value.current()).toBe('updated')
		})

		it('react to props.value changes when last is undefined', () => {
			const store = new Store()
			store.props.set({value: 'initial'})
			expect(store.value.current()).toBe('initial')
			store.props.set({value: 'changed'})
			expect(store.value.current()).toBe('changed')
		})
	})
})