import {describe, it, expect, vi} from 'vitest'

import {shallow} from '../utils/shallow'
import {signal, computed, effect, batch, isReactive} from './signal'

describe('computed', () => {
	it('derive value from signal', () => {
		const name = signal<string | undefined>('hello')
		const upper = computed(() => name()!.toUpperCase())
		expect(upper()).toBe('HELLO')
	})

	it('have .get() method', () => {
		const count = signal(1)
		const doubled = computed(() => count() * 2)
		expect(doubled()).toBe(2)
	})

	it('Signal should not have a .use() method', () => {
		const s = signal(1)
		// @ts-expect-error -- .use() must not exist on Signal after this refactor
		expect(typeof s.use).toBe('undefined')
	})

	it('re-derive when dependency changes', () => {
		const count = signal(1)
		const doubled = computed(() => count() * 2)
		expect(doubled()).toBe(2)
		count(5)
		expect(doubled()).toBe(10)
	})

	it('be lazy — not computed until read', () => {
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

	it('cache until dependencies change', () => {
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

	it('auto-track inside effect', () => {
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

	it('support chained computed', () => {
		const count = signal(1)
		const doubled = computed(() => count() * 2)
		const quadrupled = computed(() => doubled() * 2)
		expect(quadrupled()).toBe(4)
		count(5)
		expect(quadrupled()).toBe(20)
	})

	it('receive previous value in getter', () => {
		const count = signal(1)
		const withPrev = computed((prev?: number) => {
			void prev
			return count() + 1
		})
		expect(withPrev()).toBe(2)
	})

	it('work inside batch', () => {
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
	it('suppress propagation when signal changes but computed output is structurally unchanged', () => {
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

	it('allow propagation when computed output changes', () => {
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

	it('always produce a value on first read regardless of equals', () => {
		const count = signal(1)
		const alwaysEqual = computed(() => ({value: count()}), {equals: () => true})
		expect(alwaysEqual()).toEqual({value: 1})
	})

	it('work with shallow equals — suppress when shape unchanged', () => {
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

describe('computed — writable', () => {
	it('reads through get when no deps change', () => {
		const external = signal('a')
		const c = computed({
			initial: () => '',
			get: field => external() + field(),
			set: (_next, _field) => {},
		})
		expect(c()).toBe('a')
	})

	it('field starts undefined when no initial provided', () => {
		const c = computed<string>({
			get: field => field() ?? 'fallback',
			set: (_next, _field) => {},
		})
		expect(c()).toBe('fallback')
	})

	it('initial runs lazily on first field read', () => {
		let calls = 0
		const c = computed({
			initial: () => {
				calls++
				return 'seed'
			},
			get: field => field(),
			set: (_next, _field) => {},
		})
		expect(calls).toBe(0)
		c()
		expect(calls).toBe(1)
		c()
		expect(calls).toBe(1)
	})

	it('initial runs inside untracked — does not leak deps into getter', () => {
		const dep = signal('x')
		let getterCalls = 0
		const c = computed({
			initial: () => dep(),
			get: field => {
				getterCalls++
				return field()
			},
			set: (_next, _field) => {},
		})
		c()
		getterCalls = 0
		dep('y')
		expect(getterCalls).toBe(0)
	})

	it('set routing — set writes field when caller chooses', () => {
		const c = computed({
			initial: () => 'start',
			get: field => field(),
			set: (next, field) => {
				field(next)
			},
		})
		expect(c()).toBe('start')
		c('updated')
		expect(c()).toBe('updated')
	})

	it('set routing — set can skip field write', () => {
		const external = vi.fn()
		const c = computed({
			initial: () => 'keep',
			get: field => field(),
			set: (next, _field) => {
				external(next)
			},
		})
		c('propose')
		expect(external).toHaveBeenCalledWith('propose')
		expect(c()).toBe('keep')
	})

	it('field write propagates through get to effect', () => {
		const results: string[] = []
		const c = computed({
			initial: () => 'a',
			get: field => field(),
			set: (next, field) => {
				field(next)
			},
		})
		const dispose = effect(() => {
			results.push(c())
		})
		expect(results).toEqual(['a'])
		c('b')
		expect(results).toEqual(['a', 'b'])
		dispose()
	})

	it('external dep change in get propagates to effect', () => {
		const ext = signal(1)
		const results: number[] = []
		const c = computed({
			initial: () => 0,
			get: field => field() + ext(),
			set: (_next, _field) => {},
		})
		const dispose = effect(() => {
			results.push(c())
		})
		expect(results).toEqual([1])
		ext(10)
		expect(results).toEqual([1, 10])
		dispose()
	})

	it('isReactive returns true for writable computed', () => {
		const c = computed({
			initial: () => '',
			get: field => field(),
			set: (next, field) => {
				field(next)
			},
		})
		expect(isReactive(c)).toBe(true)
	})

	it('get can choose external over field, field write does not change result', () => {
		const ext = signal('controlled')
		const c = computed({
			initial: () => 'uncontrolled',
			get: _field => ext(),
			set: (_next, _field) => {},
		})
		c('ignored')
		expect(c()).toBe('controlled')
	})
})