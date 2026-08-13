import type {CSSProperties} from '@markput/core'

/**
 * The tag-to-style table `ComplexHtmlDocument`'s mark renders each tag with. Framework-free by
 * contract: both fixtures modules read it, and `CSSProperties` comes from core, which is what
 * the adapters re-export anyway.
 */
export const HTML_TAG_STYLES: Record<string, CSSProperties> = {
	div: {
		display: 'block',
		padding: '10px',
		margin: '5px 0',
		border: '1px solid #e0e0e0',
		borderRadius: '4px',
		backgroundColor: '#fafafa',
	},
	p: {
		display: 'block',
		margin: '8px 0',
		lineHeight: '1.6',
	},
	h1: {
		display: 'block',
		fontSize: '2em',
		fontWeight: 'bold',
		margin: '0.67em 0',
	},
	h2: {
		display: 'block',
		fontSize: '1.5em',
		fontWeight: 'bold',
		margin: '0.75em 0',
	},
	h3: {
		display: 'block',
		fontSize: '1.17em',
		fontWeight: 'bold',
		margin: '0.83em 0',
	},
	strong: {
		fontWeight: 'bold',
	},
	b: {
		fontWeight: 'bold',
	},
	em: {
		fontStyle: 'italic',
	},
	i: {
		fontStyle: 'italic',
	},
	u: {
		textDecoration: 'underline',
	},
	mark: {
		backgroundColor: '#ffeb3b',
		padding: '2px 4px',
	},
	del: {
		textDecoration: 'line-through',
		opacity: 0.7,
	},
	code: {
		fontFamily: 'monospace',
		backgroundColor: '#f5f5f5',
		padding: '2px 6px',
		borderRadius: '3px',
		fontSize: '0.9em',
	},
	pre: {
		display: 'block',
		fontFamily: 'monospace',
		backgroundColor: '#f5f5f5',
		padding: '12px',
		borderRadius: '4px',
		overflow: 'auto',
		margin: '8px 0',
	},
	blockquote: {
		display: 'block',
		borderLeft: '4px solid #ccc',
		paddingLeft: '16px',
		margin: '8px 0',
		fontStyle: 'italic',
		color: '#666',
	},
	ul: {
		display: 'block',
		listStyleType: 'disc',
		paddingLeft: '40px',
		margin: '8px 0',
	},
	ol: {
		display: 'block',
		listStyleType: 'decimal',
		paddingLeft: '40px',
		margin: '8px 0',
	},
	li: {
		display: 'list-item',
		margin: '4px 0',
	},
	a: {
		color: '#1976d2',
		textDecoration: 'underline',
		cursor: 'pointer',
	},
	span: {
		display: 'inline',
	},
	article: {
		display: 'block',
		padding: '20px',
		backgroundColor: '#fff',
		border: '1px solid #ddd',
		borderRadius: '8px',
		margin: '10px 0',
	},
	section: {
		display: 'block',
		margin: '15px 0',
	},
	header: {
		display: 'block',
		padding: '10px',
		backgroundColor: '#f0f0f0',
		borderBottom: '2px solid #ddd',
		marginBottom: '10px',
	},
	footer: {
		display: 'block',
		padding: '10px',
		backgroundColor: '#f0f0f0',
		borderTop: '2px solid #ddd',
		marginTop: '10px',
		fontSize: '0.9em',
		color: '#666',
	},
	small: {
		fontSize: '0.8em',
	},
	sub: {
		fontSize: '0.8em',
		verticalAlign: 'sub',
	},
	sup: {
		fontSize: '0.8em',
		verticalAlign: 'super',
	},
}