import {describe, expect, it, vi} from 'vitest'

/**
 * `mutableScope` is module state, so a batch that fails to restore it disables the readonly gate
 * for the rest of the PROCESS — no later batch can clear it, since each one reads the leaked
 * `true` as its own `prevMutable` and restores it faithfully. `batch()` therefore restores the
 * flag BEFORE draining, where no user code can skip the restore.
 *
 * The cases do NOT get a module graph each: this project runs in browser mode, where
 * `vi.resetModules()` cannot clear the ESM registry, so every case here shares one `signal.ts`
 * and one `mutableScope`. That is safe only because every assertion is "the readonly write must
 * be refused" — a leak carried out of one case can make a later one pass for the wrong reason,
 * never fail for the wrong reason. The imports stay dynamic so this file works unchanged if the
 * project ever runs where resetting DOES isolate.
 */
async function freshSignals() {
	vi.resetModules()
	return await import('./signal')
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

	// TWO REACHABILITY CASES STOOD HERE and are gone with their vehicle. They drove the leak from
	// a real editor — `<MarkedInput layout="block" separator="" />` and a typo'd `markup` — because
	// both prop values threw out of the props watch `props.set` drains. Neither throws any more:
	// the props boundary reports the value and treats it as absent (`shared/reportBadProp`), so
	// neither can reach the flush at all. They were the only consumer-reachable routes into this
	// leak anyone had found; the mechanism keeps its pins above, with throwers of their own.
})