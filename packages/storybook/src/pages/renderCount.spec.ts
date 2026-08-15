import {watch} from '@markput/core'
import {describe, expect, it} from 'vitest'
import {page, userEvent} from 'vitest/browser'

import {childrenOf, getElement} from '../shared/lib/dom'
import {focusAtEnd} from '../shared/lib/focus'
import {Mark as PlainMark, Span as PlainSpan} from '../shared/lib/marks'
import {mountApi, mountComponent} from '../shared/lib/page'
import {counters} from './renderCount.fixtures'

/**
 * Render-count gates, held against BOTH adapters from one file. The bridges differ — React
 * re-renders through a `useSyncExternalStore` snapshot, Vue through an `effect` writing a
 * `shallowRef` — but the contract is the same, and while these gates lived in two files the
 * contract drifted: the commit-routing gate below existed only for React.
 *
 * Every counter sits where one call means one render (see `renderCount.fixtures.*`), and every
 * gate asserts a DELTA from a baseline taken after mount and focus — so click- or hover-induced
 * renders, and React's double-invoked mount renders, cannot skew any of them.
 */

/**
 * The rows of a block layout. Under the single-host topology the editing host IS the row host,
 * so its element children are the rows.
 */
const rowsOf = (host: HTMLElement) => childrenOf(host)

/**
 * Design-spec Phase 3 headline gates (commit routing):
 * - pure text edit → 0 committed renderer invocations (the core text path patches the DOM
 *   directly; the tree keeps its reference, so neither bridge publishes)
 * - structural edit → ≥1 renderer invocation (the tree reference changes)
 */
describe('Render-count gates: commit routing', () => {
	it('pure text keystroke does not re-render Span; structural edit does', async () => {
		const span = counters.span()
		await mountComponent({Mark: PlainMark, Span: span.Span, defaultValue: 'Hello @[mark](1)!'})

		await focusAtEnd(getElement(page.getByText('!')))

		// Baseline after mount + focus: every gate below asserts a DELTA from here.
		const baseline = span.renders()
		expect(baseline).toBeGreaterThan(0)

		// Gate: a pure text keystroke routes through the core text path — the surface is patched
		// without invoking the renderer.
		await userEvent.keyboard('?')
		await expect.element(page.getByText('!?')).toBeInTheDocument()
		expect(span.renders()).toBe(baseline)

		// Gate: completing a markup adds a mark token — a structural edit that invalidates the
		// tree and re-renders through the framework.
		await userEvent.keyboard('@[[struct](2)')
		await expect.element(page.getByText('struct')).toBeInTheDocument()
		expect(span.renders()).toBeGreaterThan(baseline)
	})

	/**
	 * The VALUE-ONLY commit: `render` is true, `structural` is false, and it is the one commit
	 * shape whose completion nothing else here gates. It matters because adoption writes `roots`
	 * only when the ROOT LIST changes by reference, so this commit leaves `tokens.nodes` equal —
	 * a container subscribed to that alone never re-renders, its `rendered()` never fires, `bind`
	 * never runs and the pending latch never opens.
	 *
	 * MEASURED on the Vue side: dropping `renderEpoch` from `Container.vue`'s selector leaves the
	 * whole suite green except this case, which sees zero announcements instead of one.
	 */
	it('a mark value change announces changed — the commit completes with no root-list move', async () => {
		const {api} = await mountApi({Mark: PlainMark, Span: PlainSpan, defaultValue: 'a@[x](1)b'})
		await expect.element(page.getByText('x')).toBeInTheDocument()

		const announced: number[] = []
		watch(api()!.changed, delta => announced.push(delta.updated.length))

		const mark = api()
			?.nodes()
			.find(node => node.kind === 'mark')
		expect(mark?.update({value: 'y'})).toBe(true)
		await expect.element(page.getByText('y')).toBeInTheDocument()

		expect(announced).toEqual([1])
	})
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
		const mark = counters.mark()
		await mountComponent({Mark: mark.Mark, Span: PlainSpan, defaultValue: document100})
		await expect.element(page.getByText(`m${MARKS - 1}`)).toBeInTheDocument()

		await focusAtEnd(getElement(page.getByText('HEAD ')))
		const baseline = mark.renders()
		expect(baseline).toBeGreaterThanOrEqual(MARKS)

		// Completing a markup BEFORE every existing mark: all MARKS of them suffix-shift, and
		// only their addressing changes.
		await userEvent.keyboard('@[[new](999)')
		await expect.element(page.getByText('new')).toBeInTheDocument()

		expect(mark.renders() - baseline).toBe(1)
	})

	it('one mark value change at 100 marks re-renders exactly that mark', async () => {
		const mark = counters.mark()
		const {api} = await mountApi({Mark: mark.Mark, Span: PlainSpan, defaultValue: document100})
		await expect.element(page.getByText(`m${MARKS - 1}`)).toBeInTheDocument()

		const baseline = mark.renders()
		expect(baseline).toBeGreaterThanOrEqual(MARKS)

		// The FIRST mark, so the write also suffix-shifts the other 99 (the replacement is a
		// different length): one mark's props change, 99 move.
		const first = api()
			?.nodes()
			.find(node => node.kind === 'mark')
		expect(first).toBeDefined()
		expect(first?.update({value: 'edited'})).toBe(true)
		await expect.element(page.getByText('edited')).toBeInTheDocument()

		expect(mark.renders() - baseline).toBe(1)
	})
})

