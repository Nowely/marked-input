import {describe, it, expect, beforeEach, vi} from 'vitest'

import {parseWithParser} from '../features/parsing'
import {DEFAULT_OPTIONS} from '../shared/constants'
import {setUseHookFactory, effect, effectScope, watch, batch} from '../shared/signals'
import {Store} from './Store'

describe('Store', () => {
	beforeEach(() => {
		setUseHookFactory(() => () => undefined)
	})

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

		it('should reflect refs.container via handler.container', () => {
			const store = new Store()
			const handler = store.handler
			expect(handler.container).toBe(null)
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub for reference identity check only, no DOM methods used
			const stub = {} as HTMLDivElement
			store.refs.container = stub
			expect(handler.container).toBe(stub)
		})

		it('should reflect refs.overlay via handler.overlay', () => {
			const store = new Store()
			const handler = store.handler
			expect(handler.overlay).toBe(null)
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub for reference identity check only, no DOM methods used
			const stub = {} as HTMLElement
			store.refs.overlay = stub
			expect(handler.overlay).toBe(stub)
		})

		it('should expose focus as a callable function', () => {
			const store = new Store()
			const handler = store.handler
			expect(typeof handler.focus).toBe('function')
		})
	})

	describe('setState', () => {
		it('should update provided internal state values', () => {
			const store = new Store()
			store.setState({previousValue: 'hello'})
			expect(store.state.previousValue()).toBe('hello')
		})

		it('should leave unprovided keys unchanged', () => {
			const store = new Store()
			store.setState({selecting: 'drag'})
			expect(store.state.selecting()).toBe('drag')
			expect(store.state.tokens()).toEqual([])
		})

		it('should not throw when called with an empty object', () => {
			const store = new Store()
			expect(() => store.setState({})).not.toThrow()
		})

		it('should batch updates so effects fire once', () => {
			const store = new Store()
			const effectSpy = vi.fn()
			effect(() => {
				store.state.tokens()
				store.state.selecting()
				effectSpy()
			})
			effectSpy.mockClear()
			store.setState({selecting: 'all'})
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
			store.props.onChange(onChange)
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

	describe('containerStyle (computed)', () => {
		it('should merge style + slotProps.container.style', () => {
			const store = new Store()
			store.setProps({
				style: {color: 'red'},
				slotProps: {container: {style: {fontSize: 14}}},
			})
			expect(store.computed.containerStyle()).toEqual({color: 'red', fontSize: 14})
		})

		it('should return style only when no slotProps.container.style', () => {
			const store = new Store()
			store.setProps({style: {color: 'red'}})
			expect(store.computed.containerStyle()).toEqual({color: 'red'})
		})

		it('should return undefined when nothing is set', () => {
			const store = new Store()
			expect(store.computed.containerStyle()).toBeUndefined()
		})

		it('should react to style changes', () => {
			const store = new Store()
			store.setProps({style: {color: 'red'}})
			expect(store.computed.containerStyle()).toEqual({color: 'red'})
			store.setProps({style: {color: 'blue'}})
			expect(store.computed.containerStyle()).toEqual({color: 'blue'})
		})

		it('should react to slotProps changes', () => {
			const store = new Store()
			store.setProps({style: {color: 'red'}})
			expect(store.computed.containerStyle()).toEqual({color: 'red'})
			store.setProps({slotProps: {container: {style: {fontSize: 14}}}})
			expect(store.computed.containerStyle()).toEqual({color: 'red', fontSize: 14})
		})
	})

	describe('hasMark (computed)', () => {
		it('should return false when no Mark override and no per-option Mark', () => {
			const store = new Store()
			expect(store.computed.hasMark()).toBe(false)
		})

		it('should return true when Mark override is set', () => {
			const store = new Store()
			store.props.Mark(() => null)
			expect(store.computed.hasMark()).toBe(true)
		})

		it('should return true when option has per-option Mark', () => {
			const store = new Store()
			store.props.options([{markup: '@[__value__]', Mark: () => null} as Record<string, unknown>])
			expect(store.computed.hasMark()).toBe(true)
		})

		it('should return true when Mark override is set even without per-option Mark', () => {
			const store = new Store()
			store.props.Mark(() => null)
			store.props.options([{markup: '@[__value__]'}])
			expect(store.computed.hasMark()).toBe(true)
		})

		it('should return false when option has Mark set to null', () => {
			const store = new Store()
			store.props.options([{markup: '@[__value__]', Mark: null} as Record<string, unknown>])
			expect(store.computed.hasMark()).toBe(false)
		})

		it('should react to Mark override changes', () => {
			const store = new Store()
			expect(store.computed.hasMark()).toBe(false)
			store.props.Mark(() => null)
			expect(store.computed.hasMark()).toBe(true)
			store.props.Mark(undefined)
			expect(store.computed.hasMark()).toBe(false)
		})
	})

	describe('computed slots', () => {
		it('should return default container slot', () => {
			const store = new Store()
			expect(store.computed.container()).toEqual(['div', undefined])
		})

		it('should return default block slot', () => {
			const store = new Store()
			expect(store.computed.block()).toEqual(['div', undefined])
		})

		it('should return default span slot', () => {
			const store = new Store()
			expect(store.computed.span()).toEqual(['span', undefined])
		})

		it('should resolve custom container slot', () => {
			const store = new Store()
			store.setProps({slots: {container: 'section'}})
			expect(store.computed.container()).toEqual(['section', undefined])
		})

		it('should resolve custom span slot with props', () => {
			const store = new Store()
			store.setProps({
				slots: {span: 'strong'},
				slotProps: {span: {className: 'bold'}},
			})
			const [component, props] = store.computed.span()
			expect(component).toBe('strong')
			expect(props).toEqual({className: 'bold'})
		})

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
})