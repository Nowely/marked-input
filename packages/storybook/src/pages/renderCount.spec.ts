import type {MarkNode} from '@markput/core'
import {describe, expect, it} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {getElement, rowsOf} from '../shared/lib/dom'
import {focusAtEnd} from '../shared/lib/focus'
import {countRenders, Mark as PlainMark, Span as PlainSpan} from '../shared/lib/marks'
import {mountComponent} from '../shared/lib/page'
import {markMounts} from './renderCount.fixtures'

/**
 * Render-count gates, held against BOTH adapters from one file. The bridges differ — React
 * re-renders through a `useSyncExternalStore` snapshot, Vue through an `effect` writing a
 * `shallowRef` — but the contract is the same, and while these gates lived in two files the
 * contract drifted: the commit-routing gate below existed only for React.
 *
 * Every counter sits where one call means one render (see `countRenders` in the mark seam), and every
 * gate asserts a DELTA from a baseline taken after mount and focus — so click- or hover-induced
 * renders, and React's double-invoked mount renders, cannot skew any of them.
 */

/**
 * Design-spec Phase 3 headline gates (commit routing):
 * - pure text edit → 0 committed renderer invocations (the core text path patches the DOM
 *   directly; the tree keeps its reference, so neither bridge publishes)
 * - structural edit → ≥1 renderer invocation (the tree reference changes)
 */
describe('Render-count gates: commit routing', () => {
	it('pure text keystroke does not re-render Span; structural edit does', async () => {
		const [CountedSpan, spanRenders] = countRenders({tag: 'span'})
		await mountComponent({separator: null, Mark: PlainMark, Span: CountedSpan, defaultValue: 'Hello @[mark](1)!'})

		await focusAtEnd(getElement(page.getByText('!')))

		// Baseline after mount + focus: every gate below asserts a DELTA from here.
		const baseline = spanRenders()
		expect(baseline).toBeGreaterThan(0)

		// Gate: a pure text keystroke routes through the core text path — the surface is patched
		// without invoking the renderer.
		await userEvent.keyboard('?')
		await expect.element(page.getByText('!?')).toBeInTheDocument()
		expect(spanRenders()).toBe(baseline)

		// Gate: completing a markup adds a mark token — a structural edit that invalidates the
		// tree and re-renders through the framework.
		await userEvent.keyboard('@[[struct](2)')
		await expect.element(page.getByText('struct')).toBeInTheDocument()
		expect(spanRenders()).toBeGreaterThan(baseline)
	})

	// The VALUE-ONLY commit — `render` true, `structural` false — used to be gated here, through
	// the public handle's `changed`. Its subject is core's own clock rather than either bridge, so
	// it went down to `core/features/tokens/tree/markNode.spec.ts` when the handle stopped carrying
	// the event.
})

/**
 * THE fan-out gate, and it is an EXACT NUMBER (spec S2 D8). The gate above only pins
 * "structural > baseline", which passes identically at 1 re-render and at N, so it cannot see
 * the regression this one exists for.
 *
 * Both cases are measured at the size the D8 tradeoff is stated against — 100 marks — and both
 * assert `1`, because both edits change exactly one mark's rendered props:
 *
 * - a head insert re-addresses every following mark and changes nothing they render (a
 *   `position` shift only). Under the render model this gate was written for, that meant 101
 *   fresh snapshot Token objects and React's value comparator suppressing 100 of them.
 * - a value edit on one mark changes THAT mark's props, and suffix-shifts the 99 after it —
 *   same suppression, different origin.
 *
 * The number is not inherited from React: Vue's bridge differs, and `Token.vue` has no memo
 * comparator to begin with, so this file measures the same number on both sides.
 *
 * `toBe(1)`, not a bound: a fan-out regression is exactly what a bound hides.
 */
