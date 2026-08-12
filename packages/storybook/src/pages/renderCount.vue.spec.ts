import type {MarkputApi} from '@markput/core'
import {watch} from '@markput/core'
import type {Option} from '@markput/vue'
import {MarkedInput} from '@markput/vue'
import {describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-vue'
import {page, userEvent} from 'vitest/browser'
import {defineComponent, h, onMounted, shallowRef} from 'vue'

import {getElement} from '../shared/lib/dom'
import {getAllRows} from '../shared/lib/dragTestHelpers'
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
		const options: Option[] = [{markup: '__slot__\n\n', Mark: RowMark}]
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

		// The row's text is the slot Span, bare inside the one host: the row measures it.
		await focusAtEnd(getAllRows(container)[0])

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

	it('first keystroke into a freshly-Enter-created empty row rides the text path', async () => {
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
		const options: Option[] = [{markup: '__slot__\n\n', Mark: RowMark}]
		const Fixture = defineComponent({
			setup() {
				return () =>
					h(MarkedInput, {
						Span,
						options,
						defaultValue: 'First row\n\n',
						layout: 'block',
						draggable: true,
					})
			},
		})

		const {container} = await render(Fixture)
		expect(getAllRows(container)).toHaveLength(1)

		await focusAtEnd(getAllRows(container)[0])

		// Enter creates an EMPTY row (caret inside it) — structural, re-renders.
		await userEvent.keyboard('{Enter}')
		expect(getAllRows(container)).toHaveLength(2)
		const markBaseline = markRender.mock.calls.length
		const spanBaseline = spanRender.mock.calls.length

		// Gate: the FIRST keystroke into the fresh empty row rides the text path —
		// the empty slot Span is patched in place, zero component re-renders.
		await userEvent.keyboard('x')
		await expect.element(page.getByText('x')).toBeInTheDocument()
		expect(spanRender.mock.calls.length).toBe(spanBaseline)
		expect(markRender.mock.calls.length).toBe(markBaseline)
	})
})

/**
 * Vue mirror of the react value-only commit gate — see renderCount.react.spec.tsx for
 * what it discriminates. Same wiring on this side: `Container.vue`'s selector carries
 * `renderEpoch` for exactly this commit shape.
 */
describe('Render-count gates: commit routing', () => {
	it('a mark value change announces changed — the commit completes with no root-list move', async () => {
		const api = shallowRef<MarkputApi | null>(null)
		const Mark = defineComponent({
			props: {value: String},
			setup: props => () => h('mark', {}, props.value),
		})
		const Span = defineComponent({
			props: {value: String},
			setup: props => () => h('span', {}, props.value),
		})
		const Fixture = defineComponent({
			setup() {
				return () => h(MarkedInput, {ref: api, Mark, Span, defaultValue: 'a@[x](1)b'})
			},
		})

		await render(Fixture)
		await expect.element(page.getByText('x')).toBeInTheDocument()

		const announced: number[] = []
		watch(api.value!.changed, delta => announced.push(delta.updated.length))

		const mark = api.value?.nodes().find(node => node.kind === 'mark')
		expect(mark?.update({value: 'y'})).toBe(true)
		await expect.element(page.getByText('y')).toBeInTheDocument()

		expect(announced).toEqual([1])
	})
})

/**
 * Vue mirror of the react fan-out gate — the D8 render-count gate, an EXACT
 * number at the size the tradeoff is stated against. See
 * renderCount.react.spec.tsx for what each case discriminates. Vue's bridge
 * differs (an `effect` into a `shallowRef`, and `Token.vue` has no memo
 * comparator to begin with) so the number is not inherited from react: it is
 * measured here separately.
 */
describe('Render-count gates: structural fan-out', () => {
	const MARKS = 100
	const document100 = `HEAD ${Array.from({length: MARKS}, (_, i) => `@[m${i}](${i})`).join(' ')}`

	const spies = () => {
		const markRender = vi.fn()
		const Mark = defineComponent({
			props: {value: String},
			setup(props) {
				return () => {
					markRender()
					return h('mark', {}, props.value)
				}
			},
		})
		const Span = defineComponent({
			props: {value: String},
			setup(props) {
				return () => h('span', {}, props.value)
			},
		})
		return {markRender, Mark, Span}
	}

	it('a head insert at 100 marks re-renders exactly the inserted mark', async () => {
		const {markRender, Mark, Span} = spies()
		const Fixture = defineComponent({
			setup() {
				return () => h(MarkedInput, {Mark, Span, defaultValue: document100})
			},
		})

		await render(Fixture)
		await expect.element(page.getByText(`m${MARKS - 1}`)).toBeInTheDocument()

		await focusAtEnd(getElement(page.getByText('HEAD ')))
		const baseline = markRender.mock.calls.length
		expect(baseline).toBeGreaterThanOrEqual(MARKS)

		await userEvent.keyboard('@[[new](999)')
		await expect.element(page.getByText('new')).toBeInTheDocument()

		expect(markRender.mock.calls.length - baseline).toBe(1)
	})

	it('one mark value change at 100 marks re-renders exactly that mark', async () => {
		const {markRender, Mark, Span} = spies()
		const api = shallowRef<MarkputApi | null>(null)
		const Fixture = defineComponent({
			setup() {
				return () => h(MarkedInput, {ref: api, Mark, Span, defaultValue: document100})
			},
		})

		await render(Fixture)
		await expect.element(page.getByText(`m${MARKS - 1}`)).toBeInTheDocument()

		const baseline = markRender.mock.calls.length
		expect(baseline).toBeGreaterThanOrEqual(MARKS)

		const first = api.value?.nodes().find(node => node.kind === 'mark')
		expect(first).toBeDefined()
		expect(first?.update({value: 'edited'})).toBe(true)
		await expect.element(page.getByText('edited')).toBeInTheDocument()

		expect(markRender.mock.calls.length - baseline).toBe(1)
	})
})

/**
 * Vue mirror of the react remount gate (renderCount.react.spec.tsx — see its
 * comment for the identity-key mechanics). The mount spy is onMounted, keyed
 * by value: only real unmount/remount cycles count.
 */
describe('Remount gates: identity keys', () => {
	it('a structural edit before a mark does not remount the suffix marks', async () => {
		const mounts: string[] = []
		const Mark = defineComponent({
			props: {value: String},
			setup(props) {
				onMounted(() => {
					mounts.push(props.value ?? '')
				})
				return () => h('mark', {}, props.value)
			},
		})
		const Span = defineComponent({
			props: {value: String},
			setup(props) {
				return () => h('span', {}, props.value)
			},
		})
		const Fixture = defineComponent({
			setup() {
				return () => h(MarkedInput, {Mark, Span, defaultValue: 'Hello @[a](1) and @[b](2)!'})
			},
		})

		await render(Fixture)
		await expect.element(page.getByText('b')).toBeInTheDocument()
		expect(mounts.filter(v => v === 'a')).toHaveLength(1)
		expect(mounts.filter(v => v === 'b')).toHaveLength(1)

		// Structural edit BEFORE both marks — @[a] and @[b] suffix-shift into
		// NEW token objects carrying INHERITED ids.
		await focusAtEnd(getElement(page.getByText('Hello')))
		await userEvent.keyboard('@[[new](3)')
		await expect.element(page.getByText('new')).toBeInTheDocument()

		// Gate: only the inserted mark mounts — the shifted marks keep their keys.
		expect(mounts.filter(v => v === 'new')).toHaveLength(1)
		expect(mounts.filter(v => v === 'a')).toHaveLength(1)
		expect(mounts.filter(v => v === 'b')).toHaveLength(1)
	})
})