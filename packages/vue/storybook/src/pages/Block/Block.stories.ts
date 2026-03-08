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

const markdownOptions: Option[] = [
	{
		markup: '# __nested__\n' as Markup,
		mark: (p: MarkProps) => ({
			...p,
			style: {display: 'block', fontSize: '2em', fontWeight: 'bold', margin: '0.5em 0'},
		}),
	},
	{
		markup: '## __nested__\n' as Markup,
		mark: (p: MarkProps) => ({
			...p,
			style: {display: 'block', fontSize: '1.5em', fontWeight: 'bold', margin: '0.4em 0'},
		}),
	},
	{
		markup: '### __nested__\n' as Markup,
		mark: (p: MarkProps) => ({
			...p,
			style: {display: 'block', fontSize: '1.17em', fontWeight: 'bold', margin: '0.83em 0'},
		}),
	},
	{
		markup: '- __nested__\n' as Markup,
		mark: (p: MarkProps) => ({...p, style: {display: 'block', paddingLeft: '1em'}}),
	},
	{markup: '**__nested__**' as Markup, mark: (p: MarkProps) => ({...p, style: {fontWeight: 'bold'}})},
	{markup: '*__nested__*' as Markup, mark: (p: MarkProps) => ({...p, style: {fontStyle: 'italic'}})},
	{
		markup: '`__value__`' as Markup,
		mark: (p: MarkProps) => ({
			...p,
			style: {
				backgroundColor: '#f6f8fa',
				padding: '2px 6px',
				borderRadius: '3px',
				fontFamily: 'monospace',
				fontSize: '0.9em',
			},
		}),
	},
]

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
				const value = ref(`# Project Roadmap

## Phase 1: Foundation

Build the core parsing engine with support for nested markup patterns.

## Phase 2: Rich Text

Add markdown-style formatting: **bold**, *italic*, \`code\`.

## Phase 3: Collaboration

Implement real-time collaboration with conflict resolution.

## Phase 4: Extensions

Create a plugin system for custom markup patterns.`)
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