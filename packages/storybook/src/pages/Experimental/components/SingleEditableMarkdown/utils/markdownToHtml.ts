/**
 * Parses markdown text and returns structured data for rendering
 *
 * This simple parser handles:
 * - **bold** text
 * - *italic* text
 * - `code` blocks
 * - [link](url) syntax
 * - # heading text
 * - > blockquote text
 * - Line breaks
 *
 * Returns array of tokens for rendering
 *
 * @param markdown - Markdown text
 * @returns Array of parsed tokens
 */
export interface MarkdownToken {
	type: 'text' | 'bold' | 'italic' | 'code' | 'link' | 'heading' | 'blockquote' | 'break'
	content?: string
	url?: string
	level?: number // for headings
}

export function parseMarkdown(markdown: string): MarkdownToken[] {
	const tokens: MarkdownToken[] = []
	let i = 0
	const text = markdown

	while (i < text.length) {
		// Check for heading
		if (text[i] === '#' && (i === 0 || text[i - 1] === '\n')) {
			let level = 0
			while (i < text.length && text[i] === '#') {
				level++
				i++
			}

			if (text[i] === ' ') {
				i++ // skip space
				let content = ''
				while (i < text.length && text[i] !== '\n') {
					content += text[i]
					i++
				}
				tokens.push({type: 'heading', content: content.trim(), level})
				if (text[i] === '\n') {
					tokens.push({type: 'break'})
					i++
				}
				continue
			}
		}

		// Check for blockquote
		if (text[i] === '>' && (i === 0 || text[i - 1] === '\n')) {
			i++ // skip >
			if (text[i] === ' ') i++ // skip space
			let content = ''
			while (i < text.length && text[i] !== '\n') {
				content += text[i]
				i++
			}
			tokens.push({type: 'blockquote', content})
			if (text[i] === '\n') {
				tokens.push({type: 'break'})
				i++
			}
			continue
		}

		// Check for line breaks
		if (text[i] === '\n') {
			tokens.push({type: 'break'})
			i++
			continue
		}

		// Check for bold **text**
		if (text[i] === '*' && text[i + 1] === '*') {
			i += 2 // skip **
			let content = ''
			while (i < text.length && !(text[i] === '*' && text[i + 1] === '*')) {
				content += text[i]
				i++
			}
			if (i < text.length) i += 2 // skip closing **
			tokens.push({type: 'bold', content})
			continue
		}

		// Check for italic *text*
		if (text[i] === '*') {
			i++ // skip *
			let content = ''
			while (i < text.length && text[i] !== '*') {
				content += text[i]
				i++
			}
			if (i < text.length) i++ // skip closing *
			tokens.push({type: 'italic', content})
			continue
		}

		// Check for code `text`
		if (text[i] === '`') {
			i++ // skip `
			let content = ''
			while (i < text.length && text[i] !== '`') {
				content += text[i]
				i++
			}
			if (i < text.length) i++ // skip closing `
			tokens.push({type: 'code', content})
			continue
		}

		// Check for link [text](url)
		if (text[i] === '[') {
			i++ // skip [
			let linkText = ''
			while (i < text.length && text[i] !== ']') {
				linkText += text[i]
				i++
			}
			if (i < text.length) i++ // skip ]

			if (text[i] === '(') {
				i++ // skip (
				let url = ''
				while (i < text.length && text[i] !== ')') {
					url += text[i]
					i++
				}
				if (i < text.length) i++ // skip )
				tokens.push({type: 'link', content: linkText, url})
				continue
			} else {
				// Not a valid link, treat as text
				tokens.push({type: 'text', content: `[${linkText}]`})
				continue
			}
		}

		// Regular text
		let content = ''
		while (
			i < text.length &&
			text[i] !== '*' &&
			text[i] !== '`' &&
			text[i] !== '[' &&
			text[i] !== '\n' &&
			text[i] !== '#' &&
			text[i] !== '>'
		) {
			content += text[i]
			i++
		}

		if (content) {
			tokens.push({type: 'text', content})
		}
	}

	return tokens
}
