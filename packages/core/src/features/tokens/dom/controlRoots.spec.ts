import {describe, expect, it} from 'vitest'

import {createControlRoots} from './controlRoots'

/** container > wrapper > control, plus a sibling that belongs to no control. */
function scene() {
	const container = document.createElement('div')
	const wrapper = document.createElement('div')
	const control = document.createElement('button')
	const tokenEl = document.createElement('span')
	wrapper.append(control)
	container.append(wrapper, tokenEl)
	return {container, wrapper, control, tokenEl}
}

describe('control roots', () => {
	it('marks a control and its ancestors up to but not including the container', () => {
		// Ported from `bind.spec.ts`, where this was a property of the whole-tree walk's result.
		// It never needed the tree: it is a walk from each control up to the editing host.
		const {container, wrapper, control, tokenEl} = scene()
		const roots = createControlRoots(() => container)

		roots.add(control)

		expect(roots.has(control)).toBe(true)
		expect(roots.has(wrapper)).toBe(true)
		expect(roots.has(tokenEl)).toBe(false)
		// The container is the editing host. Marking it would make every element in the document
		// answer 'control', which is the failure this stop condition exists to prevent.
		expect(roots.has(container)).toBe(false)
	})

	it('registers with no container and marks nothing until one arrives', () => {
		// A control can register before the container attaches — the adapters' refs fire
		// bottom-up — and the walk has no stop condition until then.
		const {container, wrapper, control} = scene()
		let host: HTMLElement | null = null
		const roots = createControlRoots(() => host)

		roots.add(control)
		expect(roots.has(control)).toBe(false)

		host = container
		roots.rebuild()

		expect(roots.has(control)).toBe(true)
		expect(roots.has(wrapper)).toBe(true)
	})

	it('REBUILDS on removal, so a shared ancestor survives its sibling leaving', () => {
		// The reason removal is a rebuild and not a subtraction: an ancestor chain is a union, so
		// the elements one control contributed cannot be told from the ones it shared.
		const {container, wrapper, control} = scene()
		const second = document.createElement('button')
		wrapper.append(second)
		const roots = createControlRoots(() => container)
		roots.add(control)
		roots.add(second)

		roots.remove(second)

		expect(roots.has(second)).toBe(false)
		expect(roots.has(control)).toBe(true)
		expect(roots.has(wrapper)).toBe(true)
	})

	it('drops every chain when the last control leaves', () => {
		const {container, wrapper, control} = scene()
		const roots = createControlRoots(() => container)
		roots.add(control)

		roots.remove(control)

		expect(roots.has(control)).toBe(false)
		expect(roots.has(wrapper)).toBe(false)
	})

	it('re-marks against the NEW host after a container swap', () => {
		// A chain marked against the previous host is stale in both directions: it may stop short,
		// and it may have marked elements that are no longer under the editing host at all.
		const first = scene()
		let host = first.container
		const roots = createControlRoots(() => host)
		roots.add(first.control)

		const next = document.createElement('div')
		next.append(first.wrapper)
		host = next
		roots.rebuild()

		expect(roots.has(first.control)).toBe(true)
		expect(roots.has(first.wrapper)).toBe(true)
		expect(roots.has(next)).toBe(false)
	})
})