import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'
import type {Markup} from '../parsing'
import {MarkController} from './MarkController'

function setup(value = 'hello @[world]', markup: Markup = '@[__value__]') {
	const store = new Store()
	store.props.set({defaultValue: value, Mark: () => null, options: [{markup}]})
	store.value.enable()
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

		const result = controller.remove()

		expect(result).toEqual({ok: true, accepted: 'immediate', value: 'hello '})
		expect(store.value.current()).toBe('hello ')
	})

	it('updates mark value through descriptor serialization', () => {
		const {store, controller} = setup()

		const result = controller.update({value: 'markput'})

		expect(result).toEqual({ok: true, accepted: 'immediate', value: 'hello @[markput]'})
		expect(store.value.current()).toBe('hello @[markput]')
	})

	it('clears metadata without leaking placeholder text', () => {
		const {store, controller} = setup('hello @[world](meta)', '@[__value__](__meta__)')

		const result = controller.update({meta: {kind: 'clear'}})

		expect(result).toEqual({ok: true, accepted: 'immediate', value: 'hello @[world]()'})
		expect(store.value.current()).toBe('hello @[world]()')
		expect(store.value.current()).not.toContain('__meta__')
	})

	it('clears slot content without leaking placeholder text', () => {
		const {store, controller} = setup('#[nested]', '#[__slot__]')

		const result = controller.update({slot: {kind: 'clear'}})

		expect(result).toEqual({ok: true, accepted: 'immediate', value: '#[]'})
		expect(store.value.current()).not.toContain('__slot__')
	})

	it('fails closed when address is stale', () => {
		const {store, controller} = setup()
		store.value.replaceAll('different @[token]')

		expect(controller.update({value: 'bad'})).toEqual({ok: false, reason: 'stale'})
	})

	it('does not mutate in read-only mode', () => {
		const {store, controller} = setup()
		store.props.set({readOnly: true})

		expect(controller.remove()).toEqual({ok: false, reason: 'readOnly'})
		expect(store.value.current()).toBe('hello @[world]')
	})
})