import {describe, expect, it, vi} from 'vitest'

import {watch} from '../../../shared/signals/index.js'
import {Store} from '../../../store/Store'
import {anchorsAt, consignRendered} from '../__testing__/mountFixtures'

/**
 * WHEN the bind effect runs, counted exactly — because "at least one" would pass under either of
 * the shapes this replaced.
 *
 * IT DOES NOT GATE THE `untracked` BOUNDARIES, and that is recorded here rather than implied.
 * Mutation-tested both ways: removing the effect's own `untracked`, and removing the one `bind`
 * wraps its walk in, each leaves all five cases green. The reason is structural — the only node
 * signals the walk reads are `children()` (written by adoption, and only inside a commit, which
 * wakes the effect anyway) and `text()` (read inside the per-surface effect `bindElements` arms,
 * which is its own subscriber). So no reachable write can wake the outer effect through a node,
 * and no honest test can prove that it cannot. The two `untracked`s stay as correct-by-
 * construction boundaries, not as behaviour anything here pins.
 *
 * What these cases DO pin is the arithmetic the shape rests on: one bind per commit, one rebind
 * per ref, and no commit behind a ref.
 */
function mounted(value = 'he@[x]llo') {
	const store = new Store()
	store.props.set({defaultValue: value, options: [{markup: '@[__value__]'}], Mark: () => null})
	const container = document.createElement('div')
	const text1 = document.createElement('span')
	const mark = document.createElement('span')
	mark.append(document.createTextNode('x'))
	const text2 = document.createElement('span')
	container.append(text1, mark, text2)
	document.body.append(container)
	store.host.container(container)
	consignRendered(store, container)
	return {store, container, text1, mark, text2}
}

describe('the bind effect', () => {
	it('runs once per commit, and a text edit is one commit', () => {
		const {store} = mounted()
		const bound = vi.fn()
		watch(store.tokens.bound, bound)

		store.edit.replace(...anchorsAt(store, 9, 9), '!')

		// ONE. Not zero — every commit binds, which is what makes `bound` a clock the caret can
		// trust — and not two, which is what a second subscription (the live roots, say) would
		// cost: adoption's batch closes before `apply` bumps the counter, so the two writes
		// flush separately.
		expect(bound).toHaveBeenCalledTimes(1)
	})

	it('a direct node write is not a commit, and binds nothing', () => {
		// `text()` is written by the per-surface effect's own subscriber, not by anything the
		// outer effect reads, so a direct write moves the model without touching either clock.
		const {store} = mounted()
		const node = store.tokens.nodes()[0]
		if (node.kind !== 'text') throw new Error('expected a text root')
		const bound = vi.fn()
		const committed = vi.fn()
		watch(store.tokens.bound, bound)
		watch(store.tokens.committed, committed)

		node.text('HE')

		expect(bound).not.toHaveBeenCalled()
		expect(committed).not.toHaveBeenCalled()
	})

	it('reading a mark binds nothing', () => {
		// Reads are reads. Stated because `children()` IS what the walk flattens, so this is the
		// signal family a leaked subscription would show up in first.
		const {store} = mounted()
		const mark = store.tokens.nodes()[1]
		if (mark.kind !== 'mark') throw new Error('expected a mark root')
		const bound = vi.fn()
		watch(store.tokens.bound, bound)

		mark.value()
		mark.children()

		expect(bound).not.toHaveBeenCalled()
	})

	it('binds once per commit across a burst, not once per node touched', () => {
		const {store} = mounted()
		const bound = vi.fn()
		watch(store.tokens.bound, bound)

		store.edit.replace(...anchorsAt(store, 9, 9), '!')
		store.edit.replace(...anchorsAt(store, 10, 10), '!')
		store.edit.replace(...anchorsAt(store, 11, 11), '!')

		expect(bound).toHaveBeenCalledTimes(3)
	})

	it('a ref binds its own token WITHOUT going through the effect', () => {
		// The other half of the shape: a registration does not touch anything the effect reads,
		// so N refs cost N single-id rebinds and zero whole-tree walks. That is what keeps a
		// mount linear, and it is why the effect can afford to be this coarse.
		const {store, container} = mounted()
		const bound = vi.fn()
		watch(store.tokens.bound, bound)

		consignRendered(store, container)

		// Three roots re-consigned, three pulses — and no commit behind any of them.
		expect(bound).toHaveBeenCalledTimes(3)
	})
})