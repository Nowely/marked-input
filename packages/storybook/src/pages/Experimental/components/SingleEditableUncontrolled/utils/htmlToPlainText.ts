/**
 * Converts HTML from contentEditable container back to plain text with markup
 *
 * This function walks through DOM nodes and reconstructs the original text format:
 * - Text nodes → plain text
 * - <mark> elements → `@[value](meta)` format
 * - Nested content → recursive processing
 *
 * @param html - innerHTML from the contentEditable container
 * @returns Plain text with markup annotations
 */
export function htmlToPlainText(html: string): string {
	// Create temporary element to parse HTML
	const temp = document.createElement('div')
	temp.innerHTML = html

	// Walk through nodes and convert to text
	function processNode(node: Node): string {
		if (node.nodeType === Node.TEXT_NODE) {
			return node.textContent || ''
		}

		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as HTMLElement

			// Handle <mark> elements - convert back to markup
			if (el.tagName === 'MARK') {
				// Read current text content (allows editing inside marks)
				const value = el.textContent || ''
				const meta = el.dataset.meta || ''
				return `@[${value}](${meta})`
			}

			// Handle line breaks
			if (el.tagName === 'BR') {
				return '\n'
			}

			// Handle div/p as line breaks (browser might insert them)
			if (el.tagName === 'DIV' || el.tagName === 'P') {
				const childText = Array.from(el.childNodes).map(processNode).join('')
				// Add newline before div/p content (except first one)
				return childText
			}

			// For other elements, process children
			return Array.from(el.childNodes).map(processNode).join('')
		}

		return ''
	}

	return Array.from(temp.childNodes).map(processNode).join('')
}
