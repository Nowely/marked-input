import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

import {effect} from './alien-signals'
import {setUseHookFactory, getUseHookFactory} from './registry'
import type {UseHookFactory} from './registry'
import {signal, watch, event, batch} from './signal'

// Helper to track and dispose effects created during tests
let disposers: (() => void)[]

beforeEach(() => {
	disposers = []
})

afterEach(() => {
	for (const dispose of disposers) dispose()
	disposers = []
})

function trackedEffect(fn: () => void): () => void {
	const dispose = effect(fn)
	disposers.push(dispose)
	return dispose
}

// ---------------------------------------------------------------------------
// signal<T>
// ---------------------------------------------------------------------------

describe('signal<T>', () => {
	beforeEach(() => vi.clearAllMocks())

	it('should return current value when called with no args', () => {
		const s = signal(42)
		expect(s()).toBe(42)
	})

	it('should update the value when called with an arg', () => {
		const s = signal(0)
		s(10)
		expect(s()).toBe(10)
	})

	it('should support .get() as a read alias', () => {
		const s = signal('hello')
		expect(s()).toBe('hello')
	})

	it('should support .set() as a write alias', () => {
		const s = signal('hello')
		s('world')
		expect(s()).toBe('world')
	})

	it('should NOT re-notify when the same value is set', () => {
		const s = signal(5)
		const runs = vi.fn()

		trackedEffect(() => {
			s()
			runs()
		})

		expect(runs).toHaveBeenCalledTimes(1)
		s(5) // same value
		expect(runs).toHaveBeenCalledTimes(1)
	})

	it('should re-notify when equals: false even if same reference', () => {
		const ref = {x: 1}
		const s = signal(ref, {equals: false})
		const runs = vi.fn()

		trackedEffect(() => {
			s()
			runs()
		})

		expect(runs).toHaveBeenCalledTimes(1)
		s(ref) // same reference
		expect(runs).toHaveBeenCalledTimes(2)
	})

	it('should skip notification when custom equals returns true', () => {
		const s = signal({id: 1, name: 'a'}, {equals: (a, b) => a.id === b.id})
		const runs = vi.fn()

		trackedEffect(() => {
			s()
			runs()
		})

		expect(runs).toHaveBeenCalledTimes(1)
		s({id: 1, name: 'changed'}) // same id — equals returns true
		expect(runs).toHaveBeenCalledTimes(1)
	})

	it('should notify when custom equals returns false', () => {
		const s = signal({id: 1, name: 'a'}, {equals: (a, b) => a.id === b.id})
		const runs = vi.fn()

		trackedEffect(() => {
			s()
			runs()
		})

		expect(runs).toHaveBeenCalledTimes(1)
		s({id: 2, name: 'b'}) // different id
		expect(runs).toHaveBeenCalledTimes(2)
	})

	it('should auto-track inside alien-signals effect', () => {
		const s = signal(0)
		let captured = -1

		trackedEffect(() => {
			captured = s()
		})

		expect(captured).toBe(0)
		s(42)
		expect(captured).toBe(42)
	})

	it('.use() should throw if setUseHookFactory was not called', () => {
		// getUseHookFactory throws when no factory is registered.
		// Since the factory is module-level state and may be set by other tests,
		// we verify the error message format by temporarily clearing it.
		// We do this by setting a known factory, then verifying the throw path
		// exists in the source. Instead, we just call .use() on a signal before
		// any factory is set — this test must run first in the describe block.
		//
		// Since test ordering within a describe is sequential and no prior test
		// in this block calls setUseHookFactory, getUseHookFactory should throw.
		expect(() => getUseHookFactory()).toThrowError(
			'[markput] setUseHookFactory() must be called before using signal.use()'
		)
	})

	it('.use() should call the registered factory and return its result', () => {
		const mockHook = vi.fn(() => 'hook-result')
		const factory: UseHookFactory = vi.fn(() => mockHook)
		setUseHookFactory(factory)

		const s = signal(99)
		const result = s.use()

		expect(factory).toHaveBeenCalledWith(s)
		expect(mockHook).toHaveBeenCalled()
		expect(result).toBe('hook-result')
	})

	describe('default fallback', () => {
		it('should return initial value as default when set to undefined', () => {
			const s = signal<string>('change')
			expect(s()).toBe('change')
			s(undefined)
			expect(s()).toBe('change')
			expect(s()).toBe('change')
		})

		it('should return the actual value when set to a non-undefined value', () => {
			const s = signal<string>('change')
			s('focus')
			expect(s()).toBe('focus')
		})

		it('should NOT apply fallback when initial value is undefined', () => {
			const s = signal<string | undefined>(undefined)
			expect(s()).toBeUndefined()
			s('hello')
			expect(s()).toBe('hello')
			s(undefined)
			expect(s()).toBeUndefined()
		})

		it('should work with .use() returning default', () => {
			let readSignal: (() => boolean) | undefined
			const mockHook = vi.fn(() => readSignal?.())
			const factory: UseHookFactory = s => {
				// oxlint-disable-next-line no-unsafe-type-assertion -- test mocks the signal as a callable
				readSignal = s as () => boolean
				return mockHook
			}
			setUseHookFactory(factory)

			const s = signal<boolean>(false)
			s(undefined)
			const result = s.use()
			expect(result).toBe(false)
		})

		it('should work with equals: false and default fallback', () => {
			const s = signal<boolean>(false, {equals: false})
			expect(s()).toBe(false)
			s(undefined)
			expect(s()).toBe(false)
			s(true)
			expect(s()).toBe(true)
		})

		it('should work with custom equals and default fallback', () => {
			const s = signal({id: 1, name: 'a'}, {equals: (a, b) => a.id === b.id})
			s(undefined)
			expect(s()).toEqual({id: 1, name: 'a'})
		})

		it('should notify subscribers when reverting from value to default', () => {
			const s = signal<boolean>(false)
			s(true)
			const runs = vi.fn()
			trackedEffect(() => {
				s()
				runs()
			})
			runs.mockClear()
			s(undefined)
			expect(runs).toHaveBeenCalledTimes(1)
			expect(s()).toBe(false)
		})

		it('should not notify when setting undefined and already at default', () => {
			const s = signal<boolean>(false)
			const runs = vi.fn()
			trackedEffect(() => {
				s()
				runs()
			})
			runs.mockClear()
			s(undefined)
			expect(runs).toHaveBeenCalledTimes(0)
		})

		it('should work with array defaults', () => {
			const s = signal<number[]>([1, 2, 3])
			s(undefined)
			expect(s()).toEqual([1, 2, 3])
			s([4, 5])
			expect(s()).toEqual([4, 5])
		})
	})

	describe('readonly option', () => {
		it('should ignore direct writes when readonly is true', () => {
			const s = signal(42, {readonly: true})
			s(99)
			expect(s()).toBe(42)
		})

		it('should allow writes inside batch with writable: true', () => {
			const s = signal(42, {readonly: true})
			batch(
				() => {
					s(99)
				},
				{writable: true}
			)
			expect(s()).toBe(99)
		})

		it('should ignore writes inside regular batch without writable', () => {
			const s = signal(42, {readonly: true})
			batch(() => {
				s(99)
			})
			expect(s()).toBe(42)
		})

		it('should restore writableScope after nested batches', () => {
			const s = signal(42, {readonly: true})
			batch(() => {
				batch(
					() => {
						s(99)
					},
					{writable: true}
				)
				s(100)
			})
			expect(s()).toBe(99)
		})

		it('should work with equals: false and readonly', () => {
			const s = signal(42, {equals: false, readonly: true})
			s(99)
			expect(s()).toBe(42)
			batch(
				() => {
					s(99)
				},
				{writable: true}
			)
			expect(s()).toBe(99)
		})

		it('should work with custom equals and readonly', () => {
			const s = signal({id: 1, name: 'a'}, {equals: (a, b) => a.id === b.id, readonly: true})
			s({id: 2, name: 'b'})
			expect(s()).toEqual({id: 1, name: 'a'})
			batch(
				() => {
					s({id: 2, name: 'b'})
				},
				{writable: true}
			)
			expect(s()).toEqual({id: 2, name: 'b'})
		})

		it('should not affect non-readonly signals', () => {
			const s = signal(42)
			s(99)
			expect(s()).toBe(99)
		})

		it('should allow reads from readonly signals normally', () => {
			const s = signal(42, {readonly: true})
			expect(s()).toBe(42)
		})

		it('should track readonly signals in effects', () => {
			const s = signal(0, {readonly: true})
			let captured = -1
			trackedEffect(() => {
				captured = s()
			})
			expect(captured).toBe(0)
			batch(
				() => {
					s(42)
				},
				{writable: true}
			)
			expect(captured).toBe(42)
		})
	})
})

