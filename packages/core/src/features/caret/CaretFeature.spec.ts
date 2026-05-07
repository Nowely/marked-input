import {describe, it, expect, vi} from 'vitest'

import {watch} from '../../shared/signals'
import {Store} from '../../store/Store'

describe('CaretFeature', () => {
	it('exposes range, selecting, location, recovery', () => {
		const store = new Store()
		expect(typeof store.caret.range).toBe('function')
		expect(typeof store.caret.selecting).toBe('function')
		expect(typeof store.caret.location).toBe('function')
		expect(typeof store.caret.recovery).toBe('function') // bridge; removed in Task 11
	})

	it('range starts undefined', () => {
		expect(new Store().caret.range()).toBeUndefined()
	})

	it('range write is structural-equality deduped', () => {
		const store = new Store()
		const notify = vi.fn()
		const stop = watch(store.caret.range, notify)
		store.caret.range({start: 5, end: 5})
		store.caret.range({start: 5, end: 5})
		expect(notify).toHaveBeenCalledTimes(1)
		stop()
	})

	it('range undefined write is no-op when already undefined', () => {
		const store = new Store()
		const notify = vi.fn()
		const stop = watch(store.caret.range, notify)
		store.caret.range(undefined)
		expect(notify).not.toHaveBeenCalled()
		stop()
	})

	describe('location computed (after wire)', () => {
		it('is undefined when range is undefined', () => {
			const store = new Store()
			store.lifecycle.mounted()
			store.props.set({value: 'hello'})
			expect(store.caret.location()).toBeUndefined()
		})

		it('derives text role from position inside text token', () => {
			const store = new Store()
			store.lifecycle.mounted()
			store.props.set({value: 'hello'})
			store.caret.range({start: 2, end: 2})
			expect(store.caret.location()?.role).toBe('text')
		})

		it('updates when range changes', () => {
			const store = new Store()
			store.lifecycle.mounted()
			store.props.set({value: 'hello'})
			store.caret.range({start: 1, end: 1})
			expect(store.caret.location()?.role).toBe('text')
			store.caret.range(undefined)
			expect(store.caret.location()).toBeUndefined()
		})
	})
})