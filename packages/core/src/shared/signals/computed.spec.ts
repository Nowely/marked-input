import {describe, it, expect} from 'vitest'

import {signal, computed, effect, batch} from './signal'

describe('computed', () => {
	it('should derive value from signal', () => {
		const name = signal<string | undefined>('hello')
		const upper = computed(() => name()!.toUpperCase())
		expect(upper()).toBe('HELLO')
	})

	it('should have .get() method', () => {
		const count = signal(1)
		const doubled = computed(() => count() * 2)
		expect(doubled()).toBe(2)
	})

	it('Signal should not have a .use() method', () => {
		const s = signal(1)
		// @ts-expect-error -- .use() must not exist on Signal after this refactor
		expect(typeof s.use).toBe('undefined')
	})

	it('should re-derive when dependency changes', () => {
		const count = signal(1)
		const doubled = computed(() => count() * 2)
		expect(doubled()).toBe(2)
		count(5)
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
		count(2)
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
		count(3)
		expect(results).toEqual([2, 6])
	})

	it('should support chained computed', () => {
		const count = signal(1)
		const doubled = computed(() => count() * 2)
		const quadrupled = computed(() => doubled() * 2)
		expect(quadrupled()).toBe(4)
		count(5)
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
			a(10)
			b(20)
		})
		expect(results).toEqual([3, 30])
	})
})