import type {MarkProps, Markup, Option} from '@markput/react'
import type {CSSProperties} from 'react'

/**
 * Preset configuration for a single markdown markup
 */
export interface MarkupPreset {
	markup: Markup
	style?: CSSProperties
}

/**
 * Default light theme for markdown
 */
export const defaultMarkdownTheme: Record<string, MarkupPreset> = {
	h1: {
		markup: '# __slot__\n\n',
		style: {
			display: 'block',
			fontSize: '2em',
			fontWeight: 'bold',
			margin: '0.5em 0',
		},
	},
	h2: {
		markup: '## __slot__\n\n',
		style: {
			display: 'block',
			fontSize: '1.5em',
			fontWeight: 'bold',
			margin: '0.4em 0',
		},
	},
	h3: {
		markup: '### __slot__\n\n',
		style: {
			display: 'block',
			fontSize: '1.17em',
			fontWeight: 'bold',
			margin: '0.83em 0',
		},
	},
	list: {
		markup: '- __slot__\n\n',
		style: {
			display: 'block',
			paddingLeft: '1em',
		},
	},
	bold: {
		markup: '**__slot__**',
		style: {
			fontWeight: 'bold',
		},
	},
	italic: {
		markup: '*__slot__*',
		style: {
			fontStyle: 'italic',
		},
	},
	code: {
		markup: '`__value__`',
		style: {
			backgroundColor: '#f6f8fa',
			padding: '2px 6px',
			borderRadius: '3px',
			fontFamily: 'monospace',
			fontSize: '0.9em',
		},
	},
	codeBlock: {
		markup: '```__meta__\n__value__```',
		style: {
			display: 'block',
			backgroundColor: '#f6f8fa',
			padding: '12px',
			borderRadius: '6px',
			fontFamily: 'monospace',
			fontSize: '0.9em',
			whiteSpace: 'pre-wrap',
			border: '1px solid #d1d9e0',
			margin: '8px 0',
		},
	},
	link: {
		markup: '[__value__](__meta__)',
		style: {
			color: '#0969da',
			textDecoration: 'underline',
			cursor: 'pointer',
		},
	},
	strikethrough: {
		markup: '~~__value__~~',
		style: {
			textDecoration: 'line-through',
			opacity: 0.7,
		},
	},
}

function buildMarkdownOptions(theme: Record<string, MarkupPreset>): Option[] {
	return Object.values(theme).map((preset: MarkupPreset) => {
		return {
			markup: preset.markup,
			mark: (props: MarkProps) => ({...props, style: preset.style}),
		}
	})
}

/**
 * Markdown options ready for MarkedInput
 */
export const markdownOptions = buildMarkdownOptions(defaultMarkdownTheme)

/**
 * Block-level markdown options only (those whose markup includes \n\n).
 * Use in drag mode so inline marks (bold, italic, code, link, strikethrough)
 * are not each split into their own draggable row.
 */
export const blockLevelMarkdownOptions = markdownOptions.filter(opt => (opt.markup as string).includes('\n\n'))