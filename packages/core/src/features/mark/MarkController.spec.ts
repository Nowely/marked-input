import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'
import type {Markup} from '../parsing'
import {MarkController} from './MarkController'

function setup(value = 'hello @[world]', markup: Markup = '@[__value__]') {
	const store = new Store()
	store.props.set({defaultValue: value, Mark: () => null, options: [{markup}]})
	store.lifecycle.mounted()
	const token = store.parsing.tokens().find(t => t.type === 'mark')
	if (!token) throw new Error('expected parsed mark token')
	const controller = MarkController.fromToken(store, token)
	return {store, token, controller}
}

describe('MarkController', () => {
	it('exposes readonly snapshot fields', () => {
		const {controller} = setup()

		expect(controller.value).toBe('world')
		expect(controller.meta).toBeUndefined()
		expect(controller.slot).toBeUndefined()
		expect(controller.readOnly).toBe(false)
	})

	it('removes a mark through the value pipeline', () => {
		const {store, controller} = setup()

		controller.remove()

		expect(store.value.current()).toBe('hello ')
	})

	it('updates mark value through descriptor serialization', () => {
		const {store, controller} = setup()

		controller.update({value: 'markput'})

		expect(store.value.current()).toBe('hello @[markput]')
	})

	it('clears metadata without leaking placeholder text', () => {
		const {store, controller} = setup('hello @[world](meta)', '@[__value__](__meta__)')

		controller.update({meta: {kind: 'clear'}})

		expect(store.value.current()).toBe('hello @[world]()')
		expect(store.value.current()).not.toContain('__meta__')
	})

	it('clears slot content without leaking placeholder text', () => {
		const {store, controller} = setup('#[nested]', '#[__slot__]')

		controller.update({slot: {kind: 'clear'}})

		expect(store.value.current()).not.toContain('__slot__')
	})

	it('fails closed when address is stale', () => {
		const {store, controller} = setup()
		store.value.replaceAll('different @[token]')

		controller.update({value: 'bad'})
		expect(store.value.current()).toBe('different @[token]')
	})

	it('does not mutate in read-only mode', () => {
		const {store, controller} = setup()
		store.props.set({readOnly: true})

		controller.remove()
		expect(store.value.current()).toBe('hello @[world]')
	})
})