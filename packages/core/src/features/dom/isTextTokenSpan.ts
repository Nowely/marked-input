export function isTextTokenSpan(el: HTMLElement): boolean {
	return (
		el.tagName === 'SPAN' &&
		(el.attributes.length === 0 || (el.attributes.length === 1 && el.hasAttribute('contenteditable')))
	)
}