describe('Render-count gates: structural fan-out', () => {
	const MARKS = 100
	const document100 = `HEAD ${Array.from({length: MARKS}, (_, i) => `@[m${i}](${i})`).join(' ')}`

	it('a head insert at 100 marks re-renders exactly the inserted mark', async () => {
		const [CountedMark, markRenders] = countRenders()
		await mountComponent({separator: null, Mark: CountedMark, Span: PlainSpan, defaultValue: document100})
		await expect.element(page.getByText(`m${MARKS - 1}`)).toBeInTheDocument()

		await focusAtEnd(getElement(page.getByText('HEAD ')))
		const baseline = markRenders()
		expect(baseline).toBeGreaterThanOrEqual(MARKS)

		// Completing a markup BEFORE every existing mark: all MARKS of them suffix-shift, and
		// only their addressing changes.
		await userEvent.keyboard('@[[new](999)')
		await expect.element(page.getByText('new')).toBeInTheDocument()

		expect(markRenders() - baseline).toBe(1)
	})

	it('one mark value change at 100 marks re-renders exactly that mark', async () => {
		// The node is reached the way a consumer reaches one — `useMark()` inside the mark's own
		// component — now that the public handle hands out no nodes. The click that captures it
		// lands BEFORE the baseline, so whatever it re-renders cannot skew the delta.
		let captured: MarkNode | undefined
		const [CountedMark, markRenders] = countRenders({
			tag: 'mark',
			on: {click: ({mark}) => (captured = mark)},
		})
		await mountComponent({separator: null, Mark: CountedMark, Span: PlainSpan, defaultValue: document100})
		await expect.element(page.getByText(`m${MARKS - 1}`)).toBeInTheDocument()

		// The FIRST mark, so the write also suffix-shifts the other 99 (the replacement is a
		// different length): one mark's props change, 99 move.
		await page.getByText('m0').click()
		expect(captured).toBeDefined()

		const baseline = markRenders()
		expect(baseline).toBeGreaterThanOrEqual(MARKS)

		expect(captured?.update({value: 'edited'})).toBe(true)
		await expect.element(page.getByText('edited')).toBeInTheDocument()

		expect(markRenders() - baseline).toBe(1)
	})
})

/**
 * Block-layout gate (issue 08's row world): a row is a RowNode with no markup, its text a
 * bare Span inside the one host. A keystroke inside a row lands on the row's child text
 * token and rides the text path — the surface is patched in place while the tree keeps
 * its reference, so no Span re-renders. A row split is structural and re-renders through
 * the framework.
 */
