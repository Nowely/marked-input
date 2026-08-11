import {describe, it, expect} from 'vitest'

import {Store} from '../../../store/Store'

function mount(value: string) {
	const store = new Store()
	store.props.set({defaultValue: value})
	const container = document.createElement('div')
	const span = document.createElement('span')
	span.appendChild(document.createTextNode(value))
	container.appendChild(span)
	document.body.appendChild(container)
	store.host.container(container)
	store.host.rendered()
	return {store, container, span}
}

describe('text surface reconciliation', () => {
	it('makes text surfaces contentEditable=true after initial render', () => {
		const {span, container} = mount('hello')
		expect(span.contentEditable).toBe('true')
		container.remove()
	})

	it('flips text surfaces to contentEditable=false while selecting', () => {
		const {store, span, container} = mount('hello')

		store.tokens.isUserSelecting(true)
		expect(span.contentEditable).toBe('false')

		store.tokens.isUserSelecting(false)
		expect(span.contentEditable).toBe('true')
		container.remove()
	})

	it('flips text surfaces to contentEditable=false when readOnly', () => {
		const {store, span, container} = mount('hello')

		store.props.set({readOnly: true})
		expect(span.contentEditable).toBe('false')

		store.props.set({readOnly: false})
		expect(span.contentEditable).toBe('true')
		container.remove()
	})
})