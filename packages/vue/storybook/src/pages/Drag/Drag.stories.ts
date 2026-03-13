import type {MarkProps, Markup, Option} from '@markput/vue'
import {MarkedInput} from '@markput/vue'
import type {Meta, StoryObj} from '@storybook/vue3-vite'
import {defineComponent, h, markRaw, ref} from 'vue'

import Text from '../../shared/components/Text.vue'

export default {
	title: 'MarkedInput/Drag',
	tags: ['autodocs'],
	component: MarkedInput,
	parameters: {
		docs: {
			description: {
				component:
					'Drag mode: each top-level token (mark or text fragment) is its own draggable row. Adjacent marks need no separator; adjacent text rows use \\n\\n.',
			},
		},
	},
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<Meta<typeof MarkedInput>>

const mdContainerStyle = {maxWidth: '700px', margin: '0 auto', paddingLeft: '52px'}
const mdEditorStyle = {minHeight: '200px', padding: '12px', border: '1px solid #e0e0e0', borderRadius: '8px'}

const MarkdownMark = defineComponent({
	props: {value: String, meta: String, nested: String, style: {type: Object}},
	setup(props, {slots}) {
		return () =>
			h(
				'span',
				{style: {...(props.style as Record<string, unknown>), margin: '0 1px'}},
				slots.default?.() ?? props.value
			)
	},
})

const markdownOptions: Option[] = [
	{
		markup: '# __nested__\n\n' as Markup,
		mark: (props: MarkProps) => ({
			...props,
			style: {display: 'block', fontSize: '2em', fontWeight: 'bold', margin: '0.5em 0'},
		}),
	},
	{
		markup: '## __nested__\n\n' as Markup,
		mark: (props: MarkProps) => ({
			...props,
			style: {display: 'block', fontSize: '1.5em', fontWeight: 'bold', margin: '0.4em 0'},
		}),
	},
	{
		markup: '### __nested__\n\n' as Markup,
		mark: (props: MarkProps) => ({
			...props,
			style: {display: 'block', fontSize: '1.17em', fontWeight: 'bold', margin: '0.83em 0'},
		}),
	},
	{
		markup: '- __nested__\n\n' as Markup,
		mark: (props: MarkProps) => ({...props, style: {display: 'block', paddingLeft: '1em'}}),
	},
	{markup: '**__nested__**' as Markup, mark: (props: MarkProps) => ({...props, style: {fontWeight: 'bold'}})},
	{markup: '*__nested__*' as Markup, mark: (props: MarkProps) => ({...props, style: {fontStyle: 'italic'}})},
	{
		markup: '`__value__`' as Markup,
		mark: (props: MarkProps) => ({
			...props,
			style: {
				backgroundColor: '#f6f8fa',
				padding: '2px 6px',
				borderRadius: '3px',
				fontFamily: 'monospace',
				fontSize: '0.9em',
			},
		}),
	},
	{
		markup: '```__meta__\n__value__```' as Markup,
		mark: (props: MarkProps) => ({
			...props,
			style: {
				display: 'block',
				backgroundColor: '#f6f8fa',
				padding: '12px',
				borderRadius: '6px',
				fontFamily: 'monospace',
				fontSize: '0.9em',
				whiteSpace: 'pre-wrap',
				border: '1px solid #d1d9e0',
				margin: '8px 0',
			},
		}),
	},
	{
		markup: '[__value__](__meta__)' as Markup,
		mark: (props: MarkProps) => ({
			...props,
			style: {color: '#0969da', textDecoration: 'underline', cursor: 'pointer'},
		}),
	},
	{
		markup: '~~__value__~~' as Markup,
		mark: (props: MarkProps) => ({...props, style: {textDecoration: 'line-through', opacity: 0.7}}),
	},
] as Option[]

const DRAG_MARKDOWN = `# Welcome to **Marked Input**

A powerful library for parsing rich text with markdown formatting.

## Features

- **Bold** and *italic* text support

- \`Code snippets\` and \`code blocks\`

- ~~Strikethrough~~ for deleted content

- Links like [GitHub](https://github.com)

## Example

\`\`\`javascript
const parser = new ParserV2(['**__value__**', '*__value__*'])
const result = parser.parse('Hello **world**!')
\`\`\`

Visit our docs for more details.`

export const Markdown: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref(DRAG_MARKDOWN)
				return () =>
					h('div', {style: mdContainerStyle}, [
						h(MarkedInput, {
							Mark: MarkdownMark,
							options: markdownOptions,
							value: value.value,
							drag: true,
							style: mdEditorStyle,
							onChange: (v: string) => {
								value.value = v
							},
						}),
						h(Text, {label: 'Raw value:', value: value.value}),
					])
			},
		}),
}

// ─── Todo list (all marks include \n\n) ──────────────────────────────────────

const TodoMark = defineComponent({
	props: {value: String, children: {type: null}, style: {type: Object}, todo: String},
	setup(props, {slots}) {
		return () =>
			h('span', {style: {...(props.style as Record<string, unknown>), margin: '0 1px'}}, [
				props.todo
					? h('span', {style: {marginRight: '6px'}}, props.todo === 'done' ? '\u2611' : '\u2610')
					: null,
				slots.default?.() ?? props.value,
			])
	},
})

