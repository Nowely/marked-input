import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

import {shallow} from '../utils/shallow'
import {signal, computed, watch, event, batch, effect, effectScope, listen, isReactive} from './signal'
import type {SignalValues, Signal} from './signal'

// Helper to track and dispose effects created during tests
let disposers: (() => void)[]

beforeEach(() => {
	disposers = []
})

afterEach(() => {
	for (const dispose of disposers) dispose()
	disposers = []
})

function trackedEffect(fn: () => void | (() => void)): () => void {
	const dispose = effect(fn)
	disposers.push(dispose)
	return dispose
}

// ---------------------------------------------------------------------------
// signal<T> — basic read / write / track
// ---------------------------------------------------------------------------

describe('signal<T>', () => {
	beforeEach(() => vi.clearAllMocks())

	it('return current value when called with no args', () => {
		const s = signal<number>({initial: 42})
		expect(s()).toBe(42)
	})

	it('update the value when called with an arg', () => {
		const s = signal<number>({initial: 0})
		s(10)
		expect(s()).toBe(10)
	})

	it('return the initial value', () => {
		const s = signal<string>({initial: 'hello'})
		expect(s()).toBe('hello')
	})

	it('overwrite the value on subsequent writes', () => {
		const s = signal<string>({initial: 'hello'})
		s('world')
		expect(s()).toBe('world')
	})

	it('NOT re-notify when the same value is set', () => {
		const s = signal<number>({initial: 5})
		const runs = vi.fn()

		trackedEffect(() => {
			s()
			runs()
		})

		expect(runs).toHaveBeenCalledTimes(1)
		s(5)
		expect(runs).toHaveBeenCalledTimes(1)
	})

	it('skip notification when custom equals returns true', () => {
		const s = signal<{id: number; name: string}>({
			initial: {id: 1, name: 'a'},
			equals: (a, b) => a.id === b.id,
		})
		const runs = vi.fn()

		trackedEffect(() => {
			s()
			runs()
		})

		expect(runs).toHaveBeenCalledTimes(1)
		s({id: 1, name: 'changed'})
		expect(runs).toHaveBeenCalledTimes(1)
	})

	it('notify when custom equals returns false', () => {
		const s = signal<{id: number; name: string}>({
			initial: {id: 1, name: 'a'},
			equals: (a, b) => a.id === b.id,
		})
		const runs = vi.fn()

		trackedEffect(() => {
			s()
			runs()
		})

		expect(runs).toHaveBeenCalledTimes(1)
		s({id: 2, name: 'b'})
		expect(runs).toHaveBeenCalledTimes(2)
	})

	it('auto-track inside effect', () => {
		const s = signal<number>({initial: 0})
		let captured = -1

		trackedEffect(() => {
			captured = s()
		})

		expect(captured).toBe(0)
		s(42)
		expect(captured).toBe(42)
	})

	it('not have a .use() method', () => {
		const s = signal<number>({initial: 1})
		// @ts-expect-error -- .use() must not exist on Signal after this refactor
		expect(typeof s.use).toBe('undefined')
	})

	describe('setter return value', () => {
		it('return true when value actually changes', () => {
			const s = signal<number>({initial: 0})
			expect(s(1)).toBe(true)
		})

		it('return false when setting the same value', () => {
			const s = signal<number>({initial: 5})
			expect(s(5)).toBe(false)
		})

		it('return false when custom equals reports equality', () => {
			const s = signal<{id: number; name: string}>({
				initial: {id: 1, name: 'a'},
				equals: (a, b) => a.id === b.id,
			})
			expect(s({id: 1, name: 'changed'})).toBe(false)
		})

		it('return true when custom equals reports inequality', () => {
			const s = signal<{id: number; name: string}>({
				initial: {id: 1, name: 'a'},
				equals: (a, b) => a.id === b.id,
			})
			expect(s({id: 2, name: 'b'})).toBe(true)
		})

		it('return false for readonly writes outside mutable batch', () => {
			const s = signal<number>({initial: 42, readonly: true})
			expect(s(99)).toBe(false)
		})

		it('return true for readonly writes inside mutable batch when value changes', () => {
			const s = signal<number>({initial: 42, readonly: true})
			let result: boolean | undefined
			batch(
				() => {
					result = s(99)
				},
				{mutable: true}
			)
			expect(result).toBe(true)
		})
	})
})

// ---------------------------------------------------------------------------
// initial values & undefined semantics
// ---------------------------------------------------------------------------

describe('signal<T> initial values', () => {
	it('start at undefined when initial is omitted', () => {
		const s = signal<string>()
		expect(s()).toBeUndefined()
	})

	it('start at the provided initial value', () => {
		const s = signal<string>({initial: 'hello'})
		expect(s()).toBe('hello')
	})

	it('store undefined literally when writing undefined', () => {
		const s = signal<string>({initial: 'hello'})
		s(undefined)
		expect(s()).toBeUndefined()
	})

	it('treat null as a valid initial value', () => {
		const s = signal<string | null>({initial: null})
		expect(s()).toBeNull()
		s('hello')
		expect(s()).toBe('hello')
	})

	it('does not conflate null with undefined', () => {
		const s = signal<string | null>({initial: null})
		s('world')
		s(undefined)
		expect(s()).toBeUndefined()
	})

	it('widen to Signal<T | undefined> when initial is omitted', () => {
		const s = signal<string>()
		const widened: Signal<string | undefined> = s
		expect(widened()).toBeUndefined()
		s('hello')
		expect(s()).toBe('hello')
	})

	it('keep Signal<T> exact when initial is defined', () => {
		const s = signal<string>({initial: 'hello'})
		const exact: Signal<string> = s
		expect(exact()).toBe('hello')
	})

	it('accept signal() with no args as Signal<undefined>', () => {
		const s = signal()
		const exact: Signal<undefined> = s
		expect(exact()).toBeUndefined()
	})

	it('notify subscribers when writing undefined after a value', () => {
		const s = signal<string>({initial: 'a'})
		const runs = vi.fn()
		trackedEffect(() => {
			s()
			runs()
		})
		runs.mockClear()
		s(undefined)
		expect(runs).toHaveBeenCalledTimes(1)
		expect(s()).toBeUndefined()
	})

	it('does not re-notify when writing undefined twice', () => {
		const s = signal<string>()
		const runs = vi.fn()
		trackedEffect(() => {
			s()
			runs()
		})
		runs.mockClear()
		s(undefined)
		expect(runs).toHaveBeenCalledTimes(0)
	})
})

// ---------------------------------------------------------------------------
// readonly option
// ---------------------------------------------------------------------------

describe('signal<T> readonly option', () => {
	it('ignore direct writes when readonly is true', () => {
		const s = signal<number>({initial: 42, readonly: true})
		s(99)
		expect(s()).toBe(42)
	})

	it('allow writes inside batch with mutable: true', () => {
		const s = signal<number>({initial: 42, readonly: true})
		batch(
			() => {
				s(99)
			},
			{mutable: true}
		)
		expect(s()).toBe(99)
	})

	it('ignore writes inside regular batch without mutable', () => {
		const s = signal<number>({initial: 42, readonly: true})
		batch(() => {
			s(99)
		})
		expect(s()).toBe(42)
	})

	it('restore mutableScope after nested batches', () => {
		const s = signal<number>({initial: 42, readonly: true})
		batch(() => {
			batch(
				() => {
					s(99)
				},
				{mutable: true}
			)
			s(100)
		})
		expect(s()).toBe(99)
	})

	it('work with custom equals and readonly', () => {
		const s = signal<{id: number; name: string}>({
			initial: {id: 1, name: 'a'},
			equals: (a, b) => a.id === b.id,
			readonly: true,
		})
		s({id: 2, name: 'b'})
		expect(s()).toEqual({id: 1, name: 'a'})
		batch(
			() => {
				s({id: 2, name: 'b'})
			},
			{mutable: true}
		)
		expect(s()).toEqual({id: 2, name: 'b'})
	})

	it('not affect non-readonly signals', () => {
		const s = signal<number>({initial: 42})
		s(99)
		expect(s()).toBe(99)
	})

	it('allow reads from readonly signals normally', () => {
		const s = signal<number>({initial: 42, readonly: true})
		expect(s()).toBe(42)
	})

	it('track readonly signals in effects', () => {
		const s = signal<number>({initial: 0, readonly: true})
		let captured = -1
		trackedEffect(() => {
			captured = s()
		})
		expect(captured).toBe(0)
		batch(
			() => {
				s(42)
			},
			{mutable: true}
		)
		expect(captured).toBe(42)
	})
})

// ---------------------------------------------------------------------------
// signal<T> with computed views
// ---------------------------------------------------------------------------

describe('signal<T> with computed views', () => {
	beforeEach(() => vi.clearAllMocks())

	it('expose attached computeds as Computed values', () => {
		const layout = signal({
			initial: 'inline' as 'inline' | 'block',
			computed: self => ({
				isBlock: () => self() === 'block',
			}),
		})
		const isBlockResult: boolean = layout.isBlock()
		expect(typeof layout.isBlock).toBe('function')
		expect(isBlockResult).toBe(false)
		expect(isReactive(layout.isBlock)).toBe(true)
	})

	it('recompute attached views when the signal updates', () => {
		const layout = signal({
			initial: 'inline' as 'inline' | 'block',
			computed: self => ({
				isBlock: () => self() === 'block',
			}),
		})

		const runs = vi.fn()
		trackedEffect(() => {
			layout.isBlock()
			runs()
		})
		expect(runs).toHaveBeenCalledTimes(1)

		layout('block')
		expect(layout.isBlock()).toBe(true)
		expect(runs).toHaveBeenCalledTimes(2)
	})

	it('still treat the augmented value as a normal signal', () => {
		const layout = signal({
			initial: 'inline' as 'inline' | 'block',
			computed: self => ({isBlock: () => self() === 'block'}),
		})
		expect(isReactive(layout)).toBe(true)
		layout('block')
		expect(layout()).toBe('block')
	})

	it('support multiple computed views on one signal', () => {
		const layout = signal({
			initial: 'inline' as 'inline' | 'block',
			computed: self => ({
				isBlock: () => self() === 'block',
				isInline: () => self() === 'inline',
			}),
		})
		expect(layout.isBlock()).toBe(false)
		expect(layout.isInline()).toBe(true)
		layout('block')
		expect(layout.isBlock()).toBe(true)
		expect(layout.isInline()).toBe(false)
	})

	it('honor readonly while still exposing computed views', () => {
		const layout = signal({
			initial: 'inline' as 'inline' | 'block',
			readonly: true,
			computed: self => ({isBlock: () => self() === 'block'}),
		})
		expect(layout.isBlock()).toBe(false)
		expect(layout('block')).toBe(false)
		expect(layout()).toBe('inline')
		expect(layout.isBlock()).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// signal<T> with lazy initial, get, set
// ---------------------------------------------------------------------------

describe('signal<T> with lazy initial', () => {
	it('returns the lazy initial value on first read', () => {
		const s = signal<string>({initial: () => 'seed'})
		expect(s()).toBe('seed')
	})

	it('runs the initial factory lazily on first read', () => {
		let calls = 0
		const s = signal<string>({
			initial: () => {
				calls++
				return 'seed'
			},
		})
		expect(calls).toBe(0)
		s()
		expect(calls).toBe(1)
		s()
		expect(calls).toBe(1)
	})

	it('runs the initial factory in untracked scope — dep changes do not propagate to consumers', () => {
		const dep = signal<string>({initial: 'x'})
		const s = signal<string>({initial: () => dep()})
		const runs = vi.fn()
		trackedEffect(() => {
			s()
			runs()
		})
		expect(runs).toHaveBeenCalledTimes(1)
		dep('y')
		// Factory ran in untracked, so the signal is not subscribed to dep.
		expect(runs).toHaveBeenCalledTimes(1)
	})

	it('realizes the factory on first write before set runs', () => {
		const s = signal<number>({
			initial: () => 10,
			set: (next, previous) => {
				expect(previous).toBe(10)
				return next ?? previous
			},
		})
		s(20)
		expect(s()).toBe(20)
	})
})

describe('signal<T> with get/set transforms', () => {
	it('reads via get when no value has been written', () => {
		const s = signal<string>({
			initial: 'fallback',
			get: value => value.toUpperCase(),
		})
		expect(s()).toBe('FALLBACK')
	})

	it('calls set with (next, previous) and writes the return value to internal', () => {
		const setSpy = vi.fn((next: string | undefined, previous: string) => next ?? previous)
		const s = signal<string>({initial: 'init', set: setSpy})
		s('updated')
		expect(setSpy).toHaveBeenCalledWith('updated', 'init')
		expect(s()).toBe('updated')
	})

	it('keeps internal unchanged when set returns previous (reject)', () => {
		const s = signal<string>({
			initial: 'a',
			set: (_next, previous) => previous,
		})
		s('b')
		expect(s()).toBe('a')
	})

	it('controlled-style: get reads external; set returning previous keeps internal stable', () => {
		const external = signal<string>({initial: 'controlled'})
		const s = signal<string>({
			initial: 'fallback',
			get: () => external(),
			set: (_next, previous) => previous,
		})
		expect(s()).toBe('controlled')
		s('attempted')
		expect(s()).toBe('controlled')
	})

	it('uncontrolled-style: get reads internal; set returning next writes internal', () => {
		const s = signal<string>({
			initial: 'init',
			get: value => value,
			set: (next, previous) => next ?? previous,
		})
		expect(s()).toBe('init')
		s('updated')
		expect(s()).toBe('updated')
	})

	it('propagates external dep changes to effects via get', () => {
		const external = signal<string>({initial: 'a'})
		const s = signal<string>({
			initial: '',
			get: () => external(),
			set: (_next, previous) => previous,
		})
		const results: string[] = []
		const dispose = effect(() => {
			results.push(s())
		})
		expect(results).toEqual(['a'])
		external('b')
		expect(results).toEqual(['a', 'b'])
		dispose()
	})

	it('propagates internal writes to effects', () => {
		const s = signal<number>({
			initial: 0,
			set: (next, previous) => next ?? previous,
		})
		const results: number[] = []
		const dispose = effect(() => {
			results.push(s())
		})
		expect(results).toEqual([0])
		s(1)
		expect(results).toEqual([0, 1])
		dispose()
	})

	it('returns true when write changes the internal value', () => {
		const s = signal<number>({initial: 0})
		expect(s(1)).toBe(true)
	})

	it('returns false when write keeps the internal value the same', () => {
		const s = signal<number>({initial: 5})
		expect(s(5)).toBe(false)
	})

	it('returns false when set returns previous (rejection)', () => {
		const s = signal<number>({
			initial: 0,
			set: (_next, prev) => prev,
		})
		expect(s(99)).toBe(false)
	})

	it('returns false when equals reports unchanged', () => {
		const s = signal<{id: number}>({
			initial: {id: 1},
			equals: (a, b) => a.id === b.id,
		})
		expect(s({id: 1})).toBe(false)
	})

	it('returns true when equals reports changed', () => {
		const s = signal<{id: number}>({
			initial: {id: 1},
			equals: (a, b) => a.id === b.id,
		})
		expect(s({id: 2})).toBe(true)
	})

	it('skips subscribers when equals reports unchanged', () => {
		const s = signal<{x: number}>({initial: {x: 1}, equals: shallow})
		const runs = vi.fn()
		const dispose = effect(() => {
			s()
			runs()
		})
		expect(runs).toHaveBeenCalledTimes(1)
		s({x: 1})
		expect(runs).toHaveBeenCalledTimes(1)
		s({x: 2})
		expect(runs).toHaveBeenCalledTimes(2)
		dispose()
	})

	it('uses reference equality when equals is omitted', () => {
		const s = signal<{x: number}>({initial: {x: 1}})
		const runs = vi.fn()
		const dispose = effect(() => {
			s()
			runs()
		})
		expect(runs).toHaveBeenCalledTimes(1)
		s({x: 1})
		expect(runs).toHaveBeenCalledTimes(2)
		dispose()
	})

	it('isReactive returns true for a signal with get/set', () => {
		const s = signal<string>({
			initial: 'a',
			get: value => value,
			set: (_next, previous) => previous,
		})
		expect(isReactive(s)).toBe(true)
	})

	it('isReactive returns true for a signal with no options', () => {
		const s = signal<string>()
		expect(isReactive(s)).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// event<T>()
// ---------------------------------------------------------------------------

describe('event<T>()', () => {
	beforeEach(() => vi.clearAllMocks())

	it('return undefined before first emit', () => {
		const ev = event<string>()
		expect(ev.read()).toBeUndefined()
	})

	it('return void event undefined before first emit', () => {
		const ev = event()
		expect(ev.read()).toBeUndefined()
	})

	it('auto-track inside effect and re-run when emitted', () => {
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

	it('re-run effect when void event is emitted', () => {
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

	it('return latest payload from read', () => {
		const ev = event<number>()
		let captured: number | undefined

		trackedEffect(() => {
			captured = ev.read()
		})

		expect(captured).toBeUndefined()
		ev(42)
		expect(captured).toBe(42)
	})

	it('fire subscribers even when emitting same payload reference', () => {
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
		ev(payload)
		expect(runs).toHaveBeenCalledTimes(3)
	})

	it('allow multiple effects to subscribe independently', () => {
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

	it('not cause infinite loop when e.read() called inside effect', () => {
		const ev = event()
		let count = 0

		trackedEffect(() => {
			ev.read()
			count++
		})

		expect(count).toBe(1)
	})

	it('not have a .use() method', () => {
		const ev = event<number>()
		// @ts-expect-error -- .use() must not exist on Event after this refactor
		expect(typeof ev.use).toBe('undefined')
	})
})

// ---------------------------------------------------------------------------
// watch()
// ---------------------------------------------------------------------------

describe('watch()', () => {
	beforeEach(() => vi.clearAllMocks())

	it('call fn when dependency changes', () => {
		const s = signal<number>({initial: 0})
		const fn = vi.fn()

		const dispose = watch(s, fn)
		disposers.push(dispose)

		s(1)
		expect(fn).toHaveBeenCalledTimes(1)
	})

	it('NOT call fn on first run (skip-first-run)', () => {
		const s = signal<number>({initial: 0})
		const fn = vi.fn()

		const dispose = watch(s, fn)
		disposers.push(dispose)

		expect(fn).not.toHaveBeenCalled()
	})

	it('return a disposer that stops future calls', () => {
		const s = signal<number>({initial: 0})
		const fn = vi.fn()

		const dispose = watch(s, fn)
		disposers.push(dispose)

		s(1)
		expect(fn).toHaveBeenCalledTimes(1)

		dispose()
		s(2)
		expect(fn).toHaveBeenCalledTimes(1)
	})

	it('not track reactive reads inside the callback', () => {
		const source = signal<number>({initial: 0})
		const extra = signal<number>({initial: 0})
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

	it('allow callbacks to emit void events', () => {
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

	it('not replay stale payloads on unrelated reactive changes', () => {
		const source = event<number>()
		const extra = signal<number>({initial: 0})
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

	it('pass newValue and oldValue to callback', () => {
		const s = signal<number>({initial: 0})
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

	it('pass newValue and oldValue for events', () => {
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

	it('accept signal directly (not wrapped in getter)', () => {
		const s = signal<string>({initial: 'a'})
		const seen: string[] = []

		const dispose = watch(s, v => seen.push(v))
		disposers.push(dispose)

		s('b')
		s('c')

		expect(seen).toEqual(['b', 'c'])
	})

	it('fires callback immediately when immediate: true', () => {
		const s = signal<number>({initial: 0})
		const fn = vi.fn()

		const dispose = watch(s, fn, {immediate: true})
		disposers.push(dispose)

		expect(fn).toHaveBeenCalledTimes(1)
		expect(fn).toHaveBeenCalledWith(0, undefined)

		s(1)
		expect(fn).toHaveBeenCalledTimes(2)
		expect(fn).toHaveBeenCalledWith(1, 0)
	})

	it('disposer stops future calls with immediate: true', () => {
		const s = signal<number>({initial: 0})
		const fn = vi.fn()

		const dispose = watch(s, fn, {immediate: true})
		disposers.push(dispose)

		expect(fn).toHaveBeenCalledTimes(1)

		dispose()
		s(1)
		expect(fn).toHaveBeenCalledTimes(1)
	})

	it('defaults to skip-first-run when immediate is omitted', () => {
		const s = signal<number>({initial: 0})
		const fn = vi.fn()

		const dispose = watch(s, fn)
		disposers.push(dispose)

		expect(fn).not.toHaveBeenCalled()
	})
})

// ---------------------------------------------------------------------------
// effect cleanup
// ---------------------------------------------------------------------------

describe('effect cleanup', () => {
	beforeEach(() => vi.clearAllMocks())

	it('call returned cleanup on re-run', () => {
		const s = signal<number>({initial: 0})
		const cleanup = vi.fn()

		trackedEffect(() => {
			s()
			return cleanup
		})

		expect(cleanup).not.toHaveBeenCalled()
		s(1)
		expect(cleanup).toHaveBeenCalledTimes(1)
		s(2)
		expect(cleanup).toHaveBeenCalledTimes(2)
	})

	it('call returned cleanup on explicit disposal', () => {
		const cleanup = vi.fn()

		const dispose = effect(() => cleanup)
		disposers.push(dispose)

		expect(cleanup).not.toHaveBeenCalled()
		dispose()
		expect(cleanup).toHaveBeenCalledTimes(1)
	})

	it('call inner effect cleanup when outer re-runs', () => {
		const show = signal<boolean>({initial: true})
		const innerCleanup = vi.fn()

		trackedEffect(() => {
			if (show()) {
				effect(() => innerCleanup)
			}
		})

		expect(innerCleanup).not.toHaveBeenCalled()
		show(false)
		expect(innerCleanup).toHaveBeenCalledTimes(1)
	})

	it('call cleanup when scope is disposed', () => {
		const cleanup = vi.fn()

		const scope = effectScope(() => {
			effect(() => cleanup)
		})

		expect(cleanup).not.toHaveBeenCalled()
		scope()
		expect(cleanup).toHaveBeenCalledTimes(1)
	})

	it('replace cleanup on each re-run', () => {
		const s = signal<number>({initial: 0})
		const cleanups: number[] = []

		trackedEffect(() => {
			const v = s()
			return () => cleanups.push(v)
		})

		s(1)
		expect(cleanups).toEqual([0])
		s(2)
		expect(cleanups).toEqual([0, 1])
	})

	it('work with effects returning void (no cleanup)', () => {
		const s = signal<number>({initial: 0})
		const runs = vi.fn()

		trackedEffect(() => {
			s()
			runs()
		})

		expect(runs).toHaveBeenCalledTimes(1)
		s(1)
		expect(runs).toHaveBeenCalledTimes(2)
	})
})

// ---------------------------------------------------------------------------
// listen()
// ---------------------------------------------------------------------------

describe('listen()', () => {
	beforeEach(() => vi.clearAllMocks())

	it('add listener and auto-remove on scope disposal', () => {
		const target = new EventTarget()
		const handler = vi.fn()
		const addSpy = vi.spyOn(target, 'addEventListener')
		const removeSpy = vi.spyOn(target, 'removeEventListener')

		const scope = effectScope(() => {
			listen(target, 'click', handler)
		})

		expect(addSpy).toHaveBeenCalledWith('click', handler, undefined)
		expect(removeSpy).not.toHaveBeenCalled()

		scope()

		expect(removeSpy).toHaveBeenCalledWith('click', handler, undefined)
	})

	it('remove listener when nested effect re-runs', () => {
		const target = new EventTarget()
		const handler = vi.fn()
		const show = signal<boolean>({initial: true})
		const removeSpy = vi.spyOn(target, 'removeEventListener')

		trackedEffect(() => {
			if (show()) {
				listen(target, 'input', handler)
			}
		})

		expect(removeSpy).not.toHaveBeenCalled()
		show(false)
		expect(removeSpy).toHaveBeenCalledWith('input', handler, undefined)
	})

	it('return a dispose function for manual cleanup', () => {
		const target = new EventTarget()
		const handler = vi.fn()
		const removeSpy = vi.spyOn(target, 'removeEventListener')

		const dispose = listen(target, 'keydown', handler)
		disposers.push(dispose)

		expect(removeSpy).not.toHaveBeenCalled()
		dispose()
		expect(removeSpy).toHaveBeenCalledWith('keydown', handler, undefined)
	})

	it('pass options through to addEventListener', () => {
		const target = new EventTarget()
		const handler = vi.fn()
		const addSpy = vi.spyOn(target, 'addEventListener')

		effectScope(() => {
			listen(target, 'click', handler, {capture: true})
		})()

		expect(addSpy).toHaveBeenCalledWith('click', handler, {capture: true})
	})
})

// ---------------------------------------------------------------------------
// isReactive
// ---------------------------------------------------------------------------

describe('isReactive', () => {
	it('returns true for a signal', () => {
		expect(isReactive(signal<number>({initial: 0}))).toBe(true)
	})

	it('returns true for a computed', () => {
		const c = computed(() => 1)
		expect(isReactive(c)).toBe(true)
	})

	it('returns false for a plain function', () => {
		expect(isReactive(() => 0)).toBe(false)
	})

	it('returns false for a plain object', () => {
		expect(isReactive({foo: 'bar'})).toBe(false)
	})

	it('returns false for null', () => {
		expect(isReactive(null)).toBe(false)
	})

	it('returns false for an event callable', () => {
		const e = event()
		expect(isReactive(e)).toBe(false)
	})

	it('returns false for event.read', () => {
		const e = event()
		expect(isReactive(e.read)).toBe(false)
	})
})

function _typeTest_SignalValues_passthrough() {
	type Input = {count: Signal<number>; label: string}
	const _: SignalValues<Input> = {count: 0, label: 'hello'}
	return _
}