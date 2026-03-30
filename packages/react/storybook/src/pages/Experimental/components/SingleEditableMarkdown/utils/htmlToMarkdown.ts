/**
 * Converts HTML from contentEditable container back to markdown format
 *
 * This function walks through DOM nodes and reconstructs the original markdown format:
 * - Text nodes → plain text
 * - <strong> elements → **text** format
 * - <em> elements → *text* format
 * - <code> elements → `code` format
 * - <a> elements → [text](url) format
 * - Preserves line breaks and structure
 *
 * @param html - innerHTML from the contentEditable container
 * @returns Markdown text with formatting
 */
export function htmlToMarkdown(html: string): string {
	// Create temporary element to parse HTML
	const temp = document.createElement('div')
	temp.innerHTML = html

	// Walk through nodes and convert to markdown
	function processNode(node: Node): string {
		if (node.nodeType === Node.TEXT_NODE) {
			return node.textContent ?? ''
		}

		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as HTMLElement

			// Handle <strong> elements → **text**
			if (el.tagName === 'STRONG' || el.tagName === 'B') {
				const content = Array.from(el.childNodes).map(processNode).join('')
				return `**${content}**`
			}

			// Handle <em> elements → *text*
			if (el.tagName === 'EM' || el.tagName === 'I') {
				const content = Array.from(el.childNodes).map(processNode).join('')
				return `*${content}*`
			}

			// Handle <code> elements → `code`
			if (el.tagName === 'CODE') {
				const content = Array.from(el.childNodes).map(processNode).join('')
				return `\`${content}\``
			}

			// Handle <a> elements → [text](url)
			if (el.tagName === 'A') {
				const content = Array.from(el.childNodes).map(processNode).join('')
				const href = el.getAttribute('href') ?? ''
				return `[${content}](${href})`
			}

			// Handle <h1>-<h6> elements → # text
			if (el.tagName.match(/^H[1-6]$/)) {
				const level = parseInt(el.tagName[1])
				const content = Array.from(el.childNodes).map(processNode).join('')
				return `${'#'.repeat(level)} ${content}`
			}

			// Handle <blockquote> elements → > text
			if (el.tagName === 'BLOCKQUOTE') {
				const content = Array.from(el.childNodes).map(processNode).join('')
				return `> ${content}`
			}

			// Handle <li> elements → - text
			if (el.tagName === 'LI') {
				const content = Array.from(el.childNodes).map(processNode).join('')
				return `- ${content}`
			}

			// Handle line breaks
			if (el.tagName === 'BR') {
				return '\n'
			}

			// Handle div/p as line breaks (browser might insert them)
			if (el.tagName === 'DIV' || el.tagName === 'P') {
				const childText = Array.from(el.childNodes).map(processNode).join('')
				return childText
			}

			// Handle <ul>/<ol> elements
			if (el.tagName === 'UL' || el.tagName === 'OL') {
				const childText = Array.from(el.childNodes).map(processNode).join('')
				return childText
			}

			// For other elements, process children
			return Array.from(el.childNodes).map(processNode).join('')
		}

		return ''
	}

	return Array.from(temp.childNodes).map(processNode).join('').trim()
}