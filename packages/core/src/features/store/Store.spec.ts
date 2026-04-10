import {describe, it, expect, beforeEach, vi} from 'vitest'

import {DEFAULT_OPTIONS} from '../../shared/constants'
import {setUseHookFactory, effect, effectScope, watch, batch} from '../../shared/signals'
import {parseWithParser} from '../parsing'
import {Store} from './Store'

describe('Store', () => {
	beforeEach(() => {
		setUseHookFactory(() => () => undefined)
	})

	it('should construct with no arguments', () => {
		const store = new Store()
		expect(store.state.tokens()).toEqual([])
		expect(store.state.readOnly()).toBe(false)
	})

	it('should return default for showOverlayOn when not set', () => {
		const store = new Store()
		expect(store.state.showOverlayOn()).toBe('change')
	})

	it('should return default for options when not set', () => {
		const store = new Store()
		expect(store.state.options()).toEqual(DEFAULT_OPTIONS)
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
		it('should update provided state values', () => {
			const store = new Store()
			store.setState({value: 'hello', readOnly: true})
			expect(store.state.value()).toBe('hello')
			expect(store.state.readOnly()).toBe(true)
		})

		it('should leave unprovided keys unchanged', () => {
			const store = new Store()
			store.setState({readOnly: true})
			expect(store.state.value()).toBeUndefined()
			expect(store.state.readOnly()).toBe(true)
		})

		it('should not throw when called with an empty object', () => {
			const store = new Store()
			expect(() => store.setState({})).not.toThrow()
		})

		it('should batch updates so effects fire once', () => {
			const store = new Store()
			const effectSpy = vi.fn()
			effect(() => {
				store.state.value()
				store.state.readOnly()
				effectSpy()
			})
			effectSpy.mockClear()
			store.setState({value: 'hello', readOnly: true})
			expect(effectSpy).toHaveBeenCalledTimes(1)
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
					store.state.onChange()?.(newValue)
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
			store.state.onChange(onChange)
			const dispose = effectScope(() => {
				watch(store.state.innerValue, newValue => {
					if (newValue === undefined) return
					const newTokens = parseWithParser(store, newValue)
					batch(() => {
						store.state.tokens(newTokens)
						store.state.previousValue(newValue)
					})
					store.state.onChange()?.(newValue)
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
					store.state.onChange()?.(newValue)
				})
			})
			expect(() => store.state.innerValue('test')).not.toThrow()
			dispose()
		})
	})

	describe('containerStyle (computed)', () => {
		it('should merge style + slotProps.container.style', () => {
			const store = new Store()
			store.setState({
				style: {color: 'red'},
				slotProps: {container: {style: {fontSize: 14}}},
			})
			expect(store.computed.containerStyle()).toEqual({color: 'red', fontSize: 14})
		})

		it('should return style only when no slotProps.container.style', () => {
			const store = new Store()
			store.setState({style: {color: 'red'}})
			expect(store.computed.containerStyle()).toEqual({color: 'red'})
		})

		it('should return undefined when nothing is set', () => {
			const store = new Store()
			expect(store.computed.containerStyle()).toBeUndefined()
		})

		it('should react to style changes', () => {
			const store = new Store()
			store.setState({style: {color: 'red'}})
			expect(store.computed.containerStyle()).toEqual({color: 'red'})
			store.setState({style: {color: 'blue'}})
			expect(store.computed.containerStyle()).toEqual({color: 'blue'})
		})

		it('should react to slotProps changes', () => {
			const store = new Store()
			store.setState({style: {color: 'red'}})
			expect(store.computed.containerStyle()).toEqual({color: 'red'})
			store.setState({slotProps: {container: {style: {fontSize: 14}}}})
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
			store.state.Mark(() => null)
			expect(store.computed.hasMark()).toBe(true)
		})

		it('should return true when option has per-option Mark', () => {
			const store = new Store()
			store.state.options([{markup: '@[__value__]', Mark: () => null} as Record<string, unknown>])
			expect(store.computed.hasMark()).toBe(true)
		})

		it('should return true when Mark override is set even without per-option Mark', () => {
			const store = new Store()
			store.state.Mark(() => null)
			store.state.options([{markup: '@[__value__]'}])
			expect(store.computed.hasMark()).toBe(true)
		})

		it('should return false when option has Mark set to null', () => {
			const store = new Store()
			store.state.options([{markup: '@[__value__]', Mark: null} as Record<string, unknown>])
			expect(store.computed.hasMark()).toBe(false)
		})

		it('should react to Mark override changes', () => {
			const store = new Store()
			expect(store.computed.hasMark()).toBe(false)
			store.state.Mark(() => null)
			expect(store.computed.hasMark()).toBe(true)
			store.state.Mark(undefined)
			expect(store.computed.hasMark()).toBe(false)
		})
	})
})