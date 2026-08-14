import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'

import styles from '../../../styles.module.css'

describe('SlotsFeature', () => {
	it('does not own DOM refs', () => {
		const store = new Store()
		expect('container' in store.slots).toBe(false)
	})

	it('defaults container props to the core class alone, and block props to undefined', () => {
		const store = new Store()
		expect(store.slots.containerProps()).toEqual({className: styles.Container, style: undefined})
		expect(store.slots.blockProps()).toBeUndefined()
	})
})