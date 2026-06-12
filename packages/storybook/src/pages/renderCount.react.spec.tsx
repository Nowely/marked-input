import type {MarkProps, Markup, Option} from '@markput/react'
import {MarkedInput} from '@markput/react'
import {describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'

import {getElement} from '../shared/lib/dom'
import {getAllRows, getEditableInRow} from '../shared/lib/dragTestHelpers'
import {focusAtEnd} from '../shared/lib/focus'

/**
 * Design-spec Phase 3 headline gates (commit routing):
 * - pure text edit → 0 committed renderer invocations (the core text path
 *   patches the DOM directly; structure() keeps its reference, so React's
 *   useSyncExternalStore snapshot is reference-equal and skips the re-render)
 * - structural edit → ≥1 renderer invocation (structure() reference changes)
 *
 * The spy lives in the Span component BODY, so it counts render invocations —
 * getSnapshot calls without a commit never reach it. The harness renders
 * without StrictMode (vitest-browser-react default), but the assertions use
 * deltas from a post-focus baseline anyway, so double-invoked mount renders
 * could not skew them.
 */
describe('Render-count gates: commit routing', () => {
	it('pure text keystroke does not re-render Span; structural edit does', async () => {
		const spanRender = vi.fn()
		const Span = ({value}: MarkProps) => {
			spanRender()
			return <span>{value}</span>
		}

		await render(
			<MarkedInput
				Mark={({value}: MarkProps) => <mark>{value}</mark>}
				Span={Span}
				defaultValue="Hello @[mark](1)!"
			/>
		)

		const tail = getElement(page.getByText('!'))
		await focusAtEnd(tail)

		// Baseline after mount + focus: every gate below asserts a DELTA from here.
		const baseline = spanRender.mock.calls.length
		expect(baseline).toBeGreaterThan(0)

		// Gate: a pure text keystroke routes through the core text path — the
		// surface is patched without invoking the renderer.
		await userEvent.keyboard('?')
		await expect.element(page.getByText('!?')).toBeInTheDocument()
		expect(spanRender.mock.calls.length).toBe(baseline)

		// Gate: completing a markup adds a mark token — a structural edit that
		// invalidates structure() and re-renders through React.
		await userEvent.keyboard('@[[struct](2)')
		await expect.element(page.getByText('struct')).toBeInTheDocument()
		expect(spanRender.mock.calls.length).toBeGreaterThan(baseline)
	})
})

/**
 * Block-layout gate (deep reconcile, design-spec B3): every row of a
 * slot-leading markup is a MARK, so before deep reconcile a keystroke inside a
 * row was a mark-level textChanged — escalated structurally, re-rendering on
 * every keystroke. With deep descend the edit lands on the row's child text
 * token (`textChanged`), the mark itself becomes an `updated`, and the commit
 * routes the text path: the child surface is patched in place while `tree`
 * keeps its reference, so neither the row Mark nor the slot Span re-renders.
 *
 * Both spies live in component BODIES (render invocations, as above); the
 * baseline is taken after focus so click/hover-induced renders cannot skew
 * the deltas.
 */
describe('Render-count gates: block layout', () => {
	it('block keystroke into a row does not re-render Mark or Span; a row split does', async () => {
		const markRender = vi.fn()
		const spanRender = vi.fn()
		const RowMark = ({children, value}: MarkProps) => {
			markRender()
			return <span>{children ?? value}</span>
		}
		const Span = ({value}: MarkProps) => {
			spanRender()
			return <span>{value}</span>
		}
		// oxlint-disable-next-line no-unsafe-type-assertion -- raw markup literal, as in the Drag fixtures
		const options: Option[] = [{markup: '__slot__\n\n' as Markup, Mark: RowMark}]

		const {container} = await render(
			<MarkedInput
				Span={Span}
				options={options}
				defaultValue={'First row\n\nSecond row\n\n'}
				layout="block"
				draggable
			/>
		)
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
		// structural edit that publishes a new tree and re-renders through React.
		await userEvent.keyboard('{Enter}')
		expect(getAllRows(container)).toHaveLength(3)
		expect(markRender.mock.calls.length).toBeGreaterThan(markBaseline)
	})
})