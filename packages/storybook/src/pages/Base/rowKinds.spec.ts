import {describe, expect, it, vi} from 'vitest'

import {defineMark, Empty, Mark} from '../../shared/lib/marks'
import {mountComponent} from '../../shared/lib/page'

/**
 * A ROW renders through its KIND's component, in both adapters. Framework-free on purpose: the
 * two `Row` implementations resolve the component through the same core resolver, so a
 * divergence between them is a failing test here rather than a difference nobody diffs.
 *
 * The fixtures are generated marks, which take the row's rendered children exactly as they take a
 * mark's — that shared shape is what lets one file drive both projects.
 */
const REPORT =
	'[markput] The row kind "# __slot__" rendered no element the editor could bind: spread `ref` onto ' +
	'the one element the component renders. Until it does, the caret cannot resolve into this row.'

const Heading = defineMark({tag: 'h1', class: 'heading'})
const Quote = defineMark({tag: 'blockquote'})

const ROWS = {separator: '\n', Mark} as const

/** The frame `rowPainted` waits before it speaks. */
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))

describe('row kinds', () => {
	it('paints a typed row through its own component and a paragraph through the paragraph slot', async () => {
		const {host} = await mountComponent({
			value: '# Title\nplain',
			...ROWS,
			options: [{markup: '# __slot__', row: {Component: Heading}}],
		})

		const heading = host.querySelector('h1')
		expect(heading?.textContent).toBe('Title')
		expect(heading?.classList.contains('heading')).toBe(true)
		// The paragraph has no kind, so it keeps the default `slots.paragraph` component. Read by
		// index: the container's last child is the row-controls layer, not a row.
		expect(host.children[1]?.tagName).toBe('DIV')
		expect(host.children[1]?.textContent).toBe('plain')
	})

	it('keeps a row opener out of the painted text', async () => {
		const {host} = await mountComponent({
			value: '# Title',
			...ROWS,
			options: [{markup: '# __slot__', row: {Component: Heading}}],
		})

		// The opener is structural: it stays in the value and never reaches the document.
		expect(host.textContent).toBe('Title')
	})

	it('paints inline marks inside a typed row', async () => {
		const {host} = await mountComponent({
			value: '> quoting @[someone]',
			...ROWS,
			options: [{markup: '> __slot__', row: {Component: Quote}}, {markup: '@[__value__]'}],
		})

		expect(host.querySelector('blockquote mark')?.textContent).toBe('someone')
	})

	/**
	 * A row kind whose component paints no element — one that returns `null`, or does so on some
	 * condition. The row cannot bind and its caret positions are gone, which is the cost declared
	 * on `RowProps.ref`; what must NOT happen is the editor coming apart around it.
	 *
	 * Vue threw here until the ref unwrap stopped trusting `$el`: a component that renders nothing
	 * has a Comment there, and consigning it reached the mount-state write, which sets attributes.
	 */
	it('carries on when a row kind paints no element at all', async () => {
		const {host} = await mountComponent({
			value: '# Title\nplain',
			...ROWS,
			options: [{markup: '# __slot__', row: {Component: Empty}}],
		})

		expect(host.textContent).toBe('plain')
	})

	/**
	 * AND IT SAYS SO. The same shape from the consumer's side, and the one mistake a row kind can
	 * make with nothing on screen to show it. React reaches it by not spreading the `ref` it is
	 * handed; Vue, whose row component takes the ref through its instance, reaches it by painting
	 * no element — which is `Empty` here, the one spelling both frameworks share.
	 *
	 * It is the ADAPTER's report to raise, from the hook that runs once refs have attached: `bind`
	 * runs on the commit, a frame before the paint, where an unconsigned row is the ordinary case.
	 */
	it('reports the kind whose component painted no element', async () => {
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
		try {
			await mountComponent({
				value: '# Title',
				...ROWS,
				options: [{markup: '# __slot__', row: {Component: Empty}}],
			})
			await nextFrame()

			expect(errors.mock.calls.map(call => String(call[0]))).toEqual([REPORT])
		} finally {
			errors.mockRestore()
		}
	})

	/**
	 * THE TURN-INTO PATH, which is the one a consumer takes first: a slash menu applies a kind to
	 * the row already under the caret. The row's node survives it — its id, its element and its
	 * grip are the row's identity and only the kind changes underneath — so nothing remounts, and
	 * asking at mount alone said nothing at all about the kind that just took over.
	 */
	it('reports a kind that painted no element after a turn-into', async () => {
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
		try {
			const {rerender} = await mountComponent({
				value: 'plain',
				...ROWS,
				options: [{markup: '# __slot__', row: {Component: Empty}}],
			})
			await nextFrame()
			expect(errors.mock.calls).toHaveLength(0)

			const host = await rerender({
				value: '# plain',
				...ROWS,
				options: [{markup: '# __slot__', row: {Component: Empty}}],
			})
			await nextFrame()

			expect(host.textContent).toBe('')
			expect(errors.mock.calls.map(call => String(call[0]))).toEqual([REPORT])
		} finally {
			errors.mockRestore()
		}
	})

	/**
	 * A NEWLINE INSIDE A ROW'S BODY IS VISIBLE, and the consumer sets nothing for it. Core's own
	 * `.Container span { white-space: pre-wrap }` is what makes it so; the ticket that filed this
	 * as a split contract grepped `packages/core/src` for `whiteSpace`, and the rule is in
	 * `packages/core/styles.module.css`, which that grep could not reach.
	 *
	 * A RAW CLOSED body is the shape that holds one — its interior crosses separators by
	 * construction — and the kind here is a plain `<div>` on purpose: `<pre>` carries the same
	 * declaration from the UA stylesheet and would pass whatever core did.
	 */
	it('renders a newline inside a raw body as a line break, with no consumer CSS', async () => {
		const {host} = await mountComponent({
			value: '```\nfirst\nsecond\n```',
			...ROWS,
			options: [{markup: '```__meta__\n__value__\n```', row: {Component: defineMark({tag: 'div'})}}],
		})

		const surface = host.querySelector('div > span')
		expect(surface?.textContent).toBe('first\nsecond')
		expect(surface && getComputedStyle(surface).whiteSpace).toBe('pre-wrap')
		// TWO PAINTED LINES, which is the claim. Counted by distinct rect TOPS rather than by rect
		// count: both adapters report three boxes for these two lines, and a collapsed newline
		// would put every one of them on one line.
		const lines = new Set([...(surface?.getClientRects() ?? [])].map(rect => Math.round(rect.top)))
		expect(lines.size).toBe(2)
	})

	it('repaints a row when only its kind changes', async () => {
		const {rerender} = await mountComponent({
			value: 'plain',
			...ROWS,
			options: [{markup: '# __slot__', row: {Component: Heading}}],
		})

		const host = await rerender({
			value: '# plain',
			...ROWS,
			options: [{markup: '# __slot__', row: {Component: Heading}}],
		})

		expect(host.querySelector('h1')?.textContent).toBe('plain')
	})
})