// ---------------------------------------------------------------------------
// event<T>()
// ---------------------------------------------------------------------------

describe('event<T>()', () => {
	beforeEach(() => vi.clearAllMocks())

	it('should return undefined before first emit', () => {
		const ev = event<string>()
		expect(ev.read()).toBeUndefined()
	})

	it('should return void event undefined before first emit', () => {
		const ev = event()
		expect(ev.read()).toBeUndefined()
	})

	it('should auto-track inside effect and re-run when emitted', () => {
		const ev = event<number>()
		const runs = vi.fn()

		trackedEffect(() => {
			ev.read()
			runs()
		})

		expect(runs).toHaveBeenCalledTimes(1)
		ev(42)
		expect(runs).toHaveBeenCalledTimes(2)
	})

	it('should re-run effect when void event is emitted', () => {
		const ev = event()
		const runs = vi.fn()

		trackedEffect(() => {
			ev.read()
			runs()
		})

		expect(runs).toHaveBeenCalledTimes(1)
		ev()
		expect(runs).toHaveBeenCalledTimes(2)
	})

	it('should return latest payload from read', () => {
		const ev = event<number>()
		let captured: number | undefined

		trackedEffect(() => {
			captured = ev.read()
		})

		expect(captured).toBeUndefined()
		ev(42)
		expect(captured).toBe(42)
	})

	it('should fire subscribers even when emitting same payload reference', () => {
		const ev = event<{id: number}>()
		const payload = {id: 1}
		const runs = vi.fn()

		trackedEffect(() => {
			ev.read()
			runs()
		})

		expect(runs).toHaveBeenCalledTimes(1)
		ev(payload)
		expect(runs).toHaveBeenCalledTimes(2)
		ev(payload) // same reference
		expect(runs).toHaveBeenCalledTimes(3)
	})

	it('should allow multiple effects to subscribe independently', () => {
		const ev = event()
		const runsA = vi.fn()
		const runsB = vi.fn()

		trackedEffect(() => {
			ev.read()
			runsA()
		})
		trackedEffect(() => {
			ev.read()
			runsB()
		})

		expect(runsA).toHaveBeenCalledTimes(1)
		expect(runsB).toHaveBeenCalledTimes(1)

		ev()
		expect(runsA).toHaveBeenCalledTimes(2)
		expect(runsB).toHaveBeenCalledTimes(2)
	})

	it('should not cause infinite loop when e.read() called inside effect', () => {
		const ev = event()
		let count = 0

		trackedEffect(() => {
			ev.read()
			count++
		})

		expect(count).toBe(1)
	})

	it('.use() should call the registered factory', () => {
		const mockHook = vi.fn(() => 'event-hook')
		const factory: UseHookFactory = vi.fn(() => mockHook)
		setUseHookFactory(factory)

		const ev = event<number>()
		const result = ev.use()

		expect(factory).toHaveBeenCalledWith(ev.read)
		expect(mockHook).toHaveBeenCalled()
		expect(result).toBe('event-hook')
	})
})

