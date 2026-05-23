import {describe, it, expect, vi} from 'vitest'

import {shallow} from '../utils/shallow'
import {signal, computed, effect, batch, isReactive} from './signal'

describe('computed', () => {
	it('derive value from signal', () => {
		const name = signal<string | undefined>({initial: 'hello'})
		const upper = computed(() => name()!.toUpperCase())
		expect(upper()).toBe('HELLO')
	})

	it('have .get() method', () => {
		const count = signal<number>({initial: 1})
		const doubled = computed(() => count() * 2)
		expect(doubled()).toBe(2)
	})

	it('Signal should not have a .use() method', () => {
		const s = signal<number>({initial: 1})
		// @ts-expect-error -- .use() must not exist on Signal after this refactor
		expect(typeof s.use).toBe('undefined')
	})

	it('re-derive when dependency changes', () => {
		const count = signal<number>({initial: 1})
		const doubled = computed(() => count() * 2)
		expect(doubled()).toBe(2)
		count(5)
		expect(doubled()).toBe(10)
	})

	it('be lazy — not computed until read', () => {
		const count = signal<number>({initial: 1})
		let calls = 0
		const doubled = computed(() => {
			calls++
			return count() * 2
		})
		expect(calls).toBe(0)
		doubled()
		expect(calls).toBe(1)
	})

	it('cache until dependencies change', () => {
		const count = signal<number>({initial: 1})
		let calls = 0
		const doubled = computed(() => {
			calls++
			return count() * 2
		})
		doubled()
		doubled()
		expect(calls).toBe(1)
		count(2)
		doubled()
		doubled()
		expect(calls).toBe(2)
	})

	it('auto-track inside effect', () => {
		const count = signal<number>({initial: 1})
		const doubled = computed(() => count() * 2)
		const results: number[] = []
		effect(() => {
			results.push(doubled())
		})
		expect(results).toEqual([2])
		count(3)
		expect(results).toEqual([2, 6])
	})

	it('support chained computed', () => {
		const count = signal<number>({initial: 1})
		const doubled = computed(() => count() * 2)
		const quadrupled = computed(() => doubled() * 2)
		expect(quadrupled()).toBe(4)
		count(5)
		expect(quadrupled()).toBe(20)
	})

	it('receive previous value in getter', () => {
		const count = signal<number>({initial: 1})
		const withPrev = computed((prev?: number) => {
			void prev
			return count() + 1
		})
		expect(withPrev()).toBe(2)
	})

	it('work inside batch', () => {
		const a = signal<number>({initial: 1})
		const b = signal<number>({initial: 2})
		const sum = computed(() => a() + b())
		const results: number[] = []
		effect(() => {
			results.push(sum())
		})
		expect(results).toEqual([3])
		batch(() => {
			a(10)
			b(20)
		})
		expect(results).toEqual([3, 30])
	})
})

describe('computed with equals option', () => {
	it('suppress propagation when signal changes but computed output is structurally unchanged', () => {
		const count = signal<number>({initial: 0})
		const obj = computed(() => ({parity: count() % 2 === 0 ? 'even' : 'odd'}), {
			equals: (a, b) => a.parity === b.parity,
		})
		const runs = vi.fn()
		const dispose = effect(() => {
			obj()
			runs()
		})
		expect(runs).toHaveBeenCalledTimes(1)
		count(2)
		expect(runs).toHaveBeenCalledTimes(1)
		dispose()
	})

	it('allow propagation when computed output changes', () => {
		const count = signal<number>({initial: 0})
		const obj = computed(() => ({parity: count() % 2 === 0 ? 'even' : 'odd'}), {
			equals: (a, b) => a.parity === b.parity,
		})
		const runs = vi.fn()
		const dispose = effect(() => {
			obj()
			runs()
		})
		expect(runs).toHaveBeenCalledTimes(1)
		count(1)
		expect(runs).toHaveBeenCalledTimes(2)
		dispose()
	})

	it('always produce a value on first read regardless of equals', () => {
		const count = signal<number>({initial: 1})
		const alwaysEqual = computed(() => ({value: count()}), {equals: () => true})
		expect(alwaysEqual()).toEqual({value: 1})
	})

	it('work with shallow equals — suppress when shape unchanged', () => {
		const trigger = signal<number>({initial: 0})
		const obj = computed(
			() => {
				trigger()
				return {x: 1, y: 2}
			},
			{equals: shallow}
		)
		const runs = vi.fn()
		const dispose = effect(() => {
			obj()
			runs()
		})
		expect(runs).toHaveBeenCalledTimes(1)
		trigger(1)
		expect(runs).toHaveBeenCalledTimes(1)
		trigger(2)
		expect(runs).toHaveBeenCalledTimes(1)
		dispose()
	})
})

