import {describe, expect, it, vi} from 'vitest'

/**
 * KNOWN DEFECT, PINNED RED. Every case here is `it.fails`: it states the behavior the signals
 * module owes and records that today it does the opposite. `batch()` restores `mutableScope`
 * AFTER `flush()`, so a watcher that throws while the batch drains skips the restore and leaves
 * the flag `true` for the rest of the PROCESS — from then on every readonly signal in the module
 * accepts writes.
 *
 * When the primitive is fixed, drop the `.fails` — vitest reports a passing `it.fails` as a
 * failure, so the fix cannot land without touching this file.
 *
 * Each case takes a FRESH module graph: `mutableScope` is module-level state and the leak is
 * unrecoverable inside one instance (second case), so a leaked instance would poison the rest.
 */
async function freshSignals() {
	vi.resetModules()
	return await import('./signal')
}

async function freshStore() {
	vi.resetModules()
	return (await import('../../store/Store')).Store
}

function mount(store: {host: {container: (el: HTMLElement) => unknown}}) {
	const container = document.createElement('div')
	document.body.append(container)
	store.host.container(container)
	return container
}

describe('batch({mutable: true}) when the flush throws', () => {
	it.fails('leaves readonly signals writable for the rest of the module', async () => {
		const {batch, effect, signal} = await freshSignals()

		const trigger = signal<number>({initial: 0, readonly: true})
		const unrelated = signal<number>({initial: 1, readonly: true})

		effect(() => {
			if (trigger() > 0) throw new Error('watcher blew up during the flush')
		})

		expect(() => batch(() => void trigger(1), {mutable: true})).toThrow('watcher blew up during the flush')

		// The batch is over. A readonly signal must refuse this write.
		expect(unrelated(99)).toBe(false)
		expect(unrelated()).toBe(1)
	})

	it.fails('is recoverable by a later well-behaved batch', async () => {
		const {batch, effect, signal} = await freshSignals()

		const trigger = signal<number>({initial: 0, readonly: true})
		const unrelated = signal<number>({initial: 1, readonly: true})

		effect(() => {
			if (trigger() > 0) throw new Error('boom')
		})

		expect(() => batch(() => void trigger(1), {mutable: true})).toThrow('boom')

		// Nothing can clear the flag: every later batch reads the already-true value as its own
		// `prevMutable` and faithfully restores it.
		batch(() => {})
		batch(() => {}, {mutable: true})

		expect(unrelated(99)).toBe(false)
	})

	it.fails('survives a throwing effect cleanup', async () => {
		const {batch, effect, signal} = await freshSignals()

		const gate = signal<boolean>({initial: true, readonly: true})
		const unrelated = signal<number>({initial: 1, readonly: true})

		effect(() => {
			if (!gate()) return
			// Re-running the outer effect unlinks the inner one, and `run`'s own finally calls
			// its cleanup — so the throw leaves the flush through a door no caller can guard.
			effect(() => () => {
				throw new Error('cleanup blew up')
			})
		})

		expect(() => batch(() => void gate(false), {mutable: true})).toThrow('cleanup blew up')

		expect(unrelated(99)).toBe(false)
	})

	it.fails('survives a block editor given an empty separator', async () => {
		const Store = await freshStore()

		const store = new Store()
		store.props.set({
			defaultValue: 'a\n\nb',
			layout: 'block',
			options: [{markup: '@[__value__](__meta__)'}],
		})
		mount(store)

		// `<MarkedInput layout="block" separator="" />`: the adapter's per-render `props.set` is
		// the mutable batch, and `Parser.parseRows` throws out of the props watch it drains.
		expect(() => store.props.set({layout: 'block', separator: ''})).toThrow(
			'Parser.parseRows: separator must be non-empty'
		)

		// Outside any batch, so this write to a readonly prop must be refused.
		store.props.readOnly(true)
		expect(store.props.readOnly()).toBe(false)
	})

	it.fails('survives an invalid markup pattern', async () => {
		const Store = await freshStore()

		const store = new Store()
		store.props.set({defaultValue: 'hello', Mark: () => null, options: [{markup: '@[__value__]'}]})
		mount(store)

		// A leading placeholder is rejected by MarkupDescriptor, and the parser is rebuilt by the
		// same props watch — so a typo'd `markup` prop reaches the flush too.
		expect(() => store.props.set({Mark: () => null, options: [{markup: '__value__ says'}]})).toThrow(
			'Invalid markup'
		)

		store.props.readOnly(true)
		expect(store.props.readOnly()).toBe(false)
	})
})