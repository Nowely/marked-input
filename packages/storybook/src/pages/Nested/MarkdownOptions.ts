import type {CSSProperties, Markup} from '@markput/core'

/**
 * Framework-free by contract: this preset is shared by the react-only `Nested` stories and by
 * `Drag`, so a react type here would keep it out of any vue or cross-framework story. `Markup`
 * and `CSSProperties` both come from core, which is what the adapters re-export anyway.
 */

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
		markup: '# __slot__',
		style: {
			display: 'block',
			fontSize: '2em',
			fontWeight: 'bold',
			margin: '0.5em 0',
		},
	},
	h2: {
		markup: '## __slot__',
		style: {
			display: 'block',
			fontSize: '1.5em',
			fontWeight: 'bold',
			margin: '0.4em 0',
		},
	},
	h3: {
		markup: '### __slot__',
		style: {
			display: 'block',
			fontSize: '1.17em',
			fontWeight: 'bold',
			margin: '0.83em 0',
		},
	},
	list: {
		markup: '- __slot__',
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

/**
 * The mark mapper stays generic in its props: each adapter has its own `MarkProps` (react's
 * `children` is a `ReactNode`, vue's a `VNodeChild`), and a generic pass-through is the one
 * shape that instantiates to either without naming a framework.
 */
function buildMarkdownOptions(theme: Record<string, MarkupPreset>) {
	return Object.values(theme).map((preset: MarkupPreset) => {
		return {
			markup: preset.markup,
			mark: <TProps extends object>(props: TProps) => ({...props, style: preset.style}),
		}
	})
}

/**
 * Markdown options ready for MarkedInput. The block-level markups carry NO separator
 * (issue 08, ADR-0009): in block layout the editor-level `separator` bounds each row and
 * an open trailing slot closes at the row boundary.
 */
export const markdownOptions = buildMarkdownOptions(defaultMarkdownTheme)

/** The theme keys whose marks are whole rows in block layout. */
const BLOCK_LEVEL = new Set(['h1', 'h2', 'h3', 'list'])

/**
 * INLINE layout's forms of the same options: with no structural separator there, a
 * block-level markup must be self-delimiting, so these re-bake the `\n\n` the block
 * forms dropped. Only the inline `Nested` page wants this shape.
 */
export const inlineMarkdownOptions = Object.entries(defaultMarkdownTheme).map(([key, preset]) => {
	// oxlint-disable-next-line no-unsafe-type-assertion -- appending a literal suffix keeps the placeholder shape
	const markup = (BLOCK_LEVEL.has(key) ? preset.markup + '\n\n' : preset.markup) as Markup
	return {
		markup,
		mark: <TProps extends object>(props: TProps) => ({...props, style: preset.style}),
	}
})