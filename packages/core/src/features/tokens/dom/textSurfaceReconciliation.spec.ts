import {describe, it, expect} from 'vitest'

import {Store} from '../../../store/Store'

/**
 * The `readOnly` half of the per-surface EDITABLE POLICY — `SelectionDriver`'s
 * `watch(deps.readOnly, …)` → `#applyEditablePolicy` → `TokenModel.setEditable`, driven
 * from a props change rather than called directly.
 *
 * Under the one-host topology a text surface carries no contenteditable attribute at all
 * and readOnly lives on the container, so the mechanism this file gates is scheduled for
 * deletion — the case below is `todo` until it goes, and the file goes with it.
 */
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

describe('readOnly → contentEditable', () => {
	// Mechanism deleted in the host flip; spec dies with it.
	it.todo('flips text surfaces to contentEditable=false when readOnly', () => {
		const {store, span, container} = mount('hello')

		store.props.set({readOnly: true})
		expect(span.contentEditable).toBe('false')

		store.props.set({readOnly: false})
		expect(span.contentEditable).toBe('true')
		container.remove()
	})
})