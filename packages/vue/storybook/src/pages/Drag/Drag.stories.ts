import type {MarkProps, Markup, Option} from '@markput/vue'
import {MarkedInput} from '@markput/vue'
import type {Meta, StoryObj} from '@storybook/vue3-vite'
import {defineComponent, h, ref} from 'vue'

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

// ─── Shared chip component ─────────────────────────────────────────────────

const Chip = defineComponent({
	props: {value: String, style: {type: Object}},
	setup(props) {
		return () =>
			h(
				'span',
				{
					style: {
						display: 'inline-block',
						padding: '2px 10px',
						borderRadius: 14,
						background: '#e8f0fe',
						color: '#1a73e8',
						fontWeight: 500,
						fontSize: 13,
						...(props.style as Record<string, unknown>),
					},
				},
				props.value
			)
	},
})

const mentionOptions: Option[] = [{markup: '@[__value__](__meta__)' as Markup}, {markup: '#[__value__]' as Markup}]

const containerStyle = {maxWidth: '500px', margin: '0 auto', paddingLeft: '52px'}
const editorStyle = {minHeight: '120px', padding: '12px', border: '1px solid #e0e0e0', borderRadius: '8px'}

// ─── Basic: mark rows are auto-delimited ────────────────────────────────────

export const BasicMentions: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref('@[Alice](alice)@[Bob](bob)@[Carol](carol)')
				return () =>
					h('div', {style: containerStyle}, [
						h('p', {style: {color: '#555', fontSize: 13, marginBottom: 8}}, [
							'Three adjacent marks — no ',
							h('code', '\\n\\n'),
							' separator needed between them. Each mark is its own draggable row.',
						]),
						h(MarkedInput, {
							Mark: Chip,
							options: mentionOptions,
							value: value.value,
							drag: true,
							style: editorStyle,
							onChange: (v: string) => {
								value.value = v
							},
						}),
						h(Text, {label: 'Raw value:', value: value.value}),
					])
			},
		}),
}

// ─── Mixed: text rows and mark rows ─────────────────────────────────────────

export const MixedTokens: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref('Introduction\n\n@[Alice](alice)@[Bob](bob)\n\nConclusion')
				return () =>
					h('div', {style: containerStyle}, [
						h('p', {style: {color: '#555', fontSize: 13, marginBottom: 8}}, [
							'Text rows use ',
							h('code', '\\n\\n'),
							' as separator; mark rows are auto-delimited. Drag to reorder.',
						]),
						h(MarkedInput, {
							Mark: Chip,
							options: mentionOptions,
							value: value.value,
							drag: true,
							style: {...editorStyle, minHeight: '160px'},
							onChange: (v: string) => {
								value.value = v
							},
						}),
						h(Text, {label: 'Raw value:', value: value.value}),
					])
			},
		}),
}

// ─── Tag list: marks only ───────────────────────────────────────────────────

const TagChip = defineComponent({
	props: {value: String},
	setup(props) {
		return () =>
			h(
				'span',
				{
					style: {
						display: 'inline-block',
						padding: '3px 10px',
						borderRadius: 4,
						background: '#f1f3f4',
						color: '#333',
						fontSize: 13,
						fontFamily: 'monospace',
					},
				},
				`#${props.value}`
			)
	},
})

const tagOptions: Option[] = [{markup: '#[__value__]' as Markup}]

export const TagList: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref('#[react]#[typescript]#[drag-and-drop]#[editor]')
				return () =>
					h('div', {style: containerStyle}, [
						h('p', {style: {color: '#555', fontSize: 13, marginBottom: 8}}, [
							'Tag list where every row is a mark. No separators in the value string.',
						]),
						h(MarkedInput, {
							Mark: TagChip,
							options: tagOptions,
							value: value.value,
							drag: true,
							style: editorStyle,
							onChange: (v: string) => {
								value.value = v
							},
						}),
						h(Text, {label: 'Raw value:', value: value.value}),
					])
			},
		}),
}

// ─── Always-visible handles ──────────────────────────────────────────────────

export const AlwaysShowHandle: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref('@[Alice](alice)@[Bob](bob)@[Carol](carol)')
				return () =>
					h('div', {style: containerStyle}, [
						h(MarkedInput, {
							Mark: Chip,
							options: mentionOptions,
							value: value.value,
							drag: {alwaysShowHandle: true},
							style: editorStyle,
							onChange: (v: string) => {
								value.value = v
							},
						}),
						h(Text, {label: 'Raw value:', value: value.value}),
					])
			},
		}),
}

// ─── Nested marks inside a top-level mark ────────────────────────────────────

