import {MarkedInput} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'
import type {ReactNode} from 'react'
import {useState} from 'react'

import {Text} from '../../shared/components/Text'
import {markdownOptions} from '../Nested/MarkdownOptions'

export default {
	title: 'MarkedInput/DraggableBlocks',
	tags: ['autodocs'],
	component: MarkedInput,
	parameters: {
		docs: {
			description: {
				component:
					'Notion-like draggable blocks. Hover over a block to reveal the drag handle on the left, then drag to reorder.',
			},
		},
	},
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<Meta<typeof MarkedInput>>

const MarkdownMark = ({
	children,
	value,
	style,
}: {
	value?: string
	children?: ReactNode
	style?: React.CSSProperties
}) => <span style={{...style, margin: '0 1px'}}>{children || value}</span>

export const BasicDraggable: Story = {
	render: () => {
		const [value, setValue] = useState(
			`# Welcome to Draggable Blocks
This is the first paragraph. Hover to see the drag handle on the left.
This is the second paragraph. Try dragging it above the first one!
## Features
- Drag handles appear on hover
- Drop indicators show where the block will land
- Blocks reorder by manipulating the underlying string`
		)

		return (
			<div style={{maxWidth: 700, margin: '0 auto', paddingLeft: 32}}>
				<MarkedInput
					Mark={MarkdownMark}
					options={markdownOptions}
					value={value}
					onChange={setValue}
					block
					style={{minHeight: 200, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
				<Text label="Raw value:" value={value} />
			</div>
		)
	},
}

export const MarkdownDocument: Story = {
	render: () => {
		const [value, setValue] = useState(`# Project Roadmap
## Phase 1: Foundation
Build the core parsing engine with support for nested markup patterns.
## Phase 2: Rich Text
Add markdown-style formatting: **bold**, *italic*, \`code\`, and ~~strikethrough~~.
## Phase 3: Collaboration
Implement real-time collaboration with conflict resolution.
## Phase 4: Extensions
Create a plugin system for custom markup patterns.`)

		return (
			<div style={{maxWidth: 700, margin: '0 auto', paddingLeft: 32}}>
				<MarkedInput
					Mark={MarkdownMark}
					options={markdownOptions}
					value={value}
					onChange={setValue}
					block
					style={{minHeight: 200, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
				<Text label="Raw value:" value={value} />
			</div>
		)
	},
}

export const ReadOnlyDraggable: Story = {
	render: () => {
		const value = `# Read-Only Mode
Drag handles are hidden in read-only mode.
## Section A
Content cannot be reordered.
## Section B
This is static content.`

		return (
			<div style={{maxWidth: 700, margin: '0 auto', paddingLeft: 32}}>
				<MarkedInput
					Mark={MarkdownMark}
					options={markdownOptions}
					value={value}
					readOnly
					block
					style={{minHeight: 200, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
			</div>
		)
	},
}

export const PlainTextBlocks: Story = {
	render: () => {
		const [value, setValue] = useState(
			`First block of plain text
Second block of plain text
Third block of plain text
Fourth block of plain text
Fifth block of plain text`
		)

		return (
			<div style={{maxWidth: 700, margin: '0 auto', paddingLeft: 32}}>
				<MarkedInput
					value={value}
					onChange={setValue}
					block
					style={{minHeight: 200, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8}}
				/>
				<Text label="Raw value:" value={value} />
			</div>
		)
	},
}