const todoOptions: Option[] = [
	{
		markup: '# __nested__\n\n' as Markup,
		mark: (props: MarkProps) => ({
			...props,
			style: {display: 'block', fontSize: '1.4em', fontWeight: 'bold', margin: '0.3em 0'},
		}),
	},
	{
		markup: '- [ ] __nested__\n\n' as Markup,
		mark: (props: MarkProps) => ({...props, todo: 'pending', style: {display: 'block'}}),
	},
	{
		markup: '- [x] __nested__\n\n' as Markup,
		mark: (props: MarkProps) => ({
			...props,
			todo: 'done',
			style: {display: 'block', textDecoration: 'line-through', opacity: 0.5},
		}),
	},
	{
		markup: '\t- [ ] __nested__\n\n' as Markup,
		mark: (props: MarkProps) => ({...props, todo: 'pending', style: {display: 'block', paddingLeft: '1.5em'}}),
	},
	{
		markup: '\t- [x] __nested__\n\n' as Markup,
		mark: (props: MarkProps) => ({
			...props,
			todo: 'done',
			style: {display: 'block', paddingLeft: '1.5em', textDecoration: 'line-through', opacity: 0.5},
		}),
	},
	{
		markup: '\t\t- [ ] __nested__\n\n' as Markup,
		mark: (props: MarkProps) => ({...props, todo: 'pending', style: {display: 'block', paddingLeft: '3em'}}),
	},
	{
		markup: '\t\t- [x] __nested__\n\n' as Markup,
		mark: (props: MarkProps) => ({
			...props,
			todo: 'done',
			style: {display: 'block', paddingLeft: '3em', textDecoration: 'line-through', opacity: 0.5},
		}),
	},
	{
		markup: '> __nested__\n\n' as Markup,
		mark: (props: MarkProps) => ({
			...props,
			style: {display: 'block', fontSize: '0.85em', color: '#888', fontStyle: 'italic'},
		}),
	},
] as Option[]

const TODO_VALUE = `# \u{1F4CB} Project Launch Checklist

- [ ] Design Phase

\t- [ ] Create wireframes

\t- [x] Define color palette

\t- [ ] Design component library

- [x] Research

\t- [x] Analyze competitors

\t- [x] User interviews

\t\t- [x] Draft interview questions

\t\t- [x] Schedule 5 sessions

- [ ] Development

\t- [ ] Set up CI/CD pipeline

\t- [x] Write unit tests

\t- [ ] API integration

\t\t- [ ] Auth endpoints

\t\t- [ ] Data sync

- [ ] Launch

\t- [ ] Final QA pass

\t- [ ] Deploy to production

> \u2610 = pending  \u2611 = done`

// ─── Test helper stories (used by Drag.spec.ts) ──────────────────────────────

const testStyle = {minHeight: '100px', padding: '8px', border: '1px solid #e0e0e0'}

export const PlainTextDrag: Story = {
	parameters: {docs: {disable: true}},
	render: () =>
		defineComponent({
			setup() {
				const value = ref(
					'First block of plain text\n\nSecond block of plain text\n\nThird block of plain text\n\nFourth block of plain text\n\nFifth block of plain text'
				)
				return () =>
					h('div', {}, [
						h(MarkedInput, {
							value: value.value,
							drag: true,
							style: testStyle,
							onChange: (v: string) => {
								value.value = v
							},
						}),
						h(Text, {value: value.value}),
					])
			},
		}),
}

export const MarkdownDrag: Story = {
	parameters: {docs: {disable: true}},
	render: () =>
		defineComponent({
			setup() {
				const value = ref(
					'# Welcome to Draggable Blocks\n\nThis is the first paragraph.\n\nThis is the second paragraph.\n\n## Features\n\n- Drag handles appear on hover'
				)
				return () =>
					h('div', {}, [
						h(MarkedInput, {
							Mark: markRaw(MarkdownMark),
							options: markdownOptions,
							value: value.value,
							drag: true,
							style: testStyle,
							onChange: (v: string) => {
								value.value = v
							},
						}),
						h(Text, {value: value.value}),
					])
			},
		}),
}

export const ReadOnlyDrag: Story = {
	parameters: {docs: {disable: true}},
	render: () =>
		defineComponent({
			setup() {
				return () =>
					h(MarkedInput, {
						value: 'Read-Only Content\n\nSection A\n\nSection B',
						readOnly: true,
						drag: true,
						style: testStyle,
					})
			},
		}),
}

export const TodoListDrag: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref(TODO_VALUE)
				return () =>
					h('div', {style: mdContainerStyle}, [
						h(MarkedInput, {
							Mark: TodoMark,
							options: todoOptions,
							value: value.value,
							drag: true,
							style: {...mdEditorStyle, minHeight: '300px'},
							onChange: (v: string) => {
								value.value = v
							},
						}),
						h(Text, {label: 'Raw value:', value: value.value}),
					])
			},
		}),
}