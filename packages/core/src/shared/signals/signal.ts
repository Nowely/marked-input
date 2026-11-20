// oxlint-disable typescript/no-explicit-any -- reactive node interfaces need flexible generic defaults
import {createReactiveSystem, ReactiveFlags, type Link, type ReactiveNode} from './alien-signals/system'

// ---------------------------------------------------------------------------
// Node types
// ---------------------------------------------------------------------------

interface SignalNode<T = any> extends ReactiveNode {
	currentValue: T
	pendingValue: T
	equalsFn: ((a: T, b: T) => boolean) | undefined
}

interface ComputedNode<T = any> extends ReactiveNode {
	value: T | undefined
	getter: (previousValue?: T) => T
	equalsFn: ((a: T, b: T) => boolean) | undefined
}

interface EffectNode extends ReactiveNode {
	fn(): void | (() => void)
	cleanup?: () => void
}

interface EventNode<T = any> extends ReactiveNode {
	payload: T | undefined
	seq: number
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let cycle = 0
let batchDepth = 0
let notifyIndex = 0
let queuedLength = 0
let activeSub: ReactiveNode | undefined
let mutableScope = false

const queued: (EffectNode | undefined)[] = []

// ---------------------------------------------------------------------------
// Reactive system
// ---------------------------------------------------------------------------

const {link, unlink, propagate, checkDirty, shallowPropagate} = createReactiveSystem({
	update(node: SignalNode | ComputedNode | EventNode): boolean {
		if ('getter' in node) {
			return updateComputed(node)
		}
		if ('seq' in node) {
			return updateEvent(node)
		}
		return updateSignal(node)
	},
	notify(effect: EffectNode) {
		let insertIndex = queuedLength
		let firstInsertedIndex = insertIndex

		do {
			queued[insertIndex++] = effect
			effect.flags &= ~ReactiveFlags.Watching
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- subs chain is always an EffectNode here
			effect = effect.subs?.sub as EffectNode
			// oxlint-disable-next-line typescript/no-unnecessary-condition -- cast from sub?: ReactiveNode can be undefined
			if (effect === undefined || !(effect.flags & ReactiveFlags.Watching)) {
				break
			}
			// oxlint-disable-next-line typescript/no-unnecessary-condition, no-constant-condition -- intentional infinite loop with break
		} while (true)

		queuedLength = insertIndex

		while (firstInsertedIndex < --insertIndex) {
			const left = queued[firstInsertedIndex]
			queued[firstInsertedIndex++] = queued[insertIndex]
			queued[insertIndex] = left
		}
	},
	unwatched(node) {
		if (!(node.flags & ReactiveFlags.Mutable)) {
			if ('fn' in node) {
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- discriminated by runtime 'fn' in node check
				const e = node as EffectNode
				if (e.cleanup !== undefined) {
					e.cleanup()
					e.cleanup = undefined
				}
			}
			effectScopeOper.call(node)
		} else if (node.depsTail !== undefined) {
			node.depsTail = undefined
			node.flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty
			purgeDeps(node)
		}
	},
})

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function setActiveSub(sub?: ReactiveNode) {
	const prevSub = activeSub
	activeSub = sub
	return prevSub
}

function updateSignal(s: SignalNode): boolean {
	s.flags = ReactiveFlags.Mutable
	return s.currentValue !== (s.currentValue = s.pendingValue)
}

function updateComputed(c: ComputedNode): boolean {
	++cycle
	c.depsTail = undefined
	c.flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck
	const prevSub = setActiveSub(c)
	try {
		const oldValue = c.value
		const newValue = c.getter(oldValue)
		if (c.equalsFn !== undefined && oldValue !== undefined && c.equalsFn(oldValue, newValue)) {
			return false
		}
		return oldValue !== (c.value = newValue)
	} finally {
		activeSub = prevSub
		c.flags &= ~ReactiveFlags.RecursedCheck
		purgeDeps(c)
	}
}

function updateEvent(e: EventNode): boolean {
	e.flags = ReactiveFlags.Mutable
	return true
}

function run(e: EffectNode): void {
	const flags = e.flags
	// oxlint-disable-next-line typescript/no-non-null-assertion -- deps is guaranteed present when Pending
	if (flags & ReactiveFlags.Dirty || (flags & ReactiveFlags.Pending && checkDirty(e.deps!, e))) {
		if (e.cleanup !== undefined) {
			e.cleanup()
			e.cleanup = undefined
		}
		++cycle
		e.depsTail = undefined
		e.flags = ReactiveFlags.Watching | ReactiveFlags.RecursedCheck
		const prevSub = setActiveSub(e)
		try {
			const result = e.fn()
			if (typeof result === 'function') {
				e.cleanup = result
			}
		} finally {
			activeSub = prevSub
			e.flags &= ~ReactiveFlags.RecursedCheck
			purgeDeps(e)
		}
	} else {
		e.flags = ReactiveFlags.Watching
	}
}

function flush(): void {
	try {
		while (notifyIndex < queuedLength) {
			// oxlint-disable-next-line typescript/no-non-null-assertion -- index < queuedLength guarantees non-undefined
			const effect = queued[notifyIndex]!
			queued[notifyIndex++] = undefined
			run(effect)
		}
	} finally {
		while (notifyIndex < queuedLength) {
			// oxlint-disable-next-line typescript/no-non-null-assertion -- index < queuedLength guarantees non-undefined
			const effect = queued[notifyIndex]!
			queued[notifyIndex++] = undefined
			effect.flags |= ReactiveFlags.Watching | ReactiveFlags.Recursed
		}
		notifyIndex = 0
		queuedLength = 0
	}
}

function purgeDeps(sub: ReactiveNode) {
	const depsTail = sub.depsTail
	let dep = depsTail !== undefined ? depsTail.nextDep : sub.deps
	while (dep !== undefined) {
		dep = unlink(dep, sub)
	}
}

// ---------------------------------------------------------------------------
// Oper functions (bound to nodes)
// ---------------------------------------------------------------------------

// Internal read/write oper for the raw SignalNode. Equality, propagation,
// auto-tracking. Higher-level concerns (readonly gate, set transform, lazy
// initial, get memoization) live in the `signal()` factory wrapper.
function signalOper<T>(this: SignalNode<T>, ...value: [T | undefined] | []): T | boolean {
	if (value.length) {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- caller's equalsFn is responsible for its own type contract
		const v = value[0] as T
		const current = this.pendingValue
		if (this.equalsFn !== undefined) {
			if (this.equalsFn(current, v)) return false
		} else {
			if (current === v) return false
		}
		this.pendingValue = v
		this.flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty
		const subs = this.subs
		if (subs !== undefined) {
			propagate(subs)
			if (!batchDepth) {
				flush()
			}
		}
		return true
	} else {
		if (this.flags & ReactiveFlags.Dirty) {
			if (updateSignal(this)) {
				const subs = this.subs
				if (subs !== undefined) {
					shallowPropagate(subs)
				}
			}
		}
		// Walk to the nearest subscriber with Mutable or Watching flags.
		// Needed when activeSub is a non-tracking scope node (e.g. effectScope with flags: None)
		// rather than a computed/effect. computedOper/eventReadOper can link directly because they
		// are only called inside reactive contexts that guarantee a valid subscriber, but signals
		// may be read in broader scopes.
		let sub = activeSub
		while (sub !== undefined) {
			if (sub.flags & (ReactiveFlags.Mutable | ReactiveFlags.Watching)) {
				link(this, sub, cycle)
				break
			}
			sub = sub.subs?.sub
		}
		return this.currentValue
	}
}

function computedOper<T>(this: ComputedNode<T>): T {
	const flags = this.flags
	// oxlint-disable-next-line typescript/no-non-null-assertion -- deps is guaranteed present when Pending
	const deps = this.deps!
	if (
		flags & ReactiveFlags.Dirty ||
		(flags & ReactiveFlags.Pending &&
			// oxlint-disable-next-line typescript/no-unnecessary-condition -- comma expr with false is intentional for side effect
			(checkDirty(deps, this) || ((this.flags = flags & ~ReactiveFlags.Pending), false)))
	) {
		if (updateComputed(this)) {
			const subs = this.subs
			if (subs !== undefined) {
				shallowPropagate(subs)
			}
		}
	} else if (!flags) {
		this.flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck
		const prevSub = setActiveSub(this)
		try {
			this.value = this.getter()
		} finally {
			activeSub = prevSub
			this.flags &= ~ReactiveFlags.RecursedCheck
		}
	}
	const sub = activeSub
	if (sub !== undefined) {
		link(this, sub, cycle)
	}
	// oxlint-disable-next-line typescript/no-non-null-assertion -- value is always set before read
	return this.value!
}

function eventReadOper<T>(this: EventNode<T>): T | undefined {
	if (this.flags & ReactiveFlags.Dirty) {
		updateEvent(this)
	}
	const sub = activeSub
	if (sub !== undefined) {
		link(this, sub, cycle)
	}
	return this.payload
}

function effectOper(this: EffectNode): void {
	if (this.cleanup !== undefined) {
		this.cleanup()
		this.cleanup = undefined
	}
	effectScopeOper.call(this)
}

function effectScopeOper(this: ReactiveNode): void {
	this.depsTail = undefined
	this.flags = ReactiveFlags.None
	purgeDeps(this)
	const sub = this.subs
	if (sub !== undefined) {
		unlink(sub)
	}
}

// ---------------------------------------------------------------------------
// Signal<T> — reactive state value
// ---------------------------------------------------------------------------

// `Signal<T>` is the base callable: read returns T, write accepts T | undefined
// and returns whether the stored value changed. `Signal<T, C>` augments the
// callable with named `Computed` views — one per key in `C` — derived from the
// signal via the `computed` option. `C` is the *value* record (e.g. `{isDark:
// boolean}`), not a record of getters; the getter shape is collapsed at the
// `signal()` overload boundary.
export type Signal<T, C extends Record<string, unknown> = {}> = {
	(): T
	(value: T | undefined): boolean
} & {readonly [K in keyof C]: Computed<C[K]>}

export type SignalValues<T> = {
	[K in keyof T]: T[K] extends Signal<infer V> | Computed<infer V> ? V : T[K]
}

const BOUND_SIGNAL_NAME = 'bound ' + signalOper.name
const BOUND_COMPUTED_NAME = 'bound ' + computedOper.name

export function isReactive(fn: unknown): fn is Signal<unknown> | Computed<unknown> {
	if (typeof fn !== 'function') return false
	const name = (fn as {name: string}).name
	return name === BOUND_SIGNAL_NAME || name === BOUND_COMPUTED_NAME
}

// `initial` and `default` both accept a value OR a lazy factory `() => T`. For
// T that is itself a function (e.g. `Slot`), the slot type is intentionally
// `never` — runtime cannot disambiguate "the value" from "a factory of the
// value" via `typeof`. For callable T, omit `initial`/`default` and write via
// the signal callable instead. `initial` and `default` are mutually exclusive
// at the type level; only one carries a non-undefined value at a time.
type Callable = (...args: any[]) => any
type InitialValue<T> = [T] extends [Callable] ? never : T | (() => T)

export interface SignalOptionsWithInitial<T> {
	initial: InitialValue<T>
	default?: undefined
	equals?: (a: T, b: T) => boolean
	readonly?: boolean
	get?: (value: T) => T
	set?: (next: T | undefined, previous: T) => T
}

export interface SignalOptionsWithoutInitial<T> {
	initial?: undefined
	default?: undefined
	equals?: (a: T | undefined, b: T | undefined) => boolean
	readonly?: boolean
	get?: (value: T | undefined) => T | undefined
	set?: (next: T | undefined, previous: T | undefined) => T | undefined
}

export interface SignalOptionsWithDefault<T> {
	default: InitialValue<T>
	initial?: undefined
	equals?: (a: T, b: T) => boolean
	readonly?: boolean
	get?: (value: T) => T
	set?: (next: T, previous: T) => T
}

export interface SignalOptionsWithInitialAndComputed<T, C> extends SignalOptionsWithInitial<T> {
	computed: (self: Signal<T>) => C
}

export interface SignalOptionsWithoutInitialAndComputed<T, C> extends SignalOptionsWithoutInitial<T> {
	computed: (self: Signal<T | undefined>) => C
}

export interface SignalOptionsWithDefaultAndComputed<T, C> extends SignalOptionsWithDefault<T> {
	computed: (self: Signal<T>) => C
}

export function signal<T, C extends Record<string, () => unknown>>(
	opts: SignalOptionsWithDefaultAndComputed<T, C>
): Signal<T, {[K in keyof C]: ReturnType<C[K]>}>
export function signal<T, C extends Record<string, () => unknown>>(
	opts: SignalOptionsWithInitialAndComputed<T, C>
): Signal<T, {[K in keyof C]: ReturnType<C[K]>}>
export function signal<T, C extends Record<string, () => unknown>>(
	opts: SignalOptionsWithoutInitialAndComputed<T, C>
): Signal<T | undefined, {[K in keyof C]: ReturnType<C[K]>}>
export function signal<T>(opts: SignalOptionsWithDefault<T>): Signal<T>
export function signal<T>(opts: SignalOptionsWithInitial<T>): Signal<T>
export function signal<T = never>(opts?: SignalOptionsWithoutInitial<T>): Signal<T | undefined>
export function signal(opts?: {
	initial?: unknown
	default?: unknown
	equals?: (a: unknown, b: unknown) => boolean
	readonly?: boolean
	get?: (value: unknown) => unknown
	set?: (next: unknown, previous: unknown) => unknown
	computed?: (self: Signal<unknown>) => Record<string, () => unknown>
}): Signal<unknown> {
	let initFn: (() => unknown) | undefined
	let seed: unknown
	let isDefaultBearing = false
	let cachedDefault: unknown

	if (opts !== undefined && 'default' in opts && opts.default !== undefined) {
		isDefaultBearing = true
		if (typeof opts.default === 'function') {
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- TS narrowing forbids factories when T is callable; at runtime any function in `default` is a factory
			initFn = opts.default as () => unknown
		} else {
			seed = opts.default
			cachedDefault = opts.default
		}
	} else if (opts !== undefined && 'initial' in opts && opts.initial !== undefined) {
		if (typeof opts.initial === 'function') {
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- TS narrowing forbids factories when T is callable; at runtime any function in `initial` is a factory
			initFn = opts.initial as () => unknown
		} else {
			seed = opts.initial
		}
	}

	const node: SignalNode<unknown> = {
		currentValue: seed,
		pendingValue: seed,
		equalsFn: opts?.equals,
		subs: undefined,
		subsTail: undefined,
		flags: ReactiveFlags.Mutable,
	}

	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- bound oper matches Signal<unknown> shape; TS can't verify the overloaded call signature
	const rawOper = (signalOper as (this: SignalNode<unknown>, ...value: [unknown] | []) => unknown).bind(
		node
	) as Signal<unknown>

	const realize = initFn
		? () => {
				if (initFn === undefined) return
				const fn = initFn
				initFn = undefined
				const v = untracked(fn)
				if (isDefaultBearing) cachedDefault = v
				node.currentValue = v
				node.pendingValue = v
			}
		: undefined

	const getFn = opts?.get
	const setFn = opts?.set
	const isReadonly = opts?.readonly === true

	// When `get` is provided, route reads through a private `computed` so that
	// external signals read inside `get` propagate to consumers (auto-tracking).
	const reader = getFn ? computed(() => getFn(rawOper())) : undefined

	const exposed = function boundSignalOper(...args: [unknown] | []): unknown {
		if (args.length === 0) {
			realize?.()
			return reader ? reader() : rawOper()
		}
		if (isReadonly && !mutableScope) return false
		realize?.()
		const next = args[0]
		if (isDefaultBearing && next === undefined) {
			return rawOper(cachedDefault)
		}
		const previous = node.pendingValue
		const committed = setFn ? setFn(next, previous) : next
		return rawOper(committed)
	}

	Object.defineProperty(exposed, 'name', {value: BOUND_SIGNAL_NAME})

	if (opts?.computed !== undefined) {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- exposed implements Signal<T> for whichever T the overloaded call resolved
		const getters = opts.computed(exposed as Signal<unknown>)
		const views: Record<string, Computed<unknown>> = {}
		for (const key of Object.keys(getters)) {
			views[key] = computed(getters[key])
		}
		Object.assign(exposed, views)
	}

	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- callable matches Signal<T> interface but TS can't verify the overloaded call signature
	return exposed as unknown as Signal<unknown>
}

// ---------------------------------------------------------------------------
// Computed<T> — derived reactive value
// ---------------------------------------------------------------------------

export interface Computed<T> {
	(): T
}

interface ComputedOptions<T> {
	equals?: (a: T, b: T) => boolean
}

export function computed<T>(opts: {
	get: (prev?: T) => T
	set: (next: T) => void
	equals?: (a: T, b: T) => boolean
}): Signal<T>
export function computed<T>(getter: (previousValue?: T) => T, opts?: ComputedOptions<T>): Computed<T>
export function computed<T>(
	getterOrOpts:
		| ((previousValue?: T) => T)
		| {
				get: (prev?: T) => T
				set: (next: T) => void
				equals?: (a: T, b: T) => boolean
		  },
	opts?: ComputedOptions<T>
): Signal<T> | Computed<T> {
	const isWritable = typeof getterOrOpts !== 'function'
	const node: ComputedNode<T> = {
		value: undefined,
		subs: undefined,
		subsTail: undefined,
		deps: undefined,
		depsTail: undefined,
		flags: ReactiveFlags.None,
		getter: isWritable ? getterOrOpts.get : getterOrOpts,
		equalsFn: (isWritable ? getterOrOpts.equals : opts?.equals) ?? undefined,
	}
	const readFn = (computedOper as (this: ComputedNode<T>) => T).bind(node)

	if (!isWritable) {
		return readFn
	}

	const writableComputed = function writableComputedOper(...args: [T | undefined] | []): T | boolean {
		if (args.length === 0) return readFn()
		const next = args[0]
		if (next === undefined) return false
		const prev = readFn()
		if (next === prev) return false
		getterOrOpts.set(next)
		return readFn() !== prev
	}
	Object.defineProperty(writableComputed, 'name', {value: BOUND_COMPUTED_NAME})

	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- callable matches Signal<T> interface but TS can't verify the overloaded call signature
	return writableComputed as unknown as Signal<T>
}

// ---------------------------------------------------------------------------
// Event<T> — unified reactive event primitive
// ---------------------------------------------------------------------------

export interface Event<T = void> {
	(payload: T): void
	read(): T | undefined
}

export function event<T = void>(): Event<T> {
	const node: EventNode<T> = {
		payload: undefined,
		seq: 0,
		subs: undefined,
		subsTail: undefined,
		flags: ReactiveFlags.Mutable,
	}

	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- callable matches Event<T> interface but TS can't verify the call signature
	const callable = function eventCallable(payload: T) {
		node.payload = payload
		node.seq++
		node.flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty
		const subs = node.subs
		if (subs !== undefined) {
			propagate(subs)
			// A fire is unconditionally a change for EVERY subscriber, so each one is marked
			// dirty in its own right. AFTER propagate, which skips a sub that is already
			// dirty. Without this the decision rides a single flag on the NODE, which
			// `eventReadOper` clears on the first read — so one subscriber reading the
			// payload silently cancelled every subscriber still queued behind it.
			for (let l: Link | undefined = subs; l !== undefined; l = l.nextSub) {
				l.sub.flags |= ReactiveFlags.Dirty
			}
			if (!batchDepth) {
				flush()
			}
		}
	} as unknown as Event<T>

	callable.read = (eventReadOper as (this: EventNode<T>) => T | undefined).bind(node)

	return callable
}

// ---------------------------------------------------------------------------
// effect() / effectScope()
// ---------------------------------------------------------------------------

export function effect(fn: () => void | (() => void)): () => void {
	const e: EffectNode = {
		fn,
		cleanup: undefined,
		subs: undefined,
		subsTail: undefined,
		deps: undefined,
		depsTail: undefined,
		flags: ReactiveFlags.Watching | ReactiveFlags.RecursedCheck,
	}
	const prevSub = setActiveSub(e)
	if (prevSub !== undefined) {
		link(e, prevSub, 0)
	}
	try {
		const result = e.fn()
		if (typeof result === 'function') {
			e.cleanup = result
		}
	} finally {
		activeSub = prevSub
		e.flags &= ~ReactiveFlags.RecursedCheck
	}
	return effectOper.bind(e)
}

export function effectScope(fn: () => void): () => void {
	const e: ReactiveNode = {
		deps: undefined,
		depsTail: undefined,
		subs: undefined,
		subsTail: undefined,
		flags: ReactiveFlags.None,
	}
	const prevSub = setActiveSub(e)
	if (prevSub !== undefined) {
		link(e, prevSub, 0)
	}
	try {
		fn()
	} finally {
		activeSub = prevSub
	}
	return effectScopeOper.bind(e)
}

// ---------------------------------------------------------------------------
// watch() — skip-first-run helper for event subscriptions
// ---------------------------------------------------------------------------

interface WatchOptions {
	immediate?: boolean
}

export function watch<T>(
	dep: Signal<T>,
	fn: (newValue: T, oldValue: T | undefined) => void,
	opts?: WatchOptions
): () => void
export function watch<T>(
	dep: Event<T>,
	fn: (newValue: T, oldValue: T | undefined) => void,
	opts?: WatchOptions
): () => void
export function watch<T>(
	dep: () => T,
	fn: (newValue: T, oldValue: T | undefined) => void,
	opts?: WatchOptions
): () => void
export function watch<T>(
	dep: Signal<T> | Event<T> | (() => T),
	fn: (newValue: T, oldValue: T | undefined) => void,
	opts?: WatchOptions
): () => void {
	let initialized = false
	let oldValue: T | undefined
	return effect(() => {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Event<T> returns T | undefined before first emit; callers using watch() with Event must accept that the first immediate call may pass undefined when the event has not yet emitted
		const newValue = ('read' in dep ? dep.read() : dep()) as T
		if (!initialized) {
			initialized = true
			oldValue = newValue
			if (opts?.immediate) {
				untracked(() => fn(newValue, undefined))
			}
			return
		}
		const prev = oldValue
		oldValue = newValue
		untracked(() => fn(newValue, prev))
	})
}

// ---------------------------------------------------------------------------
// batch() — defer effect flush until callback completes
// ---------------------------------------------------------------------------

interface BatchOptions {
	mutable?: boolean
}

export function batch(fn: () => void, opts?: BatchOptions): void {
	const prevMutable = mutableScope
	if (opts?.mutable) mutableScope = true
	++batchDepth
	try {
		fn()
	} finally {
		// Restore BEFORE the flush, on both counts. `flush()` runs user code and can throw —
		// after it, the restore is not guaranteed to run at all, and `mutableScope` is module
		// state, so one throw would leave every readonly signal in the process writable. And the
		// window is meant to cover the caller's own writes, not the cascade they trigger: a
		// watcher writing a prop back is the mirrored state `readonly` exists to refuse.
		mutableScope = prevMutable
		if (!--batchDepth) {
			flush()
		}
	}
}

// ---------------------------------------------------------------------------
// untracked() — run a function without tracking reactive dependencies
// ---------------------------------------------------------------------------

export function untracked<T>(fn: () => T): T {
	const prev = setActiveSub(undefined)
	try {
		return fn()
	} finally {
		setActiveSub(prev)
	}
}

// ---------------------------------------------------------------------------
// listen() — scope-aware DOM event listener
// ---------------------------------------------------------------------------

export function listen<K extends keyof WindowEventMap>(
	target: Window,
	event: K,
	handler: (e: WindowEventMap[K]) => void,
	options?: boolean | AddEventListenerOptions
): () => void
export function listen<K extends keyof DocumentEventMap>(
	target: Document,
	event: K,
	handler: (e: DocumentEventMap[K]) => void,
	options?: boolean | AddEventListenerOptions
): () => void
export function listen<K extends keyof HTMLElementEventMap>(
	target: HTMLElement,
	event: K,
	handler: (e: HTMLElementEventMap[K]) => void,
	options?: boolean | AddEventListenerOptions
): () => void
export function listen(
	target: EventTarget,
	event: string,
	handler: EventListenerOrEventListenerObject,
	options?: boolean | AddEventListenerOptions
): () => void
export function listen(
	target: EventTarget,
	event: string,
	handler: EventListenerOrEventListenerObject,
	options?: boolean | AddEventListenerOptions
): () => void {
	return effect(() => {
		target.addEventListener(event, handler, options)
		return () => target.removeEventListener(event, handler, options)
	})
}