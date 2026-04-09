import {describe, it, expect, beforeEach} from 'vitest'

import {setUseHookFactory} from './registry'
import {signal, computed, effect, batch} from './signal'

describe('computed', () => {
	beforeEach(() => {
		// oxlint-disable-next-line no-unsafe-type-assertion -- test mock returns the signal's callable directly
		setUseHookFactory((sig: unknown) => sig as () => unknown)
	})

	it('should derive value from signal', () => {
		const name = signal<string | undefined>('hello')
		const upper = computed(() => name()!.toUpperCase())
		expect(upper()).toBe('HELLO')
	})

	it('should have .get() method', () => {
		const count = signal(1)
		const doubled = computed(() => count() * 2)
		expect(doubled.get()).toBe(2)
	})

	it('should have .use() method', () => {
		const count = signal(1)
		const doubled = computed(() => count() * 2)
		expect(doubled.use()).toBe(2)
	})

	it('should re-derive when dependency changes', () => {
		const count = signal(1)
		const doubled = computed(() => count() * 2)
		expect(doubled()).toBe(2)
		count.set(5)
		expect(doubled()).toBe(10)
	})

	it('should be lazy — not computed until read', () => {
		const count = signal(1)
		let calls = 0
		const doubled = computed(() => {
			calls++
			return count() * 2
		})
		expect(calls).toBe(0)
		doubled()
		expect(calls).toBe(1)
	})

	it('should cache until dependencies change', () => {
		const count = signal(1)
		let calls = 0
		const doubled = computed(() => {
			calls++
			return count() * 2
		})
		doubled()
		doubled()
		expect(calls).toBe(1)
		count.set(2)
		doubled()
		doubled()
		expect(calls).toBe(2)
	})

	it('should auto-track inside effect', () => {
		const count = signal(1)
		const doubled = computed(() => count() * 2)
		const results: number[] = []
		effect(() => {
			results.push(doubled())
		})
		expect(results).toEqual([2])
		count.set(3)
		expect(results).toEqual([2, 6])
	})

	it('should support chained computed', () => {
		const count = signal(1)
		const doubled = computed(() => count() * 2)
		const quadrupled = computed(() => doubled() * 2)
		expect(quadrupled()).toBe(4)
		count.set(5)
		expect(quadrupled()).toBe(20)
	})

	it('should receive previous value in getter', () => {
		const count = signal(1)
		const withPrev = computed((prev?: number) => {
			void prev
			return count() + 1
		})
		expect(withPrev()).toBe(2)
	})

	it('should work inside batch', () => {
		const a = signal(1)
		const b = signal(2)
		const sum = computed(() => a() + b())
		const results: number[] = []
		effect(() => {
			results.push(sum())
		})
		expect(results).toEqual([3])
		batch(() => {
			a.set(10)
			b.set(20)
		})
		expect(results).toEqual([3, 30])
	})
})