const NestedChip = defineComponent({
	props: {value: String, children: {type: null}, style: {type: Object}},
	setup(props, {slots}) {
		return () =>
			h(
				'span',
				{
					style: {
						display: 'inline-block',
						padding: '2px 10px',
						borderRadius: 14,
						background: '#e8f0fe',
						color: '#1a73e8',
						fontWeight: 500,
						fontSize: 13,
						...(props.style as Record<string, unknown>),
					},
				},
				slots.default?.() ?? props.value
			)
	},
})

const boldOptions: Option[] = [
	{
		markup: '@[__nested__](__meta__)' as Markup,
		mark: (props: MarkProps) => ({...props, style: {color: '#1a73e8'}}),
	},
	{
		markup: '**__nested__**' as Markup,
		mark: (props: MarkProps) => ({...props, style: {fontWeight: 700}}),
	},
]

export const NestedMarks: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref('@[Hello **world**](demo)@[**Bold** mention](bold)\n\nPlain text row')
				return () =>
					h('div', {style: containerStyle}, [
						h('p', {style: {color: '#555', fontSize: 13, marginBottom: 8}}, [
							'Nested marks stay inside their parent mark — they are NOT separate rows.',
						]),
						h(MarkedInput, {
							Mark: NestedChip,
							options: boldOptions,
							value: value.value,
							drag: true,
							style: {...editorStyle, minHeight: '140px'},
							onChange: (v: string) => {
								value.value = v
							},
						}),
						h(Text, {label: 'Raw value:', value: value.value}),
					])
			},
		}),
}

// ─── Plain text rows ─────────────────────────────────────────────────────────

export const PlainTextDrag: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref(`First block of plain text

Second block of plain text

Third block of plain text

Fourth block of plain text

Fifth block of plain text`)
				return () =>
					h('div', {style: {maxWidth: '700px', margin: '0 auto', paddingLeft: '52px'}}, [
						h(MarkedInput, {
							value: value.value,
							drag: true,
							style: {
								minHeight: '200px',
								padding: '12px',
								border: '1px solid #e0e0e0',
								borderRadius: '8px',
							},
							onChange: (v: string) => {
								value.value = v
							},
						}),
						h(Text, {label: 'Raw value:', value: value.value}),
					])
			},
		}),
}

// ─── Markdown with block-level marks (headings + list) ───────────────────────

const MarkdownMark = defineComponent({
	props: {value: String, children: {type: null}, style: {type: Object}},
	setup(props, {slots}) {
		return () =>
			h(
				'span',
				{style: {...(props.style as Record<string, unknown>), margin: '0 1px'}},
				slots.default?.() ?? props.value
			)
	},
})

const h1Style = {display: 'block', fontSize: '2em', fontWeight: 'bold', margin: '0.5em 0'}
const h2Style = {display: 'block', fontSize: '1.5em', fontWeight: 'bold', margin: '0.4em 0'}

const blockLevelMarkdownOptions: Option[] = [
	{
		markup: '# __nested__\n\n' as Markup,
		mark: (props: MarkProps) => ({...props, style: h1Style}),
	},
	{
		markup: '## __nested__\n\n' as Markup,
		mark: (props: MarkProps) => ({...props, style: h2Style}),
	},
	{
		markup: '- __nested__\n\n' as Markup,
		mark: (props: MarkProps) => ({...props, style: {display: 'block', paddingLeft: '1em'}}),
	},
] as Option[]

const mdContainerStyle = {maxWidth: '700px', margin: '0 auto', paddingLeft: '52px'}
const mdEditorStyle = {minHeight: '200px', padding: '12px', border: '1px solid #e0e0e0', borderRadius: '8px'}

export const MarkdownDrag: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref(`# Welcome to Draggable Blocks

This is the first paragraph. Hover to see the drag handle on the left.

This is the second paragraph. Try dragging it above the first one!

## Features

- Drag handles appear on hover
- Drop indicators show where the block will land
- Blocks reorder by manipulating the underlying string`)
				return () =>
					h('div', {style: mdContainerStyle}, [
						h(MarkedInput, {
							Mark: MarkdownMark,
							options: blockLevelMarkdownOptions,
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

export const ReadOnlyDrag: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = `# Read-Only Mode

Drag handles are hidden in read-only mode.

## Section A

Content cannot be reordered.

## Section B

This is static content.`
				return () =>
					h('div', {style: mdContainerStyle}, [
						h(MarkedInput, {
							Mark: MarkdownMark,
							options: blockLevelMarkdownOptions,
							value,
							readOnly: true,
							drag: true,
							style: mdEditorStyle,
						}),
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