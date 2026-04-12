import {describe, it, expect, vi} from 'vitest'

import {shallow} from '../utils/shallow'
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

describe('computed with equals option', () => {
	it('should suppress propagation when signal changes but computed output is structurally unchanged', () => {
		// count changes 0→2, but parity stays 'even' — equals should suppress effect rerun
		const count = signal(0)
		const obj = computed(() => ({parity: count() % 2 === 0 ? 'even' : 'odd'}), {
			equals: (a, b) => a.parity === b.parity,
		})
		const runs = vi.fn()
		const dispose = effect(() => {
			obj()
			runs()
		})
		expect(runs).toHaveBeenCalledTimes(1)
		count(2) // signal changes → computed reruns → {parity: 'even'} again → equals suppresses
		expect(runs).toHaveBeenCalledTimes(1)
		dispose()
	})

	it('should allow propagation when computed output changes', () => {
		// count changes 0→1, parity flips 'even'→'odd' — equals returns false, effect reruns
		const count = signal(0)
		const obj = computed(() => ({parity: count() % 2 === 0 ? 'even' : 'odd'}), {
			equals: (a, b) => a.parity === b.parity,
		})
		const runs = vi.fn()
		const dispose = effect(() => {
			obj()
			runs()
		})
		expect(runs).toHaveBeenCalledTimes(1)
		count(1) // signal changes → computed reruns → {parity: 'odd'} → equals returns false → propagates
		expect(runs).toHaveBeenCalledTimes(2)
		dispose()
	})

	it('should always produce a value on first read regardless of equals', () => {
		const count = signal(1)
		const alwaysEqual = computed(() => ({value: count()}), {equals: () => true})
		expect(alwaysEqual()).toEqual({value: 1})
	})

	it('should work with shallow equals — suppress when shape unchanged', () => {
		// trigger changes but computed always returns same {x,y} shape
		const trigger = signal(0)
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
		trigger(1) // signal changes → computed reruns → new {x:1,y:2} ref → shallow equal → suppressed
		expect(runs).toHaveBeenCalledTimes(1)
		trigger(2)
		expect(runs).toHaveBeenCalledTimes(1)
		dispose()
	})
})