/**
 * Block-layout gate (deep reconcile, design-spec B3): every row of a slot-leading markup is a
 * MARK, so before deep reconcile a keystroke inside a row was a mark-level textChanged —
 * escalated structurally, re-rendering on every keystroke. With deep descend the edit lands on
 * the row's child text token (`textChanged`), the mark itself becomes an `updated`, and the
 * commit routes the text path: the child surface is patched in place while the tree keeps its
 * reference, so neither the row Mark nor the slot Span re-renders.
 */
describe('Render-count gates: block layout', () => {
	it('block keystroke into a row does not re-render Mark or Span; a row split does', async () => {
		const row = counters.blockRows()
		const span = counters.span()
		const {host} = await mountComponent({
			Span: span.Span,
			options: row.options,
			defaultValue: 'First row\n\nSecond row\n\n',
			layout: 'block',
			draggable: true,
		})
		expect(rowsOf(host)).toHaveLength(2)

		// The row's text is the slot Span, bare inside the one host: the row measures it.
		await focusAtEnd(rowsOf(host)[0])

		// Baseline after mount + focus: every gate below asserts a DELTA from here.
		const markBaseline = row.renders()
		const spanBaseline = span.renders()
		expect(markBaseline).toBeGreaterThan(0)
		expect(spanBaseline).toBeGreaterThan(0)

		// Gate: a keystroke INSIDE a row rides the text path — the slot surface is patched
		// directly, zero component re-renders.
		await userEvent.keyboard('?')
		await expect.element(page.getByText('First row?')).toBeInTheDocument()
		expect(span.renders()).toBe(spanBaseline)
		expect(row.renders()).toBe(markBaseline)

		// Gate: Enter splits the row (blockEdit inserts a row separator) — a structural edit that
		// publishes a new tree and re-renders through the framework.
		await userEvent.keyboard('{Enter}')
		expect(rowsOf(host)).toHaveLength(3)
		expect(row.renders()).toBeGreaterThan(markBaseline)
	})

	it('first keystroke into a freshly-Enter-created empty row rides the text path', async () => {
		const row = counters.blockRows()
		const span = counters.span()
		const {host} = await mountComponent({
			Span: span.Span,
			options: row.options,
			defaultValue: 'First row\n\n',
			layout: 'block',
			draggable: true,
		})
		expect(rowsOf(host)).toHaveLength(1)

		await focusAtEnd(rowsOf(host)[0])

		// Enter at the row end creates an EMPTY row with the caret inside it — structural,
		// re-renders. The gate below is a delta from AFTER it settled.
		await userEvent.keyboard('{Enter}')
		expect(rowsOf(host)).toHaveLength(2)
		const markBaseline = row.renders()
		const spanBaseline = span.renders()

		// Gate: the FIRST keystroke into the fresh empty row rides the text path — the empty slot
		// Span is patched in place, zero component re-renders. (Pre-fix: TreeBuilder collapsed the
		// empty slot to undefined, tryDescend refused, and the keystroke escalated to a full
		// framework re-render.)
		await userEvent.keyboard('x')
		await expect.element(page.getByText('x')).toBeInTheDocument()
		expect(span.renders()).toBe(spanBaseline)
		expect(row.renders()).toBe(markBaseline)
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
		const log = counters.markMounts()
		await mountComponent({
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