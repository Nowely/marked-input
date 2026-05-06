import {describe, it, expect, vi} from 'vitest'

import {watch} from '../../shared/signals'
import {Store} from '../../store/Store'

describe('ValueFeature', () => {
	it('exposes accepted value state and edit notifications', () => {
		const store = new Store()

		expect(typeof store.value.current).toBe('function')
		expect(typeof store.value.isControlledMode).toBe('function')
		expect(typeof store.value.change).toBe('function')
		expect('next' in store.value).toBe(false)
		expect(store.value.current()).toBe('')
		expect(store.value.isControlledMode()).toBe(false)
	})

	it('initializes from controlled value on enable', () => {
		const store = new Store()
		store.props.set({value: 'hello'})

		expect(store.value.current()).toBe('hello')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
	})

	it('initializes from defaultValue when uncontrolled', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})

		expect(store.value.current()).toBe('hello')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
	})

	it('controlled prop echo commits current and tokens', () => {
		const store = new Store()
		store.props.set({value: 'hello'})

		store.props.set({value: 'world'})

		expect(store.value.current()).toBe('world')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'world', position: {start: 0, end: 5}}])
	})

	it('preserves current when controlled value becomes undefined', () => {
		const store = new Store()
		store.props.set({value: 'hello', defaultValue: 'default'})

		store.props.set({value: undefined})

		expect(store.value.isControlledMode()).toBe(false)
		expect(store.value.current()).toBe('hello')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
	})

	it('notifies change subscribers for accepted uncontrolled edits', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({defaultValue: 'hello', onChange})
		const notified = vi.fn()
		const stop = watch(store.value.change, notified)

		store.value.replaceAll('world')

		expect(onChange).toHaveBeenCalledWith('world')
		expect(notified).toHaveBeenCalledOnce()
		expect(store.value.current()).toBe('world')

		stop()
	})

	it('readOnly rejects editor-originated range replacement', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({defaultValue: 'hello', readOnly: true, onChange})

		const result = store.value.replaceAll('world')

		expect(result).toEqual({ok: false, reason: 'readOnly'})
		expect(onChange).not.toHaveBeenCalled()
		expect(store.value.current()).toBe('hello')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
	})

	it('readOnly allows controlled prop updates to replace accepted value', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({value: 'hello', readOnly: true, onChange})

		store.props.set({value: 'world'})

		expect(onChange).not.toHaveBeenCalled()
		expect(store.value.current()).toBe('world')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'world', position: {start: 0, end: 5}}])
	})

	describe('replaceRange()', () => {
		it('commits uncontrolled range replacement and schedules recovery', () => {
			const store = new Store()
			const recovery = {kind: 'caret' as const, rawPosition: 5}
			store.props.set({defaultValue: 'hello world'})

			const result = store.value.replaceRange({start: 6, end: 11}, 'markput', {
				recover: recovery,
				source: 'input',
			})

			expect(result).toEqual({ok: true, accepted: 'immediate', value: 'hello markput'})
			expect(store.value.current()).toBe('hello markput')
			expect(store.caret.recovery()).toBe(recovery)
		})

		it('rejects invalid ranges without emitting change', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.set({defaultValue: 'hello', onChange})

			const result = store.value.replaceRange({start: 4, end: 2}, 'x')

			expect(result).toEqual({ok: false, reason: 'invalidRange'})
			expect(onChange).not.toHaveBeenCalled()
			expect(store.value.current()).toBe('hello')
		})

		it('keeps controlled accepted value until matching echo', () => {
			const store = new Store()
			const onChange = vi.fn()
			const recovery = {kind: 'caret' as const, rawPosition: 5}
			store.props.set({value: 'hello', onChange})

			const result = store.value.replaceRange({start: 0, end: 5}, 'world', {recover: recovery})

			expect(result).toEqual({ok: true, accepted: 'pendingControlledEcho', value: 'world'})
			expect(onChange).toHaveBeenCalledWith('world')
			expect(store.value.current()).toBe('hello')
			expect(store.caret.recovery()).toBeUndefined()

			store.props.set({value: 'world'})

			expect(store.value.current()).toBe('world')
			expect(store.caret.recovery()).toBe(recovery)
		})

		it('keeps recovery when controlled echo is synchronous inside onChange', () => {
			const store = new Store()
			const recovery = {kind: 'caret' as const, rawPosition: 5}
			store.props.set({
				value: 'hello',
				onChange: value => store.props.set({value}),
			})

			const result = store.value.replaceRange({start: 0, end: 5}, 'world', {recover: recovery})

			expect(result).toEqual({ok: true, accepted: 'pendingControlledEcho', value: 'world'})
			expect(store.value.current()).toBe('world')
			expect(store.caret.recovery()).toBe(recovery)
		})

		it('clears pending recovery when controlled echo does not match', () => {
			const store = new Store()
			const onChange = vi.fn()
			const recovery = {kind: 'caret' as const, rawPosition: 5}
			store.props.set({value: 'hello', onChange})

			store.value.replaceRange({start: 0, end: 5}, 'world', {recover: recovery})
			store.props.set({value: 'other'})
			store.props.set({value: 'world'})

			expect(store.value.current()).toBe('world')
			expect(store.caret.recovery()).toBeUndefined()
		})
	})
})