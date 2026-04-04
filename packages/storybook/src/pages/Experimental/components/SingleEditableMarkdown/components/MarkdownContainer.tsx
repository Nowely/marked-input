import {type HTMLAttributes, useCallback} from 'react'

type Props = HTMLAttributes<HTMLDivElement> & {ref?: React.Ref<HTMLDivElement>}

/**
 * MarkdownContainer - Container with contentEditable for markdown
 *
 * Similar to CustomContainer but optimized for markdown editing:
 * - Only this container has contentEditable={true}
 * - Renders markdown content with formatting preserved
 * - Browser handles all editing natively
 */
export function MarkdownContainer({ref, ...props}: Props) {
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
				fontFamily: 'Menlo, Monaco, "Courier New", monospace',
				outline: 'none',
				transition: 'border-color 0.2s',
				whiteSpace: 'pre-wrap',
				backgroundColor: '#fafafa',
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