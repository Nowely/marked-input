import type {Meta, StoryObj} from '@storybook/react-vite'
import {MarkedInput} from 'rc-marked-input'
import type {MarkProps} from 'rc-marked-input'
import {forwardRef, useState, useCallback, useEffect, type HTMLAttributes, type ReactNode} from 'react'
import {Text} from '../../assets/Text'

export default {
	title: 'Experimental/Single ContentEditable',
	tags: ['autodocs'],
	component: MarkedInput,
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<Meta<typeof MarkedInput>>

// ============================================================================
// Custom Components for Single ContentEditable Approach
// ============================================================================

/**
 * CustomContainer - Container with single contentEditable
 *
 * This is the key component for Obsidian-like approach:
 * - Only this container has contentEditable={true}
 * - All children (text and marks) are rendered inside
 * - Browser handles all editing natively
 *
 * Important: We prevent the default 'input' event from reaching MarkedInput's
 * internal handler, and instead handle it ourselves in the story component.
 */
const CustomContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>((props, ref) => {
	const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
		// Prevent default paste behavior (which might include HTML)
		e.preventDefault()

		// Get only plain text from clipboard
		const text = e.clipboardData.getData('text/plain')

		// Insert plain text at cursor position
		document.execCommand('insertText', false, text)
	}, [])

	return (
		<div
			{...props}
			ref={ref}
			contentEditable={true}
			suppressContentEditableWarning
			onPaste={handlePaste}
			style={{
				minHeight: '100px',
				padding: '12px 16px',
				border: '1px solid #e0e0e0',
				borderRadius: '8px',
				fontSize: '14px',
				lineHeight: '1.6',
				fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
				outline: 'none',
				transition: 'border-color 0.2s',
				whiteSpace: 'pre-wrap',
				...props.style,
			}}
			onFocus={e => {
				e.currentTarget.style.borderColor = '#5b9dd9'
			}}
			onBlur={e => {
				e.currentTarget.style.borderColor = '#e0e0e0'
			}}
		/>
	)
})
CustomContainer.displayName = 'CustomContainer'

/**
 * PlainTextSpan - Renders text without contentEditable
 *
 * Since parent Container has contentEditable, we don't need it here.
 * Text is rendered as plain text node or non-editable span.
 */
interface TextSpanProps extends HTMLAttributes<HTMLSpanElement> {
	children?: ReactNode
}

const PlainTextSpan = ({children}: TextSpanProps) => {
	// Just render text as plain node (without span wrapper)
	// Browser will handle editing through parent contentEditable
	return <>{children}</>
}

/**
 * HTMLMark - Renders marks as HTML <mark> elements
 *
 * Uses native <mark> tag with data attributes for metadata.
 * Visual styling similar to Obsidian's internal links.
 */
const HTMLMark = ({value, meta, children}: MarkProps) => {
	return (
		<mark
			data-value={value}
			data-meta={meta}
			style={{
				backgroundColor: '#e8f3ff',
				color: '#1e6bb8',
				padding: '2px 4px',
				borderRadius: '4px',
				fontWeight: 500,
				border: '1px solid #b3d9ff',
				cursor: 'pointer',
				transition: 'background-color 0.15s',
			}}
			onMouseEnter={e => {
				e.currentTarget.style.backgroundColor = '#d0e8ff'
			}}
			onMouseLeave={e => {
				e.currentTarget.style.backgroundColor = '#e8f3ff'
			}}
		>
			{children || value}
		</mark>
	)
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Converts HTML from contentEditable container back to plain text with markup
 *
 * This function walks through DOM nodes and reconstructs the original text format:
 * - Text nodes → plain text
 * - <mark> elements → @[value](meta) format
 * - Nested content → recursive processing
 *
 * @param html - innerHTML from the contentEditable container
 * @returns Plain text with markup annotations
 */
function htmlToPlainText(html: string): string {
	// Create temporary element to parse HTML
	const temp = document.createElement('div')
	temp.innerHTML = html

	// Walk through nodes and convert to text
	function processNode(node: Node): string {
		if (node.nodeType === Node.TEXT_NODE) {
			return node.textContent || ''
		}

		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as HTMLElement

			// Handle <mark> elements - convert back to markup
			if (el.tagName === 'MARK') {
				// Read current text content (allows editing inside marks)
				const value = el.textContent || ''
				const meta = el.dataset.meta || ''
				return `@[${value}](${meta})`
			}

			// Handle line breaks
			if (el.tagName === 'BR') {
				return '\n'
			}

			// Handle div/p as line breaks (browser might insert them)
			if (el.tagName === 'DIV' || el.tagName === 'P') {
				const childText = Array.from(el.childNodes).map(processNode).join('')
				// Add newline before div/p content (except first one)
				return childText
			}

			// For other elements, process children
			return Array.from(el.childNodes).map(processNode).join('')
		}

		return ''
	}

	return Array.from(temp.childNodes).map(processNode).join('')
}

// ============================================================================
// Single Editable Components
// ============================================================================

interface SingleEditableControlledProps {
	onValueChange: (value: string) => void
}

/**
 * SingleEditableControlled - Encapsulates controlled contentEditable logic
 *
 * Manages its own state and re-renders on every change.
 * Notifies parent component via onValueChange callback.
 *
 * ⚠️ This demonstrates the PROBLEM with controlled contentEditable:
 * - React re-renders DOM on every change
 * - Cursor position resets
 * - Editing experience is broken
 */
const SingleEditableControlled = ({onValueChange}: SingleEditableControlledProps) => {
	const [value, setValue] = useState('Hello @[John](id:123) and @[World](greeting)!')
	const containerRef = useState<HTMLDivElement | null>(null)[1]

	const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
		const html = e.currentTarget.innerHTML
		const plainText = htmlToPlainText(html)
		setValue(plainText)
		onValueChange(plainText)
	}, [onValueChange])

	return (
		<MarkedInput
			key="single-editable-controlled"
			value={value}
			onChange={() => {}} // Not used - we use manual onInput instead
			Mark={HTMLMark}
			slots={{
				container: CustomContainer,
				span: PlainTextSpan,
			}}
			slotProps={{
				container: {
					ref: containerRef,
					onInput: handleInput,
				} as any,
			}}
		/>
	)
}

interface SingleEditableUncontrolledProps {
	onValueChange: (value: string) => void
}

/**
 * SingleEditableUncontrolled - Encapsulates uncontrolled contentEditable logic with MutationObserver
 *
 * Manages its own state and tracks changes via MutationObserver.
 * Cursor stays in place naturally.
 * Notifies parent component via onValueChange callback.
 *
 * This is the recommended approach for single contentEditable!
 */
const SingleEditableUncontrolled = ({onValueChange}: SingleEditableUncontrolledProps) => {
	const initialValue = 'Hello @[John](id:123) and @[World](greeting)! Try editing - cursor stays in place!'
	const [container, setContainer] = useState<HTMLDivElement | null>(null)

	useEffect(() => {
		if (!container) return

		const observer = new MutationObserver(() => {
			const html = container.innerHTML
			const plainText = htmlToPlainText(html)
			onValueChange(plainText)
		})

		observer.observe(container, {
			characterData: true,
			characterDataOldValue: true,
			childList: true,
			subtree: true,
		})

		return () => observer.disconnect()
	}, [container, onValueChange])

	return (
		<MarkedInput
			key="single-editable-uncontrolled"
			defaultValue={initialValue}
			Mark={HTMLMark}
			slots={{
				container: CustomContainer,
				span: PlainTextSpan,
			}}
			slotProps={{
				container: {
					ref: setContainer,
				} as any,
			}}
		/>
	)
}

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
