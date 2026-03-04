import type {Meta, StoryObj} from '@storybook/vue3-vite'
import {defineComponent, h, ref} from 'vue'
import type {Markup} from '@markput/vue'
import {MarkedInput} from '@markput/vue'
import Text from '../../shared/components/Text.vue'

export default {
	title: 'MarkedInput/Nested',
	tags: ['autodocs'],
	component: MarkedInput,
	parameters: {
		docs: {
			description: {
				component:
					'Examples demonstrating nested marks support. Nested marks allow creating rich, hierarchical text structures.',
			},
		},
	},
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<Meta<typeof MarkedInput>>

// ============================================================================
// Example 1: Simple Nesting (Markdown-style)
// ============================================================================

const BoldMarkup: Markup = '**__nested__**'
const ItalicMarkup: Markup = '*__nested__*'

const SimpleMark = defineComponent({
	props: {value: String, children: {type: null}, style: {type: Object}},
	setup(props, {slots}) {
		return () => h('span', {style: props.style}, slots.default?.() ?? props.value)
	},
})

export const SimpleNesting: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref('This is *italic text with **bold** inside* and more text.')

				return () => [
					h(MarkedInput, {
						Mark: SimpleMark,
						value: value.value,
						onChange: (v: string) => {
							value.value = v
						},
						options: [
							{
								markup: BoldMarkup,
								mark: ({children}: {value?: string; children?: any}) => ({
									children,
									style: {fontWeight: 'bold'},
								}),
							},
							{
								markup: ItalicMarkup,
								mark: ({children}: {value?: string; children?: any}) => ({
									children,
									style: {fontStyle: 'italic'},
								}),
							},
						],
					}),
					h(Text, {label: 'Raw value:', value: value.value}),
				]
			},
		}),
}

// ============================================================================
// Example 2: Multiple Nesting Levels
// ============================================================================

const TagMarkup: Markup = '#[__nested__]'
const MentionMarkup: Markup = '@[__nested__]'
const CodeMarkup: Markup = '`__nested__`'

const MultiLevelMark = defineComponent({
	props: {value: String, children: {type: null}, style: {type: Object}},
	setup(props, {slots}) {
		return () => h('span', {style: {...(props.style as any), margin: '0 2px'}}, slots.default?.() ?? props.value)
	},
})

export const MultipleLevels: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref(
					'Check #[this tag with @[nested mention with `code`]] and #[another #[deeply nested] tag]'
				)

				return () => [
					h(MarkedInput, {
						Mark: MultiLevelMark,
						value: value.value,
						onChange: (v: string) => {
							value.value = v
						},
						options: [
							{
								markup: TagMarkup,
								mark: ({children}: {value?: string; children?: any}) => ({
									children,
									style: {
										backgroundColor: '#e7f3ff',
										border: '1px solid #2196f3',
										color: '#1976d2',
										padding: '2px 6px',
										borderRadius: '4px',
									},
								}),
							},
							{
								markup: MentionMarkup,
								mark: ({children}: {value?: string; children?: any}) => ({
									children,
									style: {
										backgroundColor: '#fff3e0',
										border: '1px solid #ff9800',
										color: '#f57c00',
										padding: '2px 6px',
										borderRadius: '4px',
									},
								}),
							},
							{
								markup: CodeMarkup,
								mark: ({children}: {value?: string; children?: any}) => ({
									children,
									style: {
										backgroundColor: '#f3e5f5',
										border: '1px solid #9c27b0',
										color: '#7b1fa2',
										padding: '2px 6px',
										borderRadius: '4px',
									},
								}),
							},
						],
					}),
					h(Text, {label: 'Raw value:', value: value.value}),
				]
			},
		}),
}

// ============================================================================
// Example 3: HTML-like Tags
// ============================================================================

const HtmlMarkup: Markup = '<__value__>__nested__</__value__>'

const HtmlLikeMark = defineComponent({
	props: {value: String, nested: String, children: {type: null}},
	setup(props, {slots}) {
		return () => h(props.value || 'span', {}, slots.default?.() ?? props.nested)
	},
})

export const HtmlLikeTags: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref(
					'<div>This is a div with <mark>a mark inside</mark> and <b>bold text with <del>nested del</del></b></div>'
				)

				return () => [
					h(MarkedInput, {
						Mark: HtmlLikeMark,
						value: value.value,
						onChange: (v: string) => {
							value.value = v
						},
						options: [{markup: HtmlMarkup}],
					}),
					h(Text, {label: 'Raw value:', value: value.value}),
				]
			},
		}),
}
