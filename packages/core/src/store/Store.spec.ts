import {describe, it, expect, vi} from 'vitest'

import {parseWithParser} from '../features/parsing'
import {DEFAULT_OPTIONS} from '../shared/constants'
import {effect, effectScope, watch, batch} from '../shared/signals'
import {Store} from './Store'

describe('Store', () => {
	it('construct with no arguments', () => {
		const store = new Store()
		expect(store.feature.parsing.state.tokens()).toEqual([])
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
		expect(typeof store.feature.parsing.emit.reparse).toBe('function')
		expect(typeof store.feature.value.emit.change).toBe('function')
		expect(typeof store.feature.mark.emit.markRemove).toBe('function')
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
			store.feature.slots.state.container(stub)
			expect(handler.container).toBe(stub)
		})

		it('reflect state.overlay via handler.overlay', () => {
			const store = new Store()
			const handler = store.handler
			expect(handler.overlay).toBe(null)
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub for reference identity check only, no DOM methods used
			const stub = {} as HTMLElement
			store.feature.overlay.state.overlay(stub)
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
			store.feature.value.state.previousValue('hello')
			expect(store.feature.value.state.previousValue()).toBe('hello')
		})

		it('leave other keys unchanged when one signal is updated', () => {
			const store = new Store()
			store.feature.caret.state.selecting('drag')
			expect(store.feature.caret.state.selecting()).toBe('drag')
			expect(store.feature.parsing.state.tokens()).toEqual([])
		})

		it('batch multiple internal writes so effects fire once', () => {
			const store = new Store()
			const effectSpy = vi.fn()
			effect(() => {
				store.feature.parsing.state.tokens()
				store.feature.caret.state.selecting()
				effectSpy()
			})
			effectSpy.mockClear()
			const token = {type: 'text' as const, content: 'a', position: {start: 0, end: 1}}
			batch(() => {
				store.feature.parsing.state.tokens([token])
				store.feature.caret.state.selecting('all')
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
			const tokensBefore = store.feature.parsing.state.tokens()
			store.props.set({value: 'test'})
			expect(store.feature.parsing.state.tokens()).toBe(tokensBefore)
		})

		it('ignores direct signal writes on props (readonly guard)', () => {
			const store = new Store()
			store.props.set({value: 'initial'})
			store.props.value('hacked')
			expect(store.props.value()).toBe('initial')
		})
	})

	describe('innerValue', () => {
		it('update tokens and previousValue when innerValue is set', () => {
			const store = new Store()
			const dispose = effectScope(() => {
				watch(store.feature.value.state.innerValue, newValue => {
					if (newValue === undefined) return
					const newTokens = parseWithParser(store, newValue)
					batch(() => {
						store.feature.parsing.state.tokens(newTokens)
						store.feature.value.state.previousValue(newValue)
					})
					store.props.onChange()?.(newValue)
				})
			})
			store.feature.value.state.innerValue('hello')
			expect(store.feature.parsing.state.tokens()).toEqual([
				{type: 'text', content: 'hello', position: {start: 0, end: 5}},
			])
			expect(store.feature.value.state.previousValue()).toBe('hello')
			dispose()
		})

		it('call onChange when set', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.set({onChange})
			const dispose = effectScope(() => {
				watch(store.feature.value.state.innerValue, newValue => {
					if (newValue === undefined) return
					const newTokens = parseWithParser(store, newValue)
					batch(() => {
						store.feature.parsing.state.tokens(newTokens)
						store.feature.value.state.previousValue(newValue)
					})
					store.props.onChange()?.(newValue)
				})
			})
			store.feature.value.state.innerValue('world')
			expect(onChange).toHaveBeenCalledOnce()
			expect(onChange).toHaveBeenCalledWith('world')
			dispose()
		})

		it('not throw when onChange is not set', () => {
			const store = new Store()
			const dispose = effectScope(() => {
				watch(store.feature.value.state.innerValue, newValue => {
					if (newValue === undefined) return
					const newTokens = parseWithParser(store, newValue)
					batch(() => {
						store.feature.parsing.state.tokens(newTokens)
						store.feature.value.state.previousValue(newValue)
					})
					store.props.onChange()?.(newValue)
				})
			})
			expect(() => store.feature.value.state.innerValue('test')).not.toThrow()
			dispose()
		})
	})

	describe('containerProps (computed)', () => {
		it('include base Container class when nothing is set', () => {
			const store = new Store()
			expect(store.feature.slots.computed.containerProps().className).toContain('Container')
		})

		it('merge user className into containerProps.className', () => {
			const store = new Store()
			store.props.set({className: 'my-editor'})
			const {className} = store.feature.slots.computed.containerProps()
			expect(className).toContain('my-editor')
			expect(className).toContain('Container')
		})

		it('merge slotProps.container.className into containerProps.className', () => {
			const store = new Store()
			store.props.set({slotProps: {container: {className: 'slot-class'}}})
			expect(store.feature.slots.computed.containerProps().className).toContain('slot-class')
		})

		it('merge style and slotProps.container.style into containerProps.style', () => {
			const store = new Store()
			store.props.set({
				style: {color: 'red'},
				slotProps: {container: {style: {fontSize: 14}}},
			})
			expect(store.feature.slots.computed.containerProps().style).toEqual({color: 'red', fontSize: 14})
		})

		it('add paddingLeft: 24 to style when layout is block and draggable is true', () => {
			const store = new Store()
			store.props.set({layout: 'block', draggable: true, style: {color: 'red'}})
			expect(store.feature.slots.computed.containerProps().style).toEqual({paddingLeft: 24, color: 'red'})
		})

		it('add paddingLeft: 24 with no base style when layout is block and draggable is true', () => {
			const store = new Store()
			store.props.set({layout: 'block', draggable: true})
			expect(store.feature.slots.computed.containerProps().style).toEqual({paddingLeft: 24})
		})

		it('NOT add paddingLeft when draggable and block but readOnly is true', () => {
			const store = new Store()
			store.props.set({layout: 'block', draggable: true, readOnly: true, style: {color: 'red'}})
			expect(store.feature.slots.computed.containerProps().style).toEqual({color: 'red'})
		})

		it('not include className or style keys from slotProps in otherSlotProps spread', () => {
			const store = new Store()
			store.props.set({slotProps: {container: {className: 'x', style: {color: 'red'}}}})
			const props = store.feature.slots.computed.containerProps()
			// className and style handled explicitly — no duplicate keys at the same level
			const keys = Object.keys(props)
			expect(keys.filter(k => k === 'className')).toHaveLength(1)
			expect(keys.filter(k => k === 'style')).toHaveLength(1)
		})

		it('include data-* slotProps in containerProps', () => {
			const store = new Store()
			store.props.set({slotProps: {container: {dataTestId: 'root'}}})
			expect(store.feature.slots.computed.containerProps()).toMatchObject({'data-test-id': 'root'})
		})

		it('return same reference when values unchanged (shallow stable)', () => {
			const store = new Store()
			store.props.set({style: {color: 'red'}})
			const first = store.feature.slots.computed.containerProps()
			const second = store.feature.slots.computed.containerProps()
			expect(first).toBe(second)
		})

		it('react to style changes', () => {
			const store = new Store()
			store.props.set({style: {color: 'red'}})
			expect(store.feature.slots.computed.containerProps().style).toEqual({color: 'red'})
			store.props.set({style: {color: 'blue'}})
			expect(store.feature.slots.computed.containerProps().style).toEqual({color: 'blue'})
		})
	})

	describe('containerComponent (computed)', () => {
		it('return "div" by default', () => {
			const store = new Store()
			expect(store.feature.slots.computed.containerComponent()).toBe('div')
		})

		it('return user-provided slot component', () => {
			const store = new Store()
			store.props.set({slots: {container: 'section'}})
			expect(store.feature.slots.computed.containerComponent()).toBe('section')
		})
	})

	describe('blockComponent / blockProps (computed)', () => {
		it('return "div" for blockComponent by default', () => {
			const store = new Store()
			expect(store.feature.slots.computed.blockComponent()).toBe('div')
		})

		it('return user-provided slot component', () => {
			const store = new Store()
			store.props.set({slots: {block: 'article'}})
			expect(store.feature.slots.computed.blockComponent()).toBe('article')
		})

		it('return undefined for blockProps by default', () => {
			const store = new Store()
			expect(store.feature.slots.computed.blockProps()).toBeUndefined()
		})

		it('resolve block slotProps', () => {
			const store = new Store()
			store.props.set({slotProps: {block: {dataBlock: 'true'}}})
			expect(store.feature.slots.computed.blockProps()).toMatchObject({'data-block': 'true'})
		})
	})

	describe('spanComponent / spanProps (computed)', () => {
		it('return "span" for spanComponent by default', () => {
			const store = new Store()
			expect(store.feature.slots.computed.spanComponent()).toBe('span')
		})

		it('return undefined for spanProps by default', () => {
			const store = new Store()
			expect(store.feature.slots.computed.spanProps()).toBeUndefined()
		})

		it('resolve custom span slot', () => {
			const store = new Store()
			store.props.set({slots: {span: 'strong'}})
			expect(store.feature.slots.computed.spanComponent()).toBe('strong')
		})

		it('resolve span slotProps', () => {
			const store = new Store()
			store.props.set({slotProps: {span: {className: 'bold'}}})
			expect(store.feature.slots.computed.spanProps()).toMatchObject({className: 'bold'})
		})
	})

	describe('isBlock', () => {
		it('return false when layout is inline', () => {
			const store = new Store()
			store.props.set({layout: 'inline'})
			expect(store.feature.slots.computed.isBlock()).toBe(false)
		})

		it('return true when layout is block', () => {
			const store = new Store()
			store.props.set({layout: 'block'})
			expect(store.feature.slots.computed.isBlock()).toBe(true)
		})

		it('default to false', () => {
			const store = new Store()
			expect(store.feature.slots.computed.isBlock()).toBe(false)
		})
	})

	describe('isDraggable', () => {
		it('return false when draggable is false', () => {
			const store = new Store()
			store.props.set({draggable: false})
			expect(store.feature.slots.computed.isDraggable()).toBe(false)
		})

		it('return true when draggable is true', () => {
			const store = new Store()
			store.props.set({draggable: true})
			expect(store.feature.slots.computed.isDraggable()).toBe(true)
		})

		it('return true when draggable is a DraggableConfig', () => {
			const store = new Store()
			store.props.set({draggable: {alwaysShowHandle: true}})
			expect(store.feature.slots.computed.isDraggable()).toBe(true)
		})

		it('default to false', () => {
			const store = new Store()
			expect(store.feature.slots.computed.isDraggable()).toBe(false)
		})
	})

	describe('hasMark (computed)', () => {
		it('return false when no Mark override and no per-option Mark', () => {
			const store = new Store()
			expect(store.feature.mark.computed.hasMark()).toBe(false)
		})

		it('return true when Mark override is set', () => {
			const store = new Store()
			store.props.set({Mark: () => null})
			expect(store.feature.mark.computed.hasMark()).toBe(true)
		})

		it('return true when option has per-option Mark', () => {
			const store = new Store()
			store.props.set({options: [{markup: '@[__value__]', Mark: () => null} as Record<string, unknown>]})
			expect(store.feature.mark.computed.hasMark()).toBe(true)
		})

		it('return true when Mark override is set even without per-option Mark', () => {
			const store = new Store()
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
			expect(store.feature.mark.computed.hasMark()).toBe(true)
		})

		it('return false when option has Mark set to null', () => {
			const store = new Store()
			store.props.set({options: [{markup: '@[__value__]', Mark: null} as Record<string, unknown>]})
			expect(store.feature.mark.computed.hasMark()).toBe(false)
		})

		it('react to Mark override changes', () => {
			const store = new Store()
			expect(store.feature.mark.computed.hasMark()).toBe(false)
			store.props.set({Mark: () => null})
			expect(store.feature.mark.computed.hasMark()).toBe(true)
			store.props.set({Mark: undefined})
			expect(store.feature.mark.computed.hasMark()).toBe(false)
		})
	})

	describe('computed slots', () => {
		it('resolve mark slot for text token using span fallback', () => {
			const store = new Store()
			const token = {type: 'text', content: 'hello', position: {start: 0, end: 5}} as const
			const [component, props] = store.feature.mark.computed.mark()(token)
			expect(component).toBe('span')
			expect(props).toEqual({})
		})

		it('pass value prop to custom Span component for text token', () => {
			const CustomSpan = () => null
			const store = new Store()
			store.props.set({Span: CustomSpan})
			const token = {type: 'text', content: 'hello', position: {start: 0, end: 5}} as const
			const [component, props] = store.feature.mark.computed.mark()(token)
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
			expect(() => store.feature.mark.computed.mark()(token)).toThrow('No mark component found')
		})

		it('resolve overlay from global Overlay component', () => {
			const CustomOverlay = () => null
			const store = new Store()
			store.props.set({Overlay: CustomOverlay})
			const [Component, props] = store.feature.overlay.computed.overlay()()
			expect(Component).toBe(CustomOverlay)
			expect(props).toEqual({})
		})
	})

	describe('currentValue (computed)', () => {
		it('return empty string when both previousValue and value are undefined', () => {
			const store = new Store()
			expect(store.feature.value.computed.currentValue()).toBe('')
		})

		it('return previousValue when set', () => {
			const store = new Store()
			store.feature.value.state.previousValue('cached')
			expect(store.feature.value.computed.currentValue()).toBe('cached')
		})

		it('fall back to props.value when previousValue is undefined', () => {
			const store = new Store()
			store.props.set({value: 'prop-value'})
			expect(store.feature.value.computed.currentValue()).toBe('prop-value')
		})

		it('prefer previousValue over props.value', () => {
			const store = new Store()
			store.feature.value.state.previousValue('cached')
			store.props.set({value: 'prop-value'})
			expect(store.feature.value.computed.currentValue()).toBe('cached')
		})

		it('react to previousValue changes', () => {
			const store = new Store()
			expect(store.feature.value.computed.currentValue()).toBe('')
			store.feature.value.state.previousValue('updated')
			expect(store.feature.value.computed.currentValue()).toBe('updated')
		})

		it('react to props.value changes when previousValue is undefined', () => {
			const store = new Store()
			store.props.set({value: 'initial'})
			expect(store.feature.value.computed.currentValue()).toBe('initial')
			store.props.set({value: 'changed'})
			expect(store.feature.value.computed.currentValue()).toBe('changed')
		})
	})
})