describe('Render-count gates: block layout', () => {
	it('block keystroke into a row does not re-render Mark or Span; a row split does', async () => {
		const [CountedMark, markRenders] = countRenders({tag: 'mark'})
		const [CountedSpan, spanRenders] = countRenders({tag: 'span'})
		const {host} = await mountComponent({
			Span: CountedSpan,
			options: [{markup: '@[__value__](__meta__)', Mark: CountedMark}],
			defaultValue: 'First @[m](1) row\n\nSecond row\n\n',
			separator: '\n\n',
			draggable: true,
		})
		// Two content rows plus the trailing empty row (issue 08)
		expect(rowsOf(host)).toHaveLength(3)

		await focusAtEnd(rowsOf(host)[0])

		// Baseline after mount + focus: every gate below asserts a DELTA from here.
		const markBaseline = markRenders()
		const spanBaseline = spanRenders()
		expect(markBaseline).toBeGreaterThan(0)
		expect(spanBaseline).toBeGreaterThan(0)

		// Gate: a keystroke INSIDE a row rides the text path — the surface is patched
		// directly, zero component re-renders, the INLINE mark inside the row included.
		await userEvent.keyboard('?')
		await expect.element(page.getByText('row?')).toBeInTheDocument()
		expect(spanRenders()).toBe(spanBaseline)
		expect(markRenders()).toBe(markBaseline)

		// Gate: Enter splits the row (blockEdit inserts the separator) — a structural edit
		// that publishes a new tree and re-renders through the framework.
		await userEvent.keyboard('{Enter}')
		expect(rowsOf(host)).toHaveLength(4)
		expect(spanRenders()).toBeGreaterThan(spanBaseline)
	})

	it('a drag over every row re-renders no Span, however many rows there are', async () => {
		// THE drag gate the editor-level controls layer owes: row-control state is now one signal per
		// editor, where per-row stores made a row-control-driven fan-out structurally impossible.
		// The property is that a drag over the whole document costs the CONSUMER nothing —
		// every tick re-points one editor-level signal and re-renders the layer alone.
		//
		// What it cannot see, measured rather than assumed: subscribing a ROW to `drop` through
		// the object selector (react `Block.tsx`, vue `Block.vue`) leaves this green in both
		// projects, because both bridges skip a child whose node object did not change, so the
		// extra row renders never reach a Mark or a Span. The scalar `dragging` selector both
		// `Block`s use is therefore a discipline this file states but does not enforce.
		const [CountedSpan, spanRenders] = countRenders({tag: 'span'})
		const {host} = await mountComponent({
			Span: CountedSpan,
			options: [],
			defaultValue: 'r0\n\nr1\n\nr2\n\nr3\n\nr4\n\n',
			separator: '\n\n',
			draggable: true,
			style: {marginLeft: '64px'},
		})
		const rows = rowsOf(host)
		expect(rows).toHaveLength(6)

		await userEvent.hover(rows[0])
		const grip = getElement(page.elementLocator(host).getByRole('button', {name: /Drag to reorder/}))
		const dataTransfer = new DataTransfer()
		grip.dispatchEvent(new DragEvent('dragstart', {bubbles: true, cancelable: true, dataTransfer}))

		// Baseline AFTER dragstart: picking the row up is one state change, and the gate is
		// about the ticks that follow it.
		const baseline = spanRenders()
		expect(baseline).toBeGreaterThan(0)

		for (const row of rows) {
			const rect = row.getBoundingClientRect()
			for (const clientY of [rect.top + 1, rect.bottom - 1]) {
				host.dispatchEvent(new DragEvent('dragover', {bubbles: true, cancelable: true, dataTransfer, clientY}))
				// One tick per assertion-worthy paint: without a yield both bridges batch the
				// whole loop into a single pass, and the count measures dirty components.
				await new Promise(resolve => setTimeout(resolve, 0))
			}
		}
		// Not vacuous: the ticks really did drive the layer, and it really did repaint.
		expect(host.querySelector('[class*="DropIndicator"]')).not.toBeNull()
		grip.dispatchEvent(new DragEvent('dragend', {bubbles: true, cancelable: true}))

		expect(spanRenders()).toBe(baseline)
	})

	it('first keystroke into a freshly-Enter-created empty row rides the text path', async () => {
		const [CountedSpan, spanRenders] = countRenders({tag: 'span'})
		const {host} = await mountComponent({
			Span: CountedSpan,
			options: [],
			defaultValue: 'First row\n\n',
			separator: '\n\n',
			draggable: true,
		})
		// One content row plus the trailing empty row (issue 08)
		expect(rowsOf(host)).toHaveLength(2)

		await focusAtEnd(rowsOf(host)[0])

		// Enter at the row end creates an EMPTY row with the caret inside it — structural,
		// re-renders. The gate below is a delta from AFTER it settled.
		await userEvent.keyboard('{Enter}')
		expect(rowsOf(host)).toHaveLength(3)
		const spanBaseline = spanRenders()

		// Gate: the FIRST keystroke into the fresh empty row rides the text path — the empty
		// row's Span is patched in place, zero component re-renders.
		await userEvent.keyboard('x')
		await expect.element(page.getByText('x')).toBeInTheDocument()
		expect(spanRenders()).toBe(spanBaseline)
	})
})

/**
 * Remount gate (identity unification, phase 1): framework keys come from the stable identity id
 * (`node.id`), not per-object WeakMap counters — a suffix-shifted token (NEW object after an
 * edit before it, INHERITED id) must keep its key, so the framework reconciles it in place
 * instead of unmount+remount, which silently drops component-local state and DOM focus.
 */
describe('Remount gates: identity keys', () => {
	it('a structural edit before a mark does not remount the suffix marks', async () => {
		const log = markMounts()
		await mountComponent({
			separator: null,
			Mark: log.Mark,
			Span: PlainSpan,
			defaultValue: 'Hello @[a](1) and @[b](2)!',
		})
		await expect.element(page.getByText('b')).toBeInTheDocument()
		expect(log.mounts().filter(v => v === 'a')).toHaveLength(1)
		expect(log.mounts().filter(v => v === 'b')).toHaveLength(1)

		// Structural edit BEFORE both marks: completing a markup inserts a new mark token at the
		// caret; @[a] and @[b] suffix-shift — NEW token objects carrying INHERITED ids.
		await focusAtEnd(getElement(page.getByText('Hello')))
		await userEvent.keyboard('@[[new](3)')
		await expect.element(page.getByText('new')).toBeInTheDocument()

		// Gate: the shifted marks keep their framework keys — only the inserted mark mounts.
		// (Pre-fix: the object-keyed KeyGenerator handed the shifted marks brand-new keys, so the
		// framework unmounted and remounted them.)
		expect(log.mounts().filter(v => v === 'new')).toHaveLength(1)
		expect(log.mounts().filter(v => v === 'a')).toHaveLength(1)
		expect(log.mounts().filter(v => v === 'b')).toHaveLength(1)
	})
})