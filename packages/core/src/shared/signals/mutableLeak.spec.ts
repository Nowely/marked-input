import {describe, expect, it, vi} from 'vitest'

/**
 * `mutableScope` is module state, so a batch that fails to restore it disables the readonly gate
 * for the rest of the PROCESS — no later batch can clear it, since each one reads the leaked
 * `true` as its own `prevMutable` and restores it faithfully. `batch()` therefore restores the
 * flag BEFORE draining, where no user code can skip the restore.
 *
 * Each case takes a FRESH module graph, because a regression here poisons every test after it
 * rather than failing in place.
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
	it('leaves every readonly signal in the module still refusing writes', async () => {
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

	it('keeps the gate closed across every later batch', async () => {
		const {batch, effect, signal} = await freshSignals()

		const trigger = signal<number>({initial: 0, readonly: true})
		const unrelated = signal<number>({initial: 1, readonly: true})

		effect(() => {
			if (trigger() > 0) throw new Error('boom')
		})

		expect(() => batch(() => void trigger(1), {mutable: true})).toThrow('boom')

		// A leak would be permanent: every later batch reads the leaked `true` as its own
		// `prevMutable` and faithfully restores it, so neither of these can undo it.
		batch(() => {})
		batch(() => {}, {mutable: true})

		expect(unrelated(99)).toBe(false)
	})

	it('survives a throwing effect cleanup', async () => {
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

	it('survives a block editor given an empty separator', async () => {
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

	it('survives an invalid markup pattern', async () => {
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