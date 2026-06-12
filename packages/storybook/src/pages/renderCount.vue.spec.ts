import type {Markup, Option} from '@markput/vue'
import {MarkedInput} from '@markput/vue'
import {describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-vue'
import {page, userEvent} from 'vitest/browser'
import {defineComponent, h} from 'vue'

import {getAllRows, getEditableInRow} from '../shared/lib/dragTestHelpers'
import {focusAtEnd} from '../shared/lib/focus'

/**
 * Vue mirror of the block-layout render-count gate
 * (renderCount.react.spec.tsx — see its comment for the deep-reconcile
 * mechanics). The bridge differs (`useMarkput` syncs core signals into a
 * `shallowRef` via `effect`) but the contract is the same: on the text path
 * `tokens.tree` keeps its reference, the effect never fires, and no component
 * re-renders — the row's slot surface is patched by the core directly.
 *
 * Both spies live in render-function bodies (one call = one render). The
 * baseline is taken after focus so click/hover-induced renders cannot skew
 * the deltas.
 */
describe('Render-count gates: block layout', () => {
	it('block keystroke into a row does not re-render Mark or Span; a row split does', async () => {
		const markRender = vi.fn()
		const spanRender = vi.fn()
		const RowMark = defineComponent({
			props: {value: String},
			setup(props, {slots}) {
				return () => {
					markRender()
					return h('span', {}, slots.default?.() ?? props.value)
				}
			},
		})
		const Span = defineComponent({
			props: {value: String},
			setup(props) {
				return () => {
					spanRender()
					return h('span', {}, props.value)
				}
			},
		})
		// oxlint-disable-next-line no-unsafe-type-assertion -- raw markup literal, as in the Drag fixtures
		const options: Option[] = [{markup: '__slot__\n\n' as Markup, Mark: RowMark}]
		const Fixture = defineComponent({
			setup() {
				return () =>
					h(MarkedInput, {
						Span,
						options,
						defaultValue: 'First row\n\nSecond row\n\n',
						layout: 'block',
						draggable: true,
					})
			},
		})

		const {container} = await render(Fixture)
		expect(getAllRows(container)).toHaveLength(2)

		// The row's text surface is the slot Span — the only contenteditable in the row.
		await focusAtEnd(getEditableInRow(getAllRows(container)[0]))

		// Baseline after mount + focus: every gate below asserts a DELTA from here.
		const markBaseline = markRender.mock.calls.length
		const spanBaseline = spanRender.mock.calls.length
		expect(markBaseline).toBeGreaterThan(0)
		expect(spanBaseline).toBeGreaterThan(0)

		// Gate: a keystroke INSIDE a row rides the text path — the slot surface
		// is patched directly, zero component re-renders.
		await userEvent.keyboard('?')
		await expect.element(page.getByText('First row?')).toBeInTheDocument()
		expect(spanRender.mock.calls.length).toBe(spanBaseline)
		expect(markRender.mock.calls.length).toBe(markBaseline)

		// Gate: Enter splits the row (blockEdit inserts a row separator) — a
		// structural edit that publishes a new tree and re-renders through Vue.
		await userEvent.keyboard('{Enter}')
		expect(getAllRows(container)).toHaveLength(3)
		expect(markRender.mock.calls.length).toBeGreaterThan(markBaseline)
	})
})