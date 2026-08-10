import type {MarkProps, Option} from '@markput/react'
import {MarkedInput} from '@markput/react'
import {useEffect} from 'react'
import {describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'

import {getElement} from '../shared/lib/dom'
import {getAllRows, getEditableInRow} from '../shared/lib/dragTestHelpers'
import {focusAtEnd} from '../shared/lib/focus'

/**
 * Design-spec Phase 3 headline gates (commit routing):
 * - pure text edit → 0 committed renderer invocations (the core text path
 *   patches the DOM directly; tree keeps its reference, so React's
 *   useSyncExternalStore snapshot is reference-equal and skips the re-render)
 * - structural edit → ≥1 renderer invocation (tree reference changes)
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
		// invalidates tree and re-renders through React.
		await userEvent.keyboard('@[[struct](2)')
		await expect.element(page.getByText('struct')).toBeInTheDocument()
		expect(spanRender.mock.calls.length).toBeGreaterThan(baseline)
	})
})

/**
 * Fan-out gate (the `Token` memo comparator): the gate above only pins
 * "structural > baseline", which passes identically at 1 re-render and at N —
 * so it cannot see the regression this one exists for. A structural edit at the
 * HEAD re-materializes every token after it with a shifted `position` and no
 * other change; the bound below is therefore a CONSTANT, not a relative one.
 */
describe('Render-count gates: structural fan-out', () => {
	it('a structural edit at the head re-renders a constant number of marks', async () => {
		const MARKS = 24
		const markRender = vi.fn()
		const Mark = ({value}: MarkProps) => {
			markRender()
			return <mark>{value}</mark>
		}
		const Span = ({value}: MarkProps) => <span>{value}</span>
		const marks = Array.from({length: MARKS}, (_, i) => `@[m${i}](${i})`).join(' ')

		await render(<MarkedInput Mark={Mark} Span={Span} defaultValue={`HEAD ${marks}`} />)
		await expect.element(page.getByText(`m${MARKS - 1}`)).toBeInTheDocument()

		await focusAtEnd(getElement(page.getByText('HEAD ')))
		const baseline = markRender.mock.calls.length
		expect(baseline).toBeGreaterThanOrEqual(MARKS)

		// Completing a markup BEFORE every existing mark: all MARKS of them
		// suffix-shift into new objects carrying the same id, content, value,
		// meta and descriptor — only `position` differs, and nothing reads it.
		await userEvent.keyboard('@[[new](99)')
		await expect.element(page.getByText('new')).toBeInTheDocument()

		// Gate: the shifted marks do not re-render — the delta stays flat as the
		// document grows. Without the comparator this delta is MARKS + 1.
		expect(markRender.mock.calls.length - baseline).toBeLessThanOrEqual(5)
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
		const options: Option[] = [{markup: '__slot__\n\n', Mark: RowMark}]

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

	it('first keystroke into a freshly-Enter-created empty row rides the text path', async () => {
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
		const options: Option[] = [{markup: '__slot__\n\n', Mark: RowMark}]

		const {container} = await render(
			<MarkedInput Span={Span} options={options} defaultValue={'First row\n\n'} layout="block" draggable />
		)
		expect(getAllRows(container)).toHaveLength(1)

		await focusAtEnd(getEditableInRow(getAllRows(container)[0]))

		// Enter at the row end creates an EMPTY row with the caret inside it —
		// structural, re-renders. The gate below is a delta from AFTER it settled.
		await userEvent.keyboard('{Enter}')
		expect(getAllRows(container)).toHaveLength(2)
		const markBaseline = markRender.mock.calls.length
		const spanBaseline = spanRender.mock.calls.length

		// Gate: the FIRST keystroke into the fresh empty row rides the text path —
		// the empty slot Span is patched in place, zero component re-renders.
		// (Pre-fix: TreeBuilder collapsed the empty slot to undefined, tryDescend
		// refused, and the keystroke escalated to a full framework re-render.)
		await userEvent.keyboard('x')
		await expect.element(page.getByText('x')).toBeInTheDocument()
		expect(spanRender.mock.calls.length).toBe(spanBaseline)
		expect(markRender.mock.calls.length).toBe(markBaseline)
	})
})

/**
 * Remount gate (identity unification, phase 1): framework keys come from the
 * stable identity id (`tokens.keyOf`), not per-object WeakMap counters — a
 * suffix-shifted token (NEW object after an edit before it, INHERITED id)
 * must keep its key, so React reconciles it in place instead of
 * unmount+remount (which silently drops component-local state and DOM focus).
 * The spy records each Mark MOUNT (empty-deps effect), keyed by value, so
 * transient renders cannot skew it — only real unmount/remount cycles count.
 */
describe('Remount gates: identity keys', () => {
	it('a structural edit before a mark does not remount the suffix marks', async () => {
		const mounts: string[] = []
		const Mark = ({value}: MarkProps) => {
			useEffect(() => {
				mounts.push(String(value))
			}, [])
			return <mark>{value}</mark>
		}
		const Span = ({value}: MarkProps) => <span>{value}</span>

		await render(<MarkedInput Mark={Mark} Span={Span} defaultValue="Hello @[a](1) and @[b](2)!" />)
		await expect.element(page.getByText('b')).toBeInTheDocument()
		expect(mounts.filter(v => v === 'a')).toHaveLength(1)
		expect(mounts.filter(v => v === 'b')).toHaveLength(1)

		// Structural edit BEFORE both marks: completing a markup inserts a new
		// mark token at the caret; @[a] and @[b] suffix-shift — NEW token
		// objects carrying INHERITED ids.
		await focusAtEnd(getElement(page.getByText('Hello')))
		await userEvent.keyboard('@[[new](3)')
		await expect.element(page.getByText('new')).toBeInTheDocument()

		// Gate: the shifted marks keep their framework keys — only the inserted
		// mark mounts. (Pre-fix: the object-keyed KeyGenerator handed the
		// shifted marks brand-new keys, so React unmounted and remounted them.)
		expect(mounts.filter(v => v === 'new')).toHaveLength(1)
		expect(mounts.filter(v => v === 'a')).toHaveLength(1)
		expect(mounts.filter(v => v === 'b')).toHaveLength(1)
	})
})