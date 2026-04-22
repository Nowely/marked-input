import type {Markup} from '@markput/vue'
import {MarkedInput, useMark} from '@markput/vue'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-vue'
import {page} from 'vitest/browser'
import {defineComponent, h} from 'vue'

describe('Nested Marks Rendering', () => {
	const TestMark = defineComponent({
		props: {value: String, children: {type: null}},
		setup(props, {slots}) {
			const mark = useMark()
			return () =>
				h(
					'span',
					{
						'data-testid': `mark-depth-${mark.depth}`,
						'data-depth': mark.depth,
						'data-has-children': mark.hasChildren,
					},
					slots.default?.() ?? props.value
				)
		},
	})

	it('render simple nested marks', async () => {
		const markup: Markup = '@[__slot__]'
		const value = '@[outer @[inner]]'

		await render(MarkedInput, {
			props: {
				Mark: TestMark,
				value,
				options: [{markup}],
			},
		})

		const outerMark = page.getByTestId('mark-depth-0')
		const innerMark = page.getByTestId('mark-depth-1')

		await expect.element(outerMark).toBeInTheDocument()
		await expect.element(innerMark).toBeInTheDocument()
		expect(outerMark.element().getAttribute('data-has-children')).toBe('true')
		expect(innerMark.element().getAttribute('data-has-children')).toBe('false')
	})

	it('render multiple nesting levels', async () => {
		const markup: Markup = '@[__slot__]'
		const value = '@[level0 @[level1 @[level2]]]'

		await render(MarkedInput, {
			props: {
				Mark: TestMark,
				value,
				options: [{markup}],
			},
		})

		const level0 = page.getByTestId('mark-depth-0')
		const level1 = page.getByTestId('mark-depth-1')
		const level2 = page.getByTestId('mark-depth-2')

		await expect.element(level0).toBeInTheDocument()
		await expect.element(level1).toBeInTheDocument()
		await expect.element(level2).toBeInTheDocument()
	})

	it('render multiple nested marks at same level', async () => {
		const markup: Markup = '@[__slot__]'
		const value = '@[outer @[first] and @[second]]'

		await render(MarkedInput, {
			props: {
				Mark: TestMark,
				value,
				options: [{markup}],
			},
		})

		const outerMark = page.getByTestId('mark-depth-0')
		const nestedMarks = page.getByTestId('mark-depth-1').all()

		await expect.element(outerMark).toBeInTheDocument()
		expect(nestedMarks).toHaveLength(2)
	})

	it('render different markup types nested', async () => {
		const TagMark = defineComponent({
			props: {value: String, children: {type: null}},
			setup(props, {slots}) {
				const mark = useMark()
				const isTag = mark.content.startsWith('#')
				return () =>
					h(
						'span',
						{
							'data-testid': isTag ? 'tag-mark' : 'mention-mark',
							'data-depth': mark.depth,
						},
						slots.default?.() ?? props.value
					)
			},
		})

		const tagMarkup: Markup = '#[__slot__]'
		const mentionMarkup: Markup = '@[__slot__]'
		const value = '#[tag with @[mention]]'

		await render(MarkedInput, {
			props: {
				Mark: TagMark,
				value,
				options: [
					{markup: tagMarkup, overlay: {trigger: '#'}},
					{markup: mentionMarkup, overlay: {trigger: '@'}},
				],
			},
		})

		const tagMark = page.getByTestId('tag-mark')
		const mentionMark = page.getByTestId('mention-mark')

		await expect.element(tagMark).toBeInTheDocument()
		await expect.element(mentionMark).toBeInTheDocument()
		expect(tagMark.element().getAttribute('data-depth')).toBe('0')
		expect(mentionMark.element().getAttribute('data-depth')).toBe('1')
	})

	it('handle empty nested marks', async () => {
		const markup: Markup = '@[__slot__]'
		const value = '@[@[]]'

		await render(MarkedInput, {
			props: {
				Mark: TestMark,
				value,
				options: [{markup}],
			},
		})

		const marks = page.getByTestId(/mark-depth-/).all()
		expect(marks).toHaveLength(2)
	})

	it('pass children to Mark component for nested content', async () => {
		let hasChildrenAtDepthZero = false

		const CapturingMark = defineComponent({
			props: {value: String, children: {type: null}},
			setup(props, {slots}) {
				const mark = useMark()
				if (mark.depth === 0 && mark.hasChildren) {
					hasChildrenAtDepthZero = slots.default != null
				}
				return () =>
					h(
						'span',
						{'data-testid': 'mark'},
						slots.default?.() ?? (!mark.hasChildren ? props.value : undefined)
					)
			},
		})

		const markup: Markup = '@[__slot__]'
		const value = '@[before @[nested] after]'

		const {container} = await render(MarkedInput, {
			props: {
				Mark: CapturingMark,
				value,
				options: [{markup}],
			},
		})

		expect(container.textContent).toContain('before')
		expect(container.textContent).toContain('after')
		expect(container.textContent).toContain('nested')
		expect(hasChildrenAtDepthZero).toBe(true)
	})
})

