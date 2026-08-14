const INLINE_ELEMENT = 'span'

export function snapshotHtml(html: string): string {
	const template = document.createElement('template')
	template.innerHTML = html
	stripUnstableAttributes(template.content)

	return formatChildren(template.content, 0).join('\n')
}

function stripUnstableAttributes(parent: ParentNode): void {
	for (const element of parent.querySelectorAll('[class],[style]')) {
		element.removeAttribute('class')
		element.removeAttribute('style')
	}
}

function formatChildren(parent: Node, depth: number): string[] {
	return Array.from(parent.childNodes).flatMap(child => formatNode(child, depth))
}

function formatNode(node: ChildNode, depth: number): string[] {
	if (node instanceof Text) {
		if (node.data === '') return []
		return [`${indent(depth)}${serializeText(node.data)}`]
	}

	// Framework bookkeeping, not rendered content: Vue leaves `<!--v-if-->` and `<!---->`
	// placeholders where a conditional or an empty fragment sits, React leaves nothing. Keeping
	// them would make the two frameworks' snapshots differ over something no user can see.
	if (node instanceof Comment) {
		return []
	}

	if (node instanceof Element) {
		return formatElement(node, depth)
	}

	return []
}

function formatElement(element: Element, depth: number): string[] {
	if (element.childNodes.length === 0 || hasOnlyTextChildren(element)) {
		return [`${indent(depth)}${serializeInline(element.outerHTML)}`]
	}

	const shellElement = element.cloneNode(false)
	if (!(shellElement instanceof Element)) {
		return [`${indent(depth)}${serializeInline(element.outerHTML)}`]
	}

	const shell = shellElement.outerHTML
	const closeTag = `</${element.localName}>`

	if (!shell.endsWith(closeTag)) {
		return [`${indent(depth)}${serializeInline(element.outerHTML)}`]
	}

	const openTag = shell.slice(0, -closeTag.length)
	return [`${indent(depth)}${openTag}`, ...formatChildren(element, depth + 1), `${indent(depth)}${closeTag}`]
}

function hasOnlyTextChildren(element: Element): boolean {
	return Array.from(element.childNodes).every(child => child instanceof Text)
}

function serializeText(value: string): string {
	const wrapper = document.createElement(INLINE_ELEMENT)
	wrapper.textContent = value
	return serializeInline(wrapper.innerHTML)
}

function serializeInline(value: string): string {
	return value.replaceAll('\r\n', '&#10;').replaceAll('\n', '&#10;').replaceAll('\r', '&#13;')
}

function indent(depth: number): string {
	return '  '.repeat(depth)
}