import {describe, it, expect} from 'vitest'

import type {CoreOption} from '../../shared/types'
import {Store} from '../../store/Store'

import styles from '../../../styles.module.css'

describe('SlotsFeature', () => {
	it('does not own DOM refs', () => {
		const store = new Store()
		expect('container' in store.slots).toBe(false)
	})

	it('defaults container props to the core class alone', () => {
		const store = new Store()
		expect(store.slots.containerProps()).toEqual({className: styles.Container, style: undefined})
	})

	it('keeps the node resolver stable when a re-render hands over the same options in a fresh array', () => {
		// `node` ALLOCATES — it returns a closure — so its identity is what an adapter's selector
		// compares, and a change re-renders every Token. `props.options` is written on every
		// parent render (Vue's syncProps writes unconditionally; React hands over whatever the
		// prop holds), so without an equality on the signal a parent that memoised its option
		// OBJECTS but let the ARRAY be fresh churned the resolver on every keystroke.
		//
		// Element identity, matching `props.style`'s treatment. It does NOT cover an inline
		// `options={[{markup: '…'}]}`, where the objects themselves are fresh — the docs' own
		// ❌ example, and what `TokenModel.#markups` defends the parser against separately.
		const store = new Store()
		const option: CoreOption = {markup: '@[__value__]'}

		store.props.set({options: [option]})
		const first = store.slots.node()

		store.props.set({options: [option]})

		expect(store.slots.node()).toBe(first)
	})
})