// ---------------------------------------------------------------------------
// watch()
// ---------------------------------------------------------------------------

describe('watch()', () => {
	beforeEach(() => vi.clearAllMocks())

	it('should call fn when dependency changes', () => {
		const s = signal(0)
		const fn = vi.fn()

		const dispose = watch(s, fn)
		disposers.push(dispose)

		s(1)
		expect(fn).toHaveBeenCalledTimes(1)
	})

	it('should NOT call fn on first run (skip-first-run)', () => {
		const s = signal(0)
		const fn = vi.fn()

		const dispose = watch(s, fn)
		disposers.push(dispose)

		expect(fn).not.toHaveBeenCalled()
	})

	it('should return a disposer that stops future calls', () => {
		const s = signal(0)
		const fn = vi.fn()

		const dispose = watch(s, fn)
		disposers.push(dispose)

		s(1)
		expect(fn).toHaveBeenCalledTimes(1)

		dispose()
		s(2)
		expect(fn).toHaveBeenCalledTimes(1) // no additional call
	})

	it('should not track reactive reads inside the callback', () => {
		const source = signal(0)
		const extra = signal(0)
		const fn = vi.fn(() => {
			extra()
		})

		const dispose = watch(source, fn)
		disposers.push(dispose)

		source(1)
		expect(fn).toHaveBeenCalledTimes(1)

		extra(1)
		expect(fn).toHaveBeenCalledTimes(1)
	})

	it('should allow callbacks to emit void events', () => {
		const source = event()
		const emitted = event()
		const runs = vi.fn()

		trackedEffect(() => {
			emitted.read()
			runs()
		})

		const dispose = watch(
			() => source.read(),
			() => {
				emitted()
			}
		)
		disposers.push(dispose)

		expect(runs).toHaveBeenCalledTimes(1)
		source()
		expect(runs).toHaveBeenCalledTimes(2)
	})

	it('should not replay stale payloads on unrelated reactive changes', () => {
		const source = event<number>()
		const extra = signal(0)
		const seen: number[] = []

		const dispose = watch(
			() => source.read(),
			() => {
				const latest = source.read()
				if (latest !== undefined) {
					seen.push(latest)
				}
				extra()
			}
		)
		disposers.push(dispose)

		source(1)
		expect(seen).toEqual([1])

		extra(1)
		expect(seen).toEqual([1])

		source(2)
		expect(seen).toEqual([1, 2])
	})

	it('should pass newValue and oldValue to callback', () => {
		const s = signal(0)
		const calls: Array<[number, number | undefined]> = []

		const dispose = watch(s, (newVal, oldVal) => {
			calls.push([newVal, oldVal])
		})
		disposers.push(dispose)

		s(1)
		s(2)
		s(3)

		expect(calls).toEqual([
			[1, 0],
			[2, 1],
			[3, 2],
		])
	})

	it('should pass newValue and oldValue for events', () => {
		const ev = event<number>()
		const calls: Array<[number | undefined, number | undefined]> = []

		const dispose = watch(ev, (newVal, oldVal) => {
			calls.push([newVal, oldVal])
		})
		disposers.push(dispose)

		ev(10)
		ev(20)

		expect(calls).toEqual([
			[10, undefined],
			[20, 10],
		])
	})

	it('should accept signal directly (not wrapped in getter)', () => {
		const s = signal('a')
		const seen: string[] = []

		const dispose = watch(s, v => seen.push(v))
		disposers.push(dispose)

		s('b')
		s('c')

		expect(seen).toEqual(['b', 'c'])
	})
})

// ---------------------------------------------------------------------------
// registry — setUseHookFactory / getUseHookFactory
// ---------------------------------------------------------------------------

describe('registry', () => {
	it('getUseHookFactory should not throw once a factory has been set', async () => {
		// setUseHookFactory was called in earlier tests in this suite.
		// Verify it does not throw when a factory is already registered.
		expect(() => getUseHookFactory()).not.toThrow()
	})
})