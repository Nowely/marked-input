import type {CSSProperties} from 'react'
import type {Markup, Option, MarkProps} from 'rc-marked-input'

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
		markup: '# __nested__\n',
		style: {
			display: 'block',
			fontSize: '2em',
			fontWeight: 'bold',
			margin: '0.5em 0',
		},
	},
	h2: {
		markup: '## __nested__\n',
		style: {
			display: 'block',
			fontSize: '1.5em',
			fontWeight: 'bold',
			margin: '0.4em 0',
		},
	},
	h3: {
		markup: '### __nested__\n',
		style: {
			display: 'block',
			fontSize: '1.17em',
			fontWeight: 'bold',
			margin: '0.83em 0',
		},
	},
	list: {
		markup: '- __nested__\n',
		style: {
			display: 'block',
			paddingLeft: '1em',
		},
	},
	bold: {
		markup: '**__nested__**',
		style: {
			fontWeight: 'bold',
		},
	},
	italic: {
		markup: '*__nested__*',
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
			slotProps: {
				mark: (props: MarkProps) => ({...props, style: preset.style}),
			},
		}
	})
}

/**
 * Markdown options ready for MarkedInput
 */
export const markdownOptions = buildMarkdownOptions(defaultMarkdownTheme)
