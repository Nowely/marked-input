const tracked = new Set<HTMLElement>()

export function createEditableDiv(): HTMLDivElement {
	const element = document.createElement('div')
	element.contentEditable = 'true'
	document.body.appendChild(element)
	tracked.add(element)
	return element
}

export function cleanup(): void {
	for (const element of tracked) {
		element.remove()
	}
	tracked.clear()
}