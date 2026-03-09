import type {MarkProps, Markup, Option} from '@markput/vue'
import {MarkedInput} from '@markput/vue'
import type {Meta, StoryObj} from '@storybook/vue3-vite'
import {defineComponent, h, ref} from 'vue'

import Text from '../../shared/components/Text.vue'

export default {
	title: 'MarkedInput/Block',
	tags: ['autodocs'],
	component: MarkedInput,
	parameters: {
		docs: {
			description: {
				component:
					'Notion-like draggable blocks. Hover over a block to reveal the + and drag handle buttons. Drag to reorder, click + to add a block, click the grip to open a block menu (delete/duplicate).',
			},
		},
	},
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<Meta<typeof MarkedInput>>

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

const markdownOptions: Option[] = [
	{
		markup: '# __nested__\n\n' as Markup,
		mark: (props: MarkProps) => ({...props, style: h1Style}),
	},
] as Option[]

const containerStyle = {maxWidth: '700px', margin: '0 auto', paddingLeft: '52px'}
const editorStyle = {minHeight: '200px', padding: '12px', border: '1px solid #e0e0e0', borderRadius: '8px'}

export const BasicDraggable: Story = {
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
					h('div', {style: containerStyle}, [
						h(MarkedInput, {
							Mark: MarkdownMark,
							options: markdownOptions,
							value: value.value,
							block: true,
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

export const MarkdownDocument: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref(`# Welcome to **Marked Input**

This is a *powerful* library for parsing **rich text** with *markdown* formatting.
You can use \`inline code\` snippets like \`const parser = new ParserV2()\` in your text.

## Features

- **Bold text** with **strong emphasis**
- *Italic text* and *emphasis* support
- \`Code snippets\` and \`code blocks\`
- ~~Strikethrough~~ for deleted content
- Links like [GitHub](https://github.com)

## Example

Here's how to use it:

\`\`\`javascript
const parser = new ParserV2(['**__value__**', '*__value__*'])
const result = parser.parse('Hello **world**!')
\`\`\`

Visit our [documentation](https://docs.example.com) for more details.
~~This feature is deprecated~~ and will be removed in v3.0.`)
				return () =>
					h('div', {style: containerStyle}, [
						h(MarkedInput, {
							Mark: MarkdownMark,
							options: markdownOptions,
							value: value.value,
							block: true,
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

export const ReadOnlyDraggable: Story = {
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
					h('div', {style: containerStyle}, [
						h(MarkedInput, {
							Mark: MarkdownMark,
							options: markdownOptions,
							value,
							readOnly: true,
							block: true,
							style: editorStyle,
						}),
					])
			},
		}),
}

export const PlainTextBlocks: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref(`First block of plain text

Second block of plain text

Third block of plain text

Fourth block of plain text

Fifth block of plain text`)
				return () =>
					h('div', {style: containerStyle}, [
						h(MarkedInput, {
							value: value.value,
							block: true,
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