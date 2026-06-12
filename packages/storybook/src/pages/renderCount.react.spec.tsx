import type {MarkProps} from '@markput/react'
import {MarkedInput} from '@markput/react'
import {describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'

import {getElement} from '../shared/lib/dom'
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