describe('computed — writable', () => {
	it('reads via get', () => {
		const c = computed<number>({
			get: () => 42,
			set: () => {},
		})
		expect(c()).toBe(42)
	})

	it('passes previous value to get', () => {
		const trigger = signal<number>({initial: 0})
		let receivedPrev: number | undefined = -1
		const c = computed<number>({
			get: prev => {
				receivedPrev = prev
				return trigger() + 1
			},
			set: () => {},
		})
		expect(c()).toBe(1)
		expect(receivedPrev).toBeUndefined()
		trigger(10)
		expect(c()).toBe(11)
		expect(receivedPrev).toBe(1)
	})

	it('calls set with the value being written', () => {
		const setSpy = vi.fn()
		const c = computed<number>({
			get: () => 0,
			set: setSpy,
		})
		c(7)
		expect(setSpy).toHaveBeenCalledWith(7)
	})

	it('skips set when undefined is written', () => {
		const setSpy = vi.fn()
		const c = computed<number>({
			get: () => 0,
			set: setSpy,
		})
		c(undefined)
		expect(setSpy).not.toHaveBeenCalled()
	})

	it('set can write to an external signal that get also reads', () => {
		const backing = signal<number>({initial: 1})
		const c = computed<number>({
			get: () => backing() * 2,
			set: next => backing(next / 2),
		})
		expect(c()).toBe(2)
		c(20)
		expect(backing()).toBe(10)
		expect(c()).toBe(20)
	})

	it('external dep change in get propagates to effect', () => {
		const ext = signal<number>({initial: 1})
		const results: number[] = []
		const c = computed<number>({
			get: () => ext() * 10,
			set: () => {},
		})
		const dispose = effect(() => {
			results.push(c())
		})
		expect(results).toEqual([10])
		ext(2)
		expect(results).toEqual([10, 20])
		dispose()
	})

	it('equals option suppresses propagation when output unchanged', () => {
		const trigger = signal<number>({initial: 0})
		const runs = vi.fn()
		const c = computed<{parity: 'even' | 'odd'}>({
			get: () => ({parity: trigger() % 2 === 0 ? 'even' : 'odd'}),
			set: () => {},
			equals: (a, b) => a.parity === b.parity,
		})
		const dispose = effect(() => {
			c()
			runs()
		})
		expect(runs).toHaveBeenCalledTimes(1)
		trigger(2)
		expect(runs).toHaveBeenCalledTimes(1)
		trigger(1)
		expect(runs).toHaveBeenCalledTimes(2)
		dispose()
	})

	it('isReactive returns true for writable computed', () => {
		const c = computed<number>({
			get: () => 0,
			set: () => {},
		})
		expect(isReactive(c)).toBe(true)
	})

	describe('setter return value', () => {
		it('returns true when set causes the read value to change', () => {
			const backing = signal<number>({initial: 1})
			const c = computed<number>({
				get: () => backing(),
				set: next => backing(next),
			})
			expect(c(2)).toBe(true)
		})

		it('returns false when next equals current value (set not called)', () => {
			const setSpy = vi.fn()
			const c = computed<number>({
				get: () => 5,
				set: setSpy,
			})
			expect(c(5)).toBe(false)
			expect(setSpy).not.toHaveBeenCalled()
		})

		it('returns false when undefined is written', () => {
			const c = computed<number>({
				get: () => 0,
				set: () => {},
			})
			expect(c(undefined)).toBe(false)
		})

		it('returns false when set rejects the write (value did not change)', () => {
			const backing = signal<number>({initial: 1, readonly: true})
			const c = computed<number>({
				get: () => backing(),
				set: next => backing(next),
			})
			expect(c(2)).toBe(false)
		})
	})
})