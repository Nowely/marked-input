import {describe, it, expect} from 'vitest'

import {Store} from '../../../store/Store'

/**
 * The `readOnly` half of the EDITABLE POLICY — `SelectionDriver`'s
 * `watch(deps.readOnly, …)` → `#applyEditablePolicy` → `TokenModel.setEditable`, driven
 * from a props change rather than called directly. Its only gate.
 *
 * What used to sit here besides it, and why it went (each verified against both sides):
 * - "contentEditable=true after initial render" — asserted at three layers already:
 *   `SelectionDriver.spec.ts`'s policy case below mounts this exact fixture and opens with
 *   the same expectation, `commitPipeline.spec.ts`'s cold start asserts it on a bound
 *   surface, and `bind.spec.ts`'s "applies contentEditable to newly bound text surfaces"
 *   asserts it against the flag that decides it.
 * - "flips … while selecting" — line for line `SelectionDriver.spec.ts`'s
 *   'flips structural text surfaces non-editable while user is selecting', down to the
 *   fixture.
 *
 * The file itself is a leftover: it is named after the S2.7-deleted reconciliation
 * mechanism, and the case below belongs in `SelectionDriver.spec.ts`'s editable-policy
 * describe, next to the `isUserSelecting` half of the same watch pair.
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
	it('flips text surfaces to contentEditable=false when readOnly', () => {
		const {store, span, container} = mount('hello')

		store.props.set({readOnly: true})
		expect(span.contentEditable).toBe('false')

		store.props.set({readOnly: false})
		expect(span.contentEditable).toBe('true')
		container.remove()
	})
})