describe('Nested Marks Tree Navigation', () => {
	it('provide correct depth information', async () => {
		const DepthMark = defineComponent({
			props: {value: String, children: {type: null}},
			setup(props, {slots}) {
				const mark = useMark()
				return () => h('span', {'data-depth': mark.depth}, slots.default?.() ?? props.value)
			},
		})

		const markup: Markup = '@[__slot__]'
		const value = '@[d0 @[d1 @[d2]]]'

		const {container} = await render(MarkedInput, {
			props: {
				Mark: DepthMark,
				value,
				options: [{markup}],
			},
		})

		const depths = Array.from(container.querySelectorAll('[data-depth]')).map(el => el.getAttribute('data-depth'))

		expect(depths).toEqual(['0', '1', '2'])
	})

	it('provide hasChildren information', async () => {
		const ChildrenMark = defineComponent({
			props: {value: String, children: {type: null}},
			setup(props, {slots}) {
				const mark = useMark()
				return () => h('span', {'data-has-children': mark.hasChildren}, slots.default?.() ?? props.value)
			},
		})

		const markup: Markup = '@[__slot__]'
		const value = '@[parent @[child]]'

		const {container} = await render(MarkedInput, {
			props: {
				Mark: ChildrenMark,
				value,
				options: [{markup}],
			},
		})

		const elements = Array.from(container.querySelectorAll('[data-has-children]'))
		const hasChildrenValues = elements.map(el => el.getAttribute('data-has-children'))

		expect(hasChildrenValues).toEqual(['true', 'false'])
	})

	it('provide children array', async () => {
		let capturedChildrenCount = 0

		const ChildrenCountMark = defineComponent({
			props: {value: String, children: {type: null}},
			setup(props, {slots}) {
				const mark = useMark()
				if (mark.depth === 0) {
					capturedChildrenCount = mark.tokens.length
				}
				return () => h('span', null, slots.default?.() ?? props.value)
			},
		})

		const markup: Markup = '@[__slot__]'
		const value = '@[parent @[child1] text @[child2]]'

		await render(MarkedInput, {
			props: {
				Mark: ChildrenCountMark,
				value,
				options: [{markup}],
			},
		})

		expect(capturedChildrenCount).toBeGreaterThan(0)
	})
})

describe('Backward Compatibility', () => {
	it('work with flat marks (no nesting)', async () => {
		const FlatMark = defineComponent({
			props: {value: String, meta: String, children: {type: null}},
			setup(props) {
				return () => h('span', {'data-testid': 'flat-mark'}, props.value)
			},
		})

		const markup: Markup = '@[__value__](__meta__)'
		const value = '@[test](meta)'

		await render(MarkedInput, {
			props: {
				Mark: FlatMark,
				value,
				options: [{markup}],
			},
		})

		const mark = page.getByTestId('flat-mark')
		await expect.element(mark).toBeInTheDocument()
		expect(mark.element().textContent).toBe('test')
	})

	it('ignore children prop in flat marks', async () => {
		const FlatMark = defineComponent({
			props: {value: String, children: {type: null}},
			setup(props) {
				return () => h('span', {'data-testid': 'flat-mark'}, props.value)
			},
		})

		const markup: Markup = '@[__value__]'
		const value = '@[test]'

		await render(MarkedInput, {
			props: {
				Mark: FlatMark,
				value,
				options: [{markup}],
			},
		})

		const mark = page.getByTestId('flat-mark')
		await expect.element(mark).toBeInTheDocument()
		expect(mark.element().textContent).toBe('test')
	})

	it('not parse nested content in __value__ placeholders', async () => {
		const FlatMark = defineComponent({
			props: {value: String},
			setup(props) {
				return () => h('span', {'data-testid': 'flat-mark'}, props.value)
			},
		})

		const markup: Markup = '@[__value__]'
		const value = '@[text with @[nested]]'

		await render(MarkedInput, {
			props: {
				Mark: FlatMark,
				value,
				options: [{markup}],
			},
		})

		const marks = page.getByTestId('flat-mark').all()
		expect(marks).toHaveLength(1)
		expect(marks[0].element().textContent).toContain('text with @[nested]')
	})
})

describe('Complex Nesting Scenarios', () => {
	it('handle adjacent nested marks', async () => {
		const TestMark = defineComponent({
			props: {value: String, children: {type: null}},
			setup(props, {slots}) {
				return () => h('span', {'data-testid': 'mark'}, slots.default?.() ?? props.value)
			},
		})

		const markup: Markup = '@[__slot__]'
		const value = '@[first]@[second]'

		await render(MarkedInput, {
			props: {
				Mark: TestMark,
				value,
				options: [{markup}],
			},
		})

		const marks = page.getByTestId('mark').all()
		expect(marks).toHaveLength(2)
	})

	it('handle deeply nested structure', async () => {
		const TestMark = defineComponent({
			props: {value: String, children: {type: null}},
			setup(props, {slots}) {
				const mark = useMark()
				return () => h('span', {'data-depth': mark.depth}, slots.default?.() ?? props.value)
			},
		})

		const markup: Markup = '@[__slot__]'
		const value = '@[@[@[@[@[deep]]]]]'

		const {container} = await render(MarkedInput, {
			props: {
				Mark: TestMark,
				value,
				options: [{markup}],
			},
		})

		const depths = Array.from(container.querySelectorAll('[data-depth]')).map(el =>
			parseInt(el.getAttribute('data-depth') ?? '0')
		)

		expect(Math.max(...depths)).toBe(4)
	})

	it('handle mixed nested and flat marks', async () => {
		const MixedMark = defineComponent({
			props: {value: String, children: {type: null}},
			setup(props, {slots}) {
				const mark = useMark()
				return () =>
					h(
						'span',
						{
							'data-testid': 'mark',
							'data-has-children': mark.hasChildren,
						},
						slots.default?.() ?? props.value
					)
			},
		})

		const nestedMarkup: Markup = '@[__slot__]'
		const value = '@[nested @[child]] @[another]'

		await render(MarkedInput, {
			props: {
				Mark: MixedMark,
				value,
				options: [{markup: nestedMarkup}],
			},
		})

		const marks = page.getByTestId('mark').all()
		expect(marks.length).toBeGreaterThanOrEqual(3)
	})

	it('render nested structure when Mark component renders children', async () => {
		const RenderingMark = defineComponent({
			props: {value: String, children: {type: null}},
			setup(props, {slots}) {
				const mark = useMark()
				return () =>
					h('span', {'data-testid': 'rendering-mark'}, mark.hasChildren ? slots.default?.() : mark.slot)
			},
		})

		const markup: Markup = '@[__slot__]'
		const value = '@[Hello @[World] from @[Nested] marks]'

		const {container} = await render(MarkedInput, {
			props: {
				Mark: RenderingMark,
				value,
				options: [{markup}],
			},
		})

		expect(container.textContent).toContain('Hello')
		expect(container.textContent).toContain('World')
		expect(container.textContent).toContain('from')
		expect(container.textContent).toContain('Nested')
		expect(container.textContent).toContain('marks')
	})
})

describe('Edge Cases', () => {
	it('handle empty input', async () => {
		const TestMark = defineComponent({
			props: {value: String, children: {type: null}},
			setup(props, {slots}) {
				return () => h('span', null, slots.default?.() ?? props.value)
			},
		})

		const markup: Markup = '@[__slot__]'
		const value = ''

		const {container} = await render(MarkedInput, {
			props: {
				Mark: TestMark,
				value,
				options: [{markup}],
			},
		})

		expect(container.textContent).toBe('')
	})

	it('handle input with no marks', async () => {
		const TestMark = defineComponent({
			props: {value: String, children: {type: null}},
			setup(props, {slots}) {
				return () => h('span', null, slots.default?.() ?? props.value)
			},
		})

		const markup: Markup = '@[__slot__]'
		const value = 'Just plain text'

		const {container} = await render(MarkedInput, {
			props: {
				Mark: TestMark,
				value,
				options: [{markup}],
			},
		})

		expect(container.textContent).toBe('Just plain text')
	})

	it('handle malformed nested marks gracefully', async () => {
		const TestMark = defineComponent({
			props: {value: String, children: {type: null}},
			setup(props, {slots}) {
				return () => h('span', {'data-testid': 'mark'}, slots.default?.() ?? props.value)
			},
		})

		const markup: Markup = '@[__slot__]'
		const value = '@[unclosed @[nested'

		const {container} = await render(MarkedInput, {
			props: {
				Mark: TestMark,
				value,
				options: [{markup}],
			},
		})

		await expect.element(container).toBeInTheDocument()
	})
})