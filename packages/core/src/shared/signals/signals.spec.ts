import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

import {effect} from './alien-signals'
import {setUseHookFactory, getUseHookFactory} from './registry'
import type {UseHookFactory} from './registry'
import {signal, voidEvent, payloadEvent, watch, event} from './signal'

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
		expect(s.get()).toBe('hello')
	})

	it('should support .set() as a write alias', () => {
		const s = signal('hello')
		s.set('world')
		expect(s.get()).toBe('world')
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
})

// ---------------------------------------------------------------------------
// voidEvent()
// ---------------------------------------------------------------------------

describe('voidEvent()', () => {
	beforeEach(() => vi.clearAllMocks())

	it('should increment internal state when called outside an effect (emits)', () => {
		const ev = voidEvent()
		// Calling outside effect should not throw
		expect(() => ev()).not.toThrow()
	})

	it('should re-run an effect that reads the event when emitted from outside', () => {
		const ev = voidEvent()
		const runs = vi.fn()

		trackedEffect(() => {
			ev() // subscribe inside effect
			runs()
		})

		expect(runs).toHaveBeenCalledTimes(1)
		ev() // emit outside effect
		expect(runs).toHaveBeenCalledTimes(2)
	})

	it('should allow multiple effects to subscribe to the same event', () => {
		const ev = voidEvent()
		const runsA = vi.fn()
		const runsB = vi.fn()

		trackedEffect(() => {
			ev()
			runsA()
		})
		trackedEffect(() => {
			ev()
			runsB()
		})

		expect(runsA).toHaveBeenCalledTimes(1)
		expect(runsB).toHaveBeenCalledTimes(1)

		ev() // emit
		expect(runsA).toHaveBeenCalledTimes(2)
		expect(runsB).toHaveBeenCalledTimes(2)
	})

	it('should not cause infinite loop when called inside an effect', () => {
		const ev = voidEvent()
		let count = 0

		// Inside the effect, ev() reads (subscribes), it should not emit
		trackedEffect(() => {
			ev()
			count++
		})

		// Should have run exactly once, not infinitely
		expect(count).toBe(1)
	})
})

// ---------------------------------------------------------------------------
// payloadEvent<T>()
// ---------------------------------------------------------------------------

describe('payloadEvent<T>()', () => {
	beforeEach(() => vi.clearAllMocks())

	it('should return undefined before first emit', () => {
		const ev = payloadEvent<string>()
		expect(ev()).toBeUndefined()
	})

	it('should set the current payload when called with an argument', () => {
		const ev = payloadEvent<string>()
		ev('hello')
		// Read outside effect — we need an effect to track, but we can just call ev()
		// Actually payloadEvent reads track inside effects. Let's read in an effect.
		let captured: string | undefined
		trackedEffect(() => {
			captured = ev()
		})
		expect(captured).toBe('hello')
	})

	it('should return the payload after emitting', () => {
		const ev = payloadEvent<number>()
		let captured: number | undefined

		trackedEffect(() => {
			captured = ev()
		})

		expect(captured).toBeUndefined()
		ev(42)
		expect(captured).toBe(42)
	})

	it('should fire subscribers even when emitting same payload object twice (reference boxing)', () => {
		const ev = payloadEvent<{id: number}>()
		const payload = {id: 1}
		const runs = vi.fn()

		trackedEffect(() => {
			ev()
			runs()
		})

		expect(runs).toHaveBeenCalledTimes(1)
		ev(payload)
		expect(runs).toHaveBeenCalledTimes(2)
		ev(payload) // same reference
		expect(runs).toHaveBeenCalledTimes(3)
	})

	it('should re-run an effect that reads ev() when ev(payload) is called', () => {
		const ev = payloadEvent<string>()
		const runs = vi.fn()

		trackedEffect(() => {
			ev()
			runs()
		})

		expect(runs).toHaveBeenCalledTimes(1)
		ev('data')
		expect(runs).toHaveBeenCalledTimes(2)
	})

	it('.use() should call the registered factory', () => {
		const mockHook = vi.fn(() => 'payload-hook')
		const factory: UseHookFactory = vi.fn(() => mockHook)
		setUseHookFactory(factory)

		const ev = payloadEvent<number>()
		const result = ev.use()

		expect(factory).toHaveBeenCalledWith(ev)
		expect(mockHook).toHaveBeenCalled()
		expect(result).toBe('payload-hook')
	})
})

// ---------------------------------------------------------------------------
// event<T>()
// ---------------------------------------------------------------------------

describe('event<T>()', () => {
	beforeEach(() => vi.clearAllMocks())

	it('should return undefined before first emit', () => {
		const ev = event<string>()
		expect(ev()).toBeUndefined()
	})

	it('should return void event undefined before first emit', () => {
		const ev = event()
		expect(ev()).toBeUndefined()
	})

	it('should auto-track inside effect and re-run when emitted', () => {
		const ev = event<number>()
		const runs = vi.fn()

		trackedEffect(() => {
			ev()
			runs()
		})

		expect(runs).toHaveBeenCalledTimes(1)
		ev.emit(42)
		expect(runs).toHaveBeenCalledTimes(2)
	})

	it('should re-run effect when void event is emitted', () => {
		const ev = event()
		const runs = vi.fn()

		trackedEffect(() => {
			ev()
			runs()
		})

		expect(runs).toHaveBeenCalledTimes(1)
		ev.emit()
		expect(runs).toHaveBeenCalledTimes(2)
	})

	it('should return latest payload from read', () => {
		const ev = event<number>()
		let captured: number | undefined

		trackedEffect(() => {
			captured = ev()
		})

		expect(captured).toBeUndefined()
		ev.emit(42)
		expect(captured).toBe(42)
	})

	it('should fire subscribers even when emitting same payload reference', () => {
		const ev = event<{id: number}>()
		const payload = {id: 1}
		const runs = vi.fn()

		trackedEffect(() => {
			ev()
			runs()
		})

		expect(runs).toHaveBeenCalledTimes(1)
		ev.emit(payload)
		expect(runs).toHaveBeenCalledTimes(2)
		ev.emit(payload) // same reference
		expect(runs).toHaveBeenCalledTimes(3)
	})

	it('should allow multiple effects to subscribe independently', () => {
		const ev = event()
		const runsA = vi.fn()
		const runsB = vi.fn()

		trackedEffect(() => {
			ev()
			runsA()
		})
		trackedEffect(() => {
			ev()
			runsB()
		})

		expect(runsA).toHaveBeenCalledTimes(1)
		expect(runsB).toHaveBeenCalledTimes(1)

		ev.emit()
		expect(runsA).toHaveBeenCalledTimes(2)
		expect(runsB).toHaveBeenCalledTimes(2)
	})

	it('should not cause infinite loop when e() called inside effect', () => {
		const ev = event()
		let count = 0

		trackedEffect(() => {
			ev()
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

		expect(factory).toHaveBeenCalledWith(ev)
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
		const source = voidEvent()
		const emitted = voidEvent()
		const runs = vi.fn()

		trackedEffect(() => {
			emitted()
			runs()
		})

		const dispose = watch(
			() => source(),
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
		const source = payloadEvent<number>()
		const extra = signal(0)
		const seen: number[] = []

		const dispose = watch(
			() => source(),
			() => {
				const latest = source()
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