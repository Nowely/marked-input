import {type MarkProps} from 'rc-marked-input'

/**
 * MarkdownMark - Renders markdown formatting marks with distinct visual styles
 *
 * Supports: **bold**, *italic*, `code`, [link](url), # headings, > blockquotes
 * Visual styling for better readability and distinction while editing.
 *
 * The type prop is passed through slotProps.mark from each option configuration,
 * allowing different visual rendering for each markdown type.
 */
export const MarkdownMark = ({value, children, type = 'text'}: MarkProps & {type?: string}) => {
	// Use the type passed through slotProps.mark
	const markType = type

	// Default styling
	const baseStyle = {
		padding: '0 2px',
		borderRadius: '2px',
		transition: 'background-color 0.15s',
	}

	switch (markType) {
		case 'bold':
			return (
				<strong
					data-type="bold"
					style={{
						fontWeight: 'bold',
						color: '#1a1a1a',
						...baseStyle,
					}}
				>
					{children || value}
				</strong>
			)

		case 'italic':
			return (
				<em
					data-type="italic"
					style={{
						fontStyle: 'italic',
						color: '#333333',
						...baseStyle,
					}}
				>
					{children || value}
				</em>
			)

		case 'code':
			return (
				<code
					data-type="code"
					style={{
						backgroundColor: '#f0f0f0',
						color: '#d63384',
						fontFamily: 'Menlo, Monaco, "Courier New", monospace',
						fontSize: '0.9em',
						...baseStyle,
						padding: '2px 6px',
						borderRadius: '3px',
					}}
				>
					{children || value}
				</code>
			)

		case 'link':
			return (
				<a
					href={value}
					data-type="link"
					data-url={value}
					style={{
						color: '#0366d6',
						textDecoration: 'underline',
						cursor: 'pointer',
						...baseStyle,
					}}
					onClick={(e: React.MouseEvent) => {
						if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
							e.preventDefault()
						}
					}}
					onMouseEnter={e => {
						e.currentTarget.style.backgroundColor = 'rgba(3, 102, 214, 0.1)'
					}}
					onMouseLeave={e => {
						e.currentTarget.style.backgroundColor = 'transparent'
					}}
				>
					{children || value}
				</a>
			)

		case 'heading':
			return (
				<strong
					data-type="heading"
					style={{
						fontSize: '1.2em',
						fontWeight: 'bold',
						color: '#24292e',
						...baseStyle,
					}}
				>
					{children || value}
				</strong>
			)

		case 'blockquote':
			return (
				<span
					data-type="blockquote"
					style={{
						borderLeft: '4px solid #ddd',
						paddingLeft: '12px',
						color: '#666',
						fontStyle: 'italic',
						...baseStyle,
					}}
				>
					{children || value}
				</span>
			)

		default:
			return (
				<span data-type="text" style={baseStyle}>
					{children || value}
				</span>
			)
	}
}
