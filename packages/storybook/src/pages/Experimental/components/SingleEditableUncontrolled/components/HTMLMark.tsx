import {type MarkProps} from '@markput/react'

/**
 * HTMLMark - Renders marks as HTML <mark> elements
 *
 * Uses native <mark> tag with data attributes for metadata.
 * Visual styling similar to Obsidian's internal links.
 */
export const HTMLMark = ({value, meta, children}: MarkProps) => {
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
			{children ?? value}
		</mark>
	)
}