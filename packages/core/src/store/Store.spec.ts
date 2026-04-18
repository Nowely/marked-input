import {describe, it, expect, vi} from 'vitest'

import {parseWithParser} from '../features/parsing'
import {DEFAULT_OPTIONS} from '../shared/constants'
import {effect, effectScope, watch, batch} from '../shared/signals'
import {Store} from './Store'

describe('Store', () => {
	it('should construct with no arguments', () => {
		const store = new Store()
		expect(store.state.tokens()).toEqual([])
		expect(store.props.readOnly()).toBe(false)
	})

	it('should return default for showOverlayOn when not set', () => {
		const store = new Store()
		expect(store.props.showOverlayOn()).toBe('change')
	})

	it('should return default for options when not set', () => {
		const store = new Store()
		expect(store.props.options()).toEqual(DEFAULT_OPTIONS)
	})

	it('should have events', () => {
		const store = new Store()
		expect(typeof store.event.parse).toBe('function')
		expect(typeof store.event.change).toBe('function')
		expect(typeof store.event.delete).toBe('function')
	})

	describe('handler', () => {
		it('should return an object with container, overlay, and focus properties', () => {
			const store = new Store()
			const handler = store.handler
			expect('container' in handler).toBe(true)
			expect('overlay' in handler).toBe(true)
			expect('focus' in handler).toBe(true)
		})

		it('should reflect state.container via handler.container', () => {
			const store = new Store()
			const handler = store.handler
			expect(handler.container).toBe(null)
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub for reference identity check only, no DOM methods used
			const stub = {} as HTMLDivElement
			store.state.container(stub)
			expect(handler.container).toBe(stub)
		})

		it('should reflect state.overlay via handler.overlay', () => {
			const store = new Store()
			const handler = store.handler
			expect(handler.overlay).toBe(null)
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub for reference identity check only, no DOM methods used
			const stub = {} as HTMLElement
			store.state.overlay(stub)
			expect(handler.overlay).toBe(stub)
		})

		it('should expose focus as a callable function', () => {
			const store = new Store()
			const handler = store.handler
			expect(typeof handler.focus).toBe('function')
		})
	})

	describe('internal state signals', () => {
		it('should update when written directly', () => {
			const store = new Store()
			store.state.previousValue('hello')
			expect(store.state.previousValue()).toBe('hello')
		})

		it('should leave other keys unchanged when one signal is updated', () => {
			const store = new Store()
			store.state.selecting('drag')
			expect(store.state.selecting()).toBe('drag')
			expect(store.state.tokens()).toEqual([])
		})

		it('should batch multiple internal writes so effects fire once', () => {
			const store = new Store()
			const effectSpy = vi.fn()
			effect(() => {
				store.state.tokens()
				store.state.selecting()
				effectSpy()
			})
			effectSpy.mockClear()
			const token = {type: 'text' as const, content: 'a', position: {start: 0, end: 1}}
			batch(() => {
				store.state.tokens([token])
				store.state.selecting('all')
			})
			expect(effectSpy).toHaveBeenCalledTimes(1)
		})
	})

	describe('setProps()', () => {
		it('sets individual prop signals', () => {
			const store = new Store()
			store.setProps({value: 'hello'})
			expect(store.props.value()).toBe('hello')
		})

		it('sets multiple prop signals atomically', () => {
			const store = new Store()
			store.setProps({value: 'foo', readOnly: true, className: 'bar'})
			expect(store.props.value()).toBe('foo')
			expect(store.props.readOnly()).toBe(true)
			expect(store.props.className()).toBe('bar')
		})

		it('ignores unknown keys gracefully', () => {
			const store = new Store()
			// TypeScript prevents this at compile time, but guard handles JS callers
			// oxlint-disable-next-line no-unsafe-type-assertion
			store.setProps({nonExistentKey: 'x'} as never)
			// Should not throw
		})

		it('does not modify state when setProps is called', () => {
			const store = new Store()
			const tokensBefore = store.state.tokens()
			store.setProps({value: 'test'})
			expect(store.state.tokens()).toBe(tokensBefore)
		})

		it('ignores direct signal writes on props (readonly guard)', () => {
			const store = new Store()
			store.setProps({value: 'initial'})
			store.props.value('hacked')
			expect(store.props.value()).toBe('initial')
		})
	})

	describe('innerValue', () => {
		it('should update tokens and previousValue when innerValue is set', () => {
			const store = new Store()
			const dispose = effectScope(() => {
				watch(store.state.innerValue, newValue => {
					if (newValue === undefined) return
					const newTokens = parseWithParser(store, newValue)
					batch(() => {
						store.state.tokens(newTokens)
						store.state.previousValue(newValue)
					})
					store.props.onChange()?.(newValue)
				})
			})
			store.state.innerValue('hello')
			expect(store.state.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
			expect(store.state.previousValue()).toBe('hello')
			dispose()
		})

		it('should call onChange when set', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.setProps({onChange})
			const dispose = effectScope(() => {
				watch(store.state.innerValue, newValue => {
					if (newValue === undefined) return
					const newTokens = parseWithParser(store, newValue)
					batch(() => {
						store.state.tokens(newTokens)
						store.state.previousValue(newValue)
					})
					store.props.onChange()?.(newValue)
				})
			})
			store.state.innerValue('world')
			expect(onChange).toHaveBeenCalledOnce()
			expect(onChange).toHaveBeenCalledWith('world')
			dispose()
		})

		it('should not throw when onChange is not set', () => {
			const store = new Store()
			const dispose = effectScope(() => {
				watch(store.state.innerValue, newValue => {
					if (newValue === undefined) return
					const newTokens = parseWithParser(store, newValue)
					batch(() => {
						store.state.tokens(newTokens)
						store.state.previousValue(newValue)
					})
					store.props.onChange()?.(newValue)
				})
			})
			expect(() => store.state.innerValue('test')).not.toThrow()
			dispose()
		})
	})

	describe('containerProps (computed)', () => {
		it('should include base Container class when nothing is set', () => {
			const store = new Store()
			expect(store.computed.containerProps().className).toContain('Container')
		})

		it('should merge user className into containerProps.className', () => {
			const store = new Store()
			store.setProps({className: 'my-editor'})
			const {className} = store.computed.containerProps()
			expect(className).toContain('my-editor')
			expect(className).toContain('Container')
		})

		it('should merge slotProps.container.className into containerProps.className', () => {
			const store = new Store()
			store.setProps({slotProps: {container: {className: 'slot-class'}}})
			expect(store.computed.containerProps().className).toContain('slot-class')
		})

		it('should merge style and slotProps.container.style into containerProps.style', () => {
			const store = new Store()
			store.setProps({
				style: {color: 'red'},
				slotProps: {container: {style: {fontSize: 14}}},
			})
			expect(store.computed.containerProps().style).toEqual({color: 'red', fontSize: 14})
		})

		it('should add paddingLeft: 24 to style when layout is block and draggable is true', () => {
			const store = new Store()
			store.setProps({layout: 'block', draggable: true, style: {color: 'red'}})
			expect(store.computed.containerProps().style).toEqual({paddingLeft: 24, color: 'red'})
		})

		it('should add paddingLeft: 24 with no base style when layout is block and draggable is true', () => {
			const store = new Store()
			store.setProps({layout: 'block', draggable: true})
			expect(store.computed.containerProps().style).toEqual({paddingLeft: 24})
		})

		it('should NOT add paddingLeft when draggable and block but readOnly is true', () => {
			const store = new Store()
			store.setProps({layout: 'block', draggable: true, readOnly: true, style: {color: 'red'}})
			expect(store.computed.containerProps().style).toEqual({color: 'red'})
		})

		it('should not include className or style keys from slotProps in otherSlotProps spread', () => {
			const store = new Store()
			store.setProps({slotProps: {container: {className: 'x', style: {color: 'red'}}}})
			const props = store.computed.containerProps()
			// className and style handled explicitly — no duplicate keys at the same level
			const keys = Object.keys(props)
			expect(keys.filter(k => k === 'className')).toHaveLength(1)
			expect(keys.filter(k => k === 'style')).toHaveLength(1)
		})

		it('should include data-* slotProps in containerProps', () => {
			const store = new Store()
			store.setProps({slotProps: {container: {dataTestId: 'root'}}})
			expect(store.computed.containerProps()).toMatchObject({'data-test-id': 'root'})
		})

		it('should return same reference when values unchanged (shallow stable)', () => {
			const store = new Store()
			store.setProps({style: {color: 'red'}})
			const first = store.computed.containerProps()
			const second = store.computed.containerProps()
			expect(first).toBe(second)
		})

		it('should react to style changes', () => {
			const store = new Store()
			store.setProps({style: {color: 'red'}})
			expect(store.computed.containerProps().style).toEqual({color: 'red'})
			store.setProps({style: {color: 'blue'}})
			expect(store.computed.containerProps().style).toEqual({color: 'blue'})
		})
	})

	describe('containerComponent (computed)', () => {
		it('should return "div" by default', () => {
			const store = new Store()
			expect(store.computed.containerComponent()).toBe('div')
		})

		it('should return user-provided slot component', () => {
			const store = new Store()
			store.setProps({slots: {container: 'section'}})
			expect(store.computed.containerComponent()).toBe('section')
		})
	})

	describe('blockComponent / blockProps (computed)', () => {
		it('should return "div" for blockComponent by default', () => {
			const store = new Store()
			expect(store.computed.blockComponent()).toBe('div')
		})

		it('should return user-provided slot component', () => {
			const store = new Store()
			store.setProps({slots: {block: 'article'}})
			expect(store.computed.blockComponent()).toBe('article')
		})

		it('should return undefined for blockProps by default', () => {
			const store = new Store()
			expect(store.computed.blockProps()).toBeUndefined()
		})

		it('should resolve block slotProps', () => {
			const store = new Store()
			store.setProps({slotProps: {block: {dataBlock: 'true'}}})
			expect(store.computed.blockProps()).toMatchObject({'data-block': 'true'})
		})
	})

	describe('spanComponent / spanProps (computed)', () => {
		it('should return "span" for spanComponent by default', () => {
			const store = new Store()
			expect(store.computed.spanComponent()).toBe('span')
		})

		it('should return undefined for spanProps by default', () => {
			const store = new Store()
			expect(store.computed.spanProps()).toBeUndefined()
		})

		it('should resolve custom span slot', () => {
			const store = new Store()
			store.setProps({slots: {span: 'strong'}})
			expect(store.computed.spanComponent()).toBe('strong')
		})

		it('should resolve span slotProps', () => {
			const store = new Store()
			store.setProps({slotProps: {span: {className: 'bold'}}})
			expect(store.computed.spanProps()).toMatchObject({className: 'bold'})
		})
	})

	describe('isBlock', () => {
		it('should return false when layout is inline', () => {
			const store = new Store()
			store.setProps({layout: 'inline'})
			expect(store.computed.isBlock()).toBe(false)
		})

		it('should return true when layout is block', () => {
			const store = new Store()
			store.setProps({layout: 'block'})
			expect(store.computed.isBlock()).toBe(true)
		})

		it('should default to false', () => {
			const store = new Store()
			expect(store.computed.isBlock()).toBe(false)
		})
	})

	describe('isDraggable', () => {
		it('should return false when draggable is false', () => {
			const store = new Store()
			store.setProps({draggable: false})
			expect(store.computed.isDraggable()).toBe(false)
		})

		it('should return true when draggable is true', () => {
			const store = new Store()
			store.setProps({draggable: true})
			expect(store.computed.isDraggable()).toBe(true)
		})

		it('should return true when draggable is a DraggableConfig', () => {
			const store = new Store()
			store.setProps({draggable: {alwaysShowHandle: true}})
			expect(store.computed.isDraggable()).toBe(true)
		})

		it('should default to false', () => {
			const store = new Store()
			expect(store.computed.isDraggable()).toBe(false)
		})
	})

	describe('hasMark (computed)', () => {
		it('should return false when no Mark override and no per-option Mark', () => {
			const store = new Store()
			expect(store.computed.hasMark()).toBe(false)
		})

		it('should return true when Mark override is set', () => {
			const store = new Store()
			store.setProps({Mark: () => null})
			expect(store.computed.hasMark()).toBe(true)
		})

		it('should return true when option has per-option Mark', () => {
			const store = new Store()
			store.setProps({options: [{markup: '@[__value__]', Mark: () => null} as Record<string, unknown>]})
			expect(store.computed.hasMark()).toBe(true)
		})

		it('should return true when Mark override is set even without per-option Mark', () => {
			const store = new Store()
			store.setProps({Mark: () => null, options: [{markup: '@[__value__]'}]})
			expect(store.computed.hasMark()).toBe(true)
		})

		it('should return false when option has Mark set to null', () => {
			const store = new Store()
			store.setProps({options: [{markup: '@[__value__]', Mark: null} as Record<string, unknown>]})
			expect(store.computed.hasMark()).toBe(false)
		})

		it('should react to Mark override changes', () => {
			const store = new Store()
			expect(store.computed.hasMark()).toBe(false)
			store.setProps({Mark: () => null})
			expect(store.computed.hasMark()).toBe(true)
			store.setProps({Mark: undefined})
			expect(store.computed.hasMark()).toBe(false)
		})
	})

	describe('computed slots', () => {
		it('should resolve mark slot for text token using span fallback', () => {
			const store = new Store()
			const token = {type: 'text', content: 'hello', position: {start: 0, end: 5}} as const
			const [component, props] = store.computed.mark()(token)
			expect(component).toBe('span')
			expect(props).toEqual({})
		})

		it('should pass value prop to custom Span component for text token', () => {
			const CustomSpan = () => null
			const store = new Store()
			store.setProps({Span: CustomSpan})
			const token = {type: 'text', content: 'hello', position: {start: 0, end: 5}} as const
			const [component, props] = store.computed.mark()(token)
			expect(component).toBe(CustomSpan)
			expect(props).toEqual({value: 'hello'})
		})

		it('should throw for mark token without Mark component', () => {
			const store = new Store()
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub for test
			const token = {
				type: 'mark',
				value: '@john',
				meta: undefined,
				descriptor: {index: 0},
				position: {start: 0, end: 5},
			} as any
			expect(() => store.computed.mark()(token)).toThrow('No mark component found')
		})

		it('should resolve overlay from global Overlay component', () => {
			const CustomOverlay = () => null
			const store = new Store()
			store.setProps({Overlay: CustomOverlay})
			const [Component, props] = store.computed.overlay()()
			expect(Component).toBe(CustomOverlay)
			expect(props).toEqual({})
		})
	})

	describe('currentValue (computed)', () => {
		it('should return empty string when both previousValue and value are undefined', () => {
			const store = new Store()
			expect(store.computed.currentValue()).toBe('')
		})

		it('should return previousValue when set', () => {
			const store = new Store()
			store.state.previousValue('cached')
			expect(store.computed.currentValue()).toBe('cached')
		})

		it('should fall back to props.value when previousValue is undefined', () => {
			const store = new Store()
			store.setProps({value: 'prop-value'})
			expect(store.computed.currentValue()).toBe('prop-value')
		})

		it('should prefer previousValue over props.value', () => {
			const store = new Store()
			store.state.previousValue('cached')
			store.setProps({value: 'prop-value'})
			expect(store.computed.currentValue()).toBe('cached')
		})

		it('should react to previousValue changes', () => {
			const store = new Store()
			expect(store.computed.currentValue()).toBe('')
			store.state.previousValue('updated')
			expect(store.computed.currentValue()).toBe('updated')
		})

		it('should react to props.value changes when previousValue is undefined', () => {
			const store = new Store()
			store.setProps({value: 'initial'})
			expect(store.computed.currentValue()).toBe('initial')
			store.setProps({value: 'changed'})
			expect(store.computed.currentValue()).toBe('changed')
		})
	})
})