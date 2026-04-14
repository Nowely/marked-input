// oxlint-disable typescript/no-explicit-any -- reactive node interfaces need flexible generic defaults
import {createReactiveSystem, ReactiveFlags, type ReactiveNode} from './alien-signals/system'

// ---------------------------------------------------------------------------
// Node types
// ---------------------------------------------------------------------------

interface SignalNode<T = any> extends ReactiveNode {
	currentValue: T
	pendingValue: T
	defaultValue: T | undefined
	hasDefault: boolean
	equalsFn: ((a: T, b: T) => boolean) | undefined
	isReadonly: boolean
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
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- discriminated by runtime property check
			return updateComputed(node)
		}
		if ('seq' in node) {
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- discriminated by runtime property check
			return updateEvent(node)
		}
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- discriminated by runtime property check
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
			// oxlint-disable-next-line typescript/no-unnecessary-condition -- intentional infinite loop with break
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
				e.cleanup = result as () => void
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

function signalOper<T>(this: SignalNode<T>, ...value: [T | undefined] | []): T | void {
	if (value.length) {
		if (this.isReadonly && !mutableScope) return
		const v = value[0]
		if (v === undefined) {
			if (this.hasDefault) {
				if (this.pendingValue === undefined || this.pendingValue === this.defaultValue) return
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- undefined is valid for T when reverting to default
				this.pendingValue = undefined as T
			} else {
				if (this.pendingValue === undefined) return
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- undefined is valid for T when clearing value
				this.pendingValue = undefined as T
			}
		} else {
			const current = this.pendingValue
			const effectiveCurrent = current === undefined && this.hasDefault ? this.defaultValue : current
			if (this.equalsFn !== undefined) {
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- effectiveCurrent is T when equalsFn is defined and either current !== undefined or hasDefault
				if (this.equalsFn(effectiveCurrent as T, v)) return
			} else {
				if (effectiveCurrent === v) return
			}
			this.pendingValue = v
		}
		this.flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty
		const subs = this.subs
		if (subs !== undefined) {
			propagate(subs)
			if (!batchDepth) {
				flush()
			}
		}
	} else {
		if (this.flags & ReactiveFlags.Dirty) {
			if (updateSignal(this)) {
				const subs = this.subs
				if (subs !== undefined) {
					shallowPropagate(subs)
				}
			}
		}
		// Walk past intermediate computed nodes to find the actual effect/watcher subscriber.
		// Unlike computedOper/eventReadOper, signals can be read inside a computed getter where
		// activeSub is a ComputedNode (no Mutable|Watching flags). The walk skips these
		// intermediaries to link directly to the EffectNode/WatcherNode that needs notification.
		let sub = activeSub
		while (sub !== undefined) {
			if (sub.flags & (ReactiveFlags.Mutable | ReactiveFlags.Watching)) {
				link(this, sub, cycle)
				break
			}
			sub = sub.subs?.sub
		}
		const v = this.currentValue
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- defaultValue is T when hasDefault is true
		if (v === undefined && this.hasDefault) return this.defaultValue as T
		return v
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

export interface Signal<T> {
	(): T
	(value: T | undefined): void
}

export type SignalValues<T> = {
	[K in keyof T]: T[K] extends Signal<infer V> | Computed<infer V> ? V : T[K]
}

export function isReactive(fn: unknown): fn is Signal<unknown> | Computed<unknown> {
	if (typeof fn !== 'function') return false
	const name = (fn as {name: string}).name
	return name === 'bound ' + signalOper.name || name === 'bound ' + computedOper.name
}

interface SignalOptions<T> {
	equals?: (a: T, b: T) => boolean
	readonly?: boolean
}

export function signal<T>(initial: T, opts?: SignalOptions<T>): Signal<T> {
	const node: SignalNode<T> = {
		currentValue: initial,
		pendingValue: initial,
		defaultValue: initial ?? undefined,
		hasDefault: initial !== undefined,
		equalsFn: opts?.equals ?? undefined,
		isReadonly: !!opts?.readonly,
		subs: undefined,
		subsTail: undefined,
		flags: ReactiveFlags.Mutable,
	}
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- callable matches Signal<T> interface but TS can't verify the overloaded call signature
	return (signalOper as (this: SignalNode<T>, ...value: [T | undefined] | []) => T | void).bind(
		node
	) as unknown as Signal<T>
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

export function computed<T>(getter: (previousValue?: T) => T, opts?: ComputedOptions<T>): Computed<T> {
	const node: ComputedNode<T> = {
		value: undefined,
		subs: undefined,
		subsTail: undefined,
		deps: undefined,
		depsTail: undefined,
		flags: ReactiveFlags.None,
		getter: getter as (previousValue?: T) => T,
		equalsFn: opts?.equals ?? undefined,
	}
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- callable matches Computed<T> interface but TS can't verify the call signature
	return (computedOper as (this: ComputedNode<T>) => T).bind(node) as unknown as Computed<T>
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

export {alienEffect as effect}

function alienEffect(fn: () => void | (() => void)): () => void {
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
			e.cleanup = result as () => void
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

export function watch<T>(dep: Signal<T>, fn: (newValue: T, oldValue: T | undefined) => void): () => void
export function watch<T>(dep: Event<T>, fn: (newValue: T, oldValue: T | undefined) => void): () => void
export function watch<T>(dep: () => T, fn: (newValue: T, oldValue: T | undefined) => void): () => void
export function watch<T>(
	dep: Signal<T> | Event<T> | (() => T),
	fn: (newValue: T, oldValue: T | undefined) => void
): () => void {
	let initialized = false
	let oldValue: T | undefined
	return alienEffect(() => {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Event<T> returns T | undefined before first emit, but watch skips the first run so callback always receives T
		const newValue = ('read' in dep ? dep.read() : dep()) as T
		if (!initialized) {
			initialized = true
			oldValue = newValue
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
		if (!--batchDepth) {
			flush()
		}
		mutableScope = prevMutable
	}
}

// ---------------------------------------------------------------------------
// trigger() — re-run code that reads signals and propagate the result
// ---------------------------------------------------------------------------

export function trigger(fn: () => void) {
	const sub: ReactiveNode = {
		deps: undefined,
		depsTail: undefined,
		flags: ReactiveFlags.Watching,
	}
	const prevSub = setActiveSub(sub)
	try {
		fn()
	} finally {
		activeSub = prevSub
		let dep = sub.deps
		while (dep !== undefined) {
			const subs = dep.dep.subs
			dep = unlink(dep, sub)
			if (subs !== undefined) {
				sub.flags = ReactiveFlags.None
				propagate(subs)
				shallowPropagate(subs)
			}
		}
		if (!batchDepth) {
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
	return alienEffect(() => {
		target.addEventListener(event, handler, options)
		return () => target.removeEventListener(event, handler, options)
	})
}