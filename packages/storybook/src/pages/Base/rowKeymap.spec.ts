import {describe, expect, it, vi} from 'vitest'
import {userEvent} from 'vitest/browser'

import {ROW_REFUSED, rowsOf} from '../../shared/lib/dom'
import {focusAtStart, settle} from '../../shared/lib/focus'
import {Mark} from '../../shared/lib/marks'
import {composePage, mountComponent, mountEcho} from '../../shared/lib/page'
import {rows} from './Base.fixtures'
import * as BaseStories from './Base.stories'

const {Default} = composePage(BaseStories)

/**
 * THE ROW KEYMAP through real keystrokes, in both adapters. Framework-free on purpose: the two
 * adapters paint rows through the same core resolver and the same keymap, so a divergence between
 * them is a failing test here rather than a difference nobody diffs.
 *
 * The value at EVERY step, not only at the end: a keymap that reaches the right document by the
 * wrong route — an extra empty row that the next keystroke happens to fill, a caret left in the
 * row above — passes an end-state assertion and fails a user.
 *
 * Real keys rather than dispatched input events, and that is the whole reason this spec is in the
 * browser: Tab and Enter have BROWSER defaults (focus moves, the host is split into `<div>`s), and
 * only a real keystroke can tell whether the keymap cancelled them.
 */
const ROWS = {separator: '\n', indent: '\t', Mark} as const
/** A list item: it continues on Enter and it indents on Tab, which is every arm this page drives. */
const BULLET = {markup: '- __slot__' as const, row: {Component: rows.Bullet, continues: true, indents: true}}
/** A kind that declares NOTHING and paints no child rows — the other half of the Tab cases. */
const HEADING = {markup: '## __slot__' as const, row: {Component: rows.Heading}}

describe('the row keymap', () => {
	it('types `- a⏎b⇥c⏎⏎` and lands a nested list', async () => {
		const onChange = vi.fn<(value: string) => void>()
		const {host} = await mountComponent({defaultValue: '', ...ROWS, options: [BULLET], onChange})
		const emitted = () => onChange.mock.lastCall?.[0]

		await focusAtStart(rowsOf(host)[0])

		// The opener is typed like any other text, and the row takes its kind the moment it
		// matches — from there the `- ` is structural and the caret sits past it.
		await userEvent.keyboard('- a')
		await expect.poll(emitted).toBe('- a')
		expect(host.querySelector('li')?.textContent).toBe('a')

		// Enter at the end of a row whose kind CONTINUES opens another row of that kind.
		await userEvent.keyboard('{Enter}')
		await expect.poll(emitted).toBe('- a\n- ')
		expect(rowsOf(host)).toHaveLength(2)

		// And the caret is inside the fresh row's body: the next character lands there.
		await userEvent.keyboard('b')
		await expect.poll(emitted).toBe('- a\n- b')

		// Tab re-indents, because the kind declares `indents`. The two rows become one root.
		await userEvent.keyboard('{Tab}')
		await expect.poll(emitted).toBe('- a\n\t- b')
		await expect.poll(() => rowsOf(host)).toHaveLength(1)

		// AND THEN TYPE, into the row that was just nested: a spec that stops at the value would
		// pass against a nested row the editing host has frozen.
		await userEvent.keyboard('c')
		await expect.poll(emitted).toBe('- a\n\t- bc')

		// Enter at the end of the NESTED row keeps both the kind and the depth.
		await userEvent.keyboard('{Enter}')
		await expect.poll(emitted).toBe('- a\n\t- bc\n\t- ')

		// Enter on the empty row it just opened gives up the DEPTH before the kind, which is how a
		// nested list is left one level at a time.
		await userEvent.keyboard('{Enter}')
		await expect.poll(emitted).toBe('- a\n\t- bc\n- ')
	})

	/**
	 * The soft break, which under one line per row is a CHILD ROW with no kind: the continuation
	 * belongs to the row it was typed in, so it travels with it and renders inside its component.
	 */
	it('opens a continuation line on Shift+Enter and types into it', async () => {
		const onChange = vi.fn<(value: string) => void>()
		const {host} = await mountComponent({defaultValue: '- a', ...ROWS, options: [BULLET], onChange})
		const emitted = () => onChange.mock.lastCall?.[0]

		await focusAtStart(rowsOf(host)[0])
		await userEvent.keyboard('{End}')
		await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
		await expect.poll(emitted).toBe('- a\n\t')

		await userEvent.keyboard('second line')
		await expect.poll(emitted).toBe('- a\n\tsecond line')

		// One ROOT, and the continuation is painted inside the bullet's own element rather than
		// beside it.
		expect(rowsOf(host)).toHaveLength(1)
		expect(host.querySelector('li [class*="Row"]')?.textContent).toBe('second line')

		// The SECOND soft break lands BESIDE the first, not under it: N presses are N lines at one
		// level. Typed here rather than asserted in the unit spec alone because the staircase this
		// replaces was invisible in the value until the third press.
		await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
		await expect.poll(emitted).toBe('- a\n\tsecond line\n\t')
		await userEvent.keyboard('third')
		await expect.poll(emitted).toBe('- a\n\tsecond line\n\tthird')
		expect(rowsOf(host)).toHaveLength(1)
	})

	/**
	 * CONTROLLED, which is the mode the whole seam is designed around and the reason the
	 * continuation is ONE splice: a commit there emits and waits for the echo, so the tree has not
	 * moved when a verb returns, and a second verb in the same tick would address the document as
	 * it was. A soft break composed of a split and a re-indent passes uncontrolled and fails here.
	 */
	it('opens the continuation in CONTROLLED mode too', async () => {
		const {host, value} = await mountEcho(Default, {...ROWS, options: [BULLET], value: '- a'})

		await focusAtStart(rowsOf(host)[0])
		await userEvent.keyboard('{End}')
		await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
		await expect.poll(value).toBe('- a\n\t')

		await userEvent.keyboard('x')
		await expect.poll(value).toBe('- a\n\tx')
	})

	/**
	 * TAB AND THE DRAG AGREE ON WHAT MAY NEST. `RowSpec.indents` answers "does Tab belong to this
	 * FIELD" (ADR-0002), which is a fact about the field; which ROW may go one level deeper is
	 * {@link TokenModel.indentRows}' question, and the drop asks the very same one. Read per KIND
	 * they disagreed — measured over the Notion showcase, four rows were offered depth 1 by the
	 * drag and moved there by the verb while Tab was not consumed at all, so the key fell through
	 * and the BROWSER moved focus out of the editor.
	 *
	 * The heading declares nothing and paints no child rows, which makes it both halves of the
	 * case: it can BE nested (under the bullet) and it can never be a PARENT.
	 */
	it('indents a kind that declares nothing, in an editor where something does', async () => {
		const onChange = vi.fn<(value: string) => void>()
		const {host} = await mountComponent({
			defaultValue: '- a\n## head',
			...ROWS,
			options: [BULLET, HEADING],
			onChange,
		})
		const emitted = () => onChange.mock.lastCall?.[0]

		await focusAtStart(rowsOf(host)[1])
		await userEvent.keyboard('{Tab}')

		await expect.poll(emitted).toBe('- a\n\t## head')
		// AND THE CARET IS STILL IN THE EDITOR: a Tab that fell through would have moved focus out,
		// and the value assertion alone cannot tell that apart from a Tab that worked.
		await userEvent.keyboard('X')
		await expect.poll(emitted).toBe('- a\n\t## Xhead')
	})

	/**
	 * ADR-0002'S ACCEPTED COST, PRESERVED where it was: an editor whose options never indent leaves
	 * Tab to the browser, so the field is still escapable by keyboard alone.
	 */
	it('LEAVES THE FIELD in an editor where no option declares indents', async () => {
		const {host} = await mountComponent({defaultValue: '## a\n## b', ...ROWS, options: [HEADING]})

		await focusAtStart(rowsOf(host)[1])
		await userEvent.keyboard('{Tab}')

		expect(document.activeElement).not.toBe(host)
	})

	/**
	 * AND THE EDITOR PAINTS THE ROW SELECTION ITSELF. The platform's own highlight is all that used
	 * to say a block was selected, and it paints UNDER whatever the kind draws — on the Notion
	 * showcase a click on a board card selected ten lines and showed a faint tint on three column
	 * headers, one Backspace away from taking them. Here on a bare page there is nothing to hide it,
	 * which is exactly why this pin belongs in BOTH adapters: it reads the overlay rather than the
	 * class, so a `Row` that stopped merging the class fails in the framework that dropped it.
	 */
	it('paints the row Esc selected, and only that row', async () => {
		// PARAGRAPHS, not the kinds above: this page's row fixtures declare `inheritAttrs: false`
		// and bind no class, so a kind row here would drop the editor's own class along with the
		// consumer's. The paragraph fallback is core's own element and carries what core resolves.
		const {host} = await mountComponent({defaultValue: 'a\nb', ...ROWS, Mark})
		const [first, second] = rowsOf(host)

		await focusAtStart(second)
		await userEvent.keyboard('{Escape}')
		await settle()

		const overlay = window.getComputedStyle(second, '::after')
		expect(overlay.content).toBe('""')
		expect(overlay.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
		expect(overlay.width).toBe(`${second.getBoundingClientRect().width}px`)
		expect(window.getComputedStyle(first, '::after').content).toBe('none')
	})

	/**
	 * AND A GESTURE THE EDITOR REFUSES IS SAID OUT LOUD, over the row it was refused at.
	 *
	 * `indents` gates the KEY and the verb decides the depth, so a root row in an editor that
	 * indents consumes Shift+Tab and goes nowhere: correct, and until now indistinguishable from an
	 * editor that had stopped responding. Both adapters paint it from one signal, so an adapter that
	 * did not fails here rather than being a difference nobody diffs.
	 */
	it('paints a refusal over the row a Shift+Tab could not outdent, once per press', async () => {
		const onChange = vi.fn<(value: string) => void>()
		const {host} = await mountComponent({defaultValue: '- a', ...ROWS, options: [BULLET], onChange})
		const flash = () => host.querySelector(ROW_REFUSED)

		await focusAtStart(rowsOf(host)[0])
		expect(flash()).toBeNull()

		await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
		await settle()

		const painted = flash()
		expect(painted).not.toBeNull()
		// Over the ROW, not over the layer's origin: the tint says WHICH row declined.
		const row = rowsOf(host)[0].getBoundingClientRect()
		const tint = painted!.getBoundingClientRect()
		expect(Math.round(tint.top)).toBe(Math.round(row.top))
		expect(Math.round(tint.width)).toBe(Math.round(row.width))
		expect(window.getComputedStyle(painted!).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')

		// AND IT IS ACTUALLY PAINTED, which every assertion above is blind to: `.RowRefused` ships
		// at `opacity: 0` and the ONE thing that ever makes it visible is its keyframe run. Deleting
		// that line left an element with the right box and the right colour, permanently invisible,
		// and both projects stayed green — the §A.12 failure mode, a pin asserted against a shape
		// the mechanism does not govern. Asked through the animation itself rather than by sampling
		// opacity, so the assertion does not race the 420ms run.
		//
		// The declared consequence: an environment that suppresses CSS animations turns the whole
		// channel off, silently. That is fail-safe rather than fail-noisy, and it is why the tint is
		// the announcement rather than the only one a consumer could build — `state.refused` is
		// published.
		const run = painted!.getAnimations()
		expect(run).toHaveLength(1)
		expect(run[0].playState).toBe('running')

		// AND IT ENDS. Nothing clears `state.refused`, so one run of the animation is the whole of
		// the tint's visible life: a fade that never finished would leave a red block sitting on the
		// last-refused row for the rest of the session.
		await run[0].finished
		expect(window.getComputedStyle(painted!).opacity).toBe('0')

		// A SECOND PRESS SAYS IT AGAIN: the element is re-mounted, so the animation starts over
		// instead of resting where the first run left it.
		await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
		await settle()
		expect(flash()).not.toBe(painted)

		// And the document never moved, which is the rule the refusal belongs to.
		expect(onChange).not.toHaveBeenCalled()
	})
})