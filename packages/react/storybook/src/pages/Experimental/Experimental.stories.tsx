import {MarkedInput} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'
import {useState} from 'react'

import {Text} from '../../shared/components/Text'
import {SingleEditableControlled} from './components/SingleEditableControlled'
import {SingleEditableMarkdown} from './components/SingleEditableMarkdown'
import {SingleEditableUncontrolled} from './components/SingleEditableUncontrolled'

export default {
	title: 'Experimental/Single ContentEditable',
	tags: ['autodocs'],
	component: MarkedInput,
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<Meta<typeof MarkedInput>>

// ============================================================================
// Story Examples
// ============================================================================

/**
 * Controlled approach (React manages content via `value` prop)
 *
 * ⚠️ This demonstrates the PROBLEM with controlled contentEditable:
 * - React re-renders DOM on every change
 * - Cursor position resets
 * - Editing experience is broken
 *
 * This story shows WHY we need the uncontrolled approach.
 */
export const Controlled: Story = {
	render: () => {
		const [value, setValue] = useState('')

		return (
			<>
				<div style={{marginBottom: '16px'}}>
					<h3 style={{marginTop: 0}}>❌ Controlled (React-managed)</h3>
				</div>

				<SingleEditableControlled onValueChange={setValue} />

				<Text label="Plain text value:" value={value} />
			</>
		)
	},
}

/**
 * Uncontrolled approach with MutationObserver (WORKING SOLUTION ✅)
 *
 * This demonstrates the SOLUTION:
 * - React doesn't manage content (uses `defaultValue`)
 * - MutationObserver tracks changes instead
 * - Cursor stays in place naturally
 * - Smooth, native editing experience
 *
 * This is the recommended approach for single contentEditable!
 */
export const Uncontrolled: Story = {
	render: () => {
		const [value, setValue] = useState('')

		return (
			<>
				<div style={{marginBottom: '16px'}}>
					<h3 style={{marginTop: 0}}>✅ Uncontrolled (MutationObserver)</h3>
				</div>

				<SingleEditableUncontrolled onValueChange={setValue} />

				<Text label="Plain text value:" value={value} />
			</>
		)
	},
}

/**
 * Markdown Editor
 *
 * Uncontrolled markdown editor with support for:
 * - **bold** text
 * - *italic* text
 * - `code` formatting
 * - [links](url)
 * - # headings
 * - > blockquotes
 *
 * Uses the same uncontrolled approach with MutationObserver for smooth editing!
 */
export const Markdown: Story = {
	render: () => {
		const [value, setValue] = useState('')

		return (
			<>
				<div style={{marginBottom: '16px'}}>
					<h3 style={{marginTop: 0}}>📝 Markdown (Uncontrolled)</h3>
				</div>

				<SingleEditableMarkdown onValueChange={setValue} />

				<Text label="Markdown value:" value={value} />
			</>
		)
	},
}