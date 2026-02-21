import {type HTMLAttributes, useCallback} from 'react'

type Props = HTMLAttributes<HTMLDivElement> & {ref?: React.Ref<HTMLDivElement>}

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
export function CustomContainer({ref, ...props}: Props) {
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
}
