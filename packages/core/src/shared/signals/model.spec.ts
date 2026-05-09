import {describe, it, expect, vi} from 'vitest'

import {shallow} from '../utils/shallow'
import {signal, effect, model, isReactive} from './signal'

describe('model', () => {
	it('returns get(internal) on first read using default seed', () => {
		const m = model<string>({
			default: () => 'seed',
			get: value => value,
			set: (next, previous) => next ?? previous,
		})
		expect(m()).toBe('seed')
	})

	it('runs default lazily on first read', () => {
		let calls = 0
		const m = model<string>({
			default: () => {
				calls++
				return 'seed'
			},
			get: value => value,
			set: (_next, previous) => previous,
		})
		expect(calls).toBe(0)
		m()
		expect(calls).toBe(1)
		m()
		expect(calls).toBe(1)
	})

	it('runs default in untracked scope — dep change does not invalidate reader', () => {
		const dep = signal('x')
		let getCalls = 0
		const m = model<string>({
			default: () => dep(),
			get: value => {
				getCalls++
				return value
			},
			set: (_next, previous) => previous,
		})
		expect(m()).toBe('x')
		expect(getCalls).toBe(1)
		dep('y')
		// Reader is memoized and dep is not one of its deps (default ran untracked),
		// so neither get nor the underlying internal signal re-evaluates.
		expect(m()).toBe('x')
		expect(getCalls).toBe(1)
	})

	it('passes (next, previous) to set', () => {
		const setSpy = vi.fn((_next: string | undefined, previous: string) => previous)
		const m = model<string>({
			default: () => 'init',
			get: value => value,
			set: setSpy,
		})
		m() // ensure default ran
		m('updated')
		expect(setSpy).toHaveBeenCalledWith('updated', 'init')
	})

	it('writes set return value to internal', () => {
		const m = model<string>({
			default: () => 'a',
			get: value => value,
			set: (next, previous) => next ?? previous,
		})
		m('b')
		expect(m()).toBe('b')
	})

	it('keeps internal unchanged when set returns previous', () => {
		const m = model<string>({
			default: () => 'a',
			get: value => value,
			set: (_next, previous) => previous,
		})
		m('b')
		expect(m()).toBe('a')
	})

	it('controlled-style: get reads external; set returning previous keeps internal stable', () => {
		const external = signal('controlled')
		const m = model<string>({
			default: () => 'fallback',
			get: _value => external(),
			set: (_next, previous) => previous,
		})
		expect(m()).toBe('controlled')
		m('attempted')
		expect(m()).toBe('controlled')
	})

	it('uncontrolled-style: get reads internal; set returning next writes internal', () => {
		const m = model<string>({
			default: () => 'init',
			get: value => value,
			set: (next, previous) => next ?? previous,
		})
		expect(m()).toBe('init')
		m('updated')
		expect(m()).toBe('updated')
	})

	it('propagates external dep changes to effects via get', () => {
		const external = signal('a')
		const m = model<string>({
			default: () => '',
			get: _value => external(),
			set: (_next, previous) => previous,
		})
		const results: string[] = []
		const dispose = effect(() => {
			results.push(m())
		})
		expect(results).toEqual(['a'])
		external('b')
		expect(results).toEqual(['a', 'b'])
		dispose()
	})

	it('propagates internal writes to effects', () => {
		const m = model<number>({
			default: () => 0,
			get: value => value,
			set: (next, previous) => next ?? previous,
		})
		const results: number[] = []
		const dispose = effect(() => {
			results.push(m())
		})
		expect(results).toEqual([0])
		m(1)
		expect(results).toEqual([0, 1])
		dispose()
	})

	it('isReactive returns true for model', () => {
		const m = model<string>({
			default: () => '',
			get: value => value,
			set: (_next, previous) => previous,
		})
		expect(isReactive(m)).toBe(true)
	})
})

describe('model — upgrade: optional fields and equals', () => {
	it('returns undefined initially when default is omitted', () => {
		const m = model<string>({})
		expect(m()).toBeUndefined()
	})

	it('writes value when set is omitted (identity default)', () => {
		const m = model<string>({default: () => 'a'})
		expect(m()).toBe('a')
		m('b')
		expect(m()).toBe('b')
	})

	it('treats m(undefined) as a no-op when set is omitted', () => {
		const m = model<string>({default: () => 'a'})
		m('b')
		m(undefined)
		expect(m()).toBe('b')
	})

	it('reads via custom get when default is omitted', () => {
		const m = model<string>({get: value => value ?? 'fallback'})
		expect(m()).toBe('fallback')
		m('written')
		expect(m()).toBe('written')
	})

	it('skips subscribers when equals reports unchanged', () => {
		const m = model<{x: number}>({default: () => ({x: 1}), equals: shallow})
		const runs = vi.fn()
		const dispose = effect(() => {
			m()
			runs()
		})
		expect(runs).toHaveBeenCalledTimes(1)
		m({x: 1})
		expect(runs).toHaveBeenCalledTimes(1)
		m({x: 2})
		expect(runs).toHaveBeenCalledTimes(2)
		dispose()
	})

	it('uses reference equality when equals is omitted', () => {
		const m = model<{x: number}>({default: () => ({x: 1})})
		const runs = vi.fn()
		const dispose = effect(() => {
			m()
			runs()
		})
		expect(runs).toHaveBeenCalledTimes(1)
		m({x: 1})
		expect(runs).toHaveBeenCalledTimes(2)
		dispose()
	})

	it('isReactive returns true for a model with no options', () => {
		const m = model<string>({})
		expect(isReactive(m)).toBe(true)
	})
})