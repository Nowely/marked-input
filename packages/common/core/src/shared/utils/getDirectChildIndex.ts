/**
 * Returns the index of the direct child of `container` that contains `target`,
 * or -1 if `target` is not inside any direct child.
 */
export function getDirectChildIndex(container: HTMLElement, target: EventTarget | null): number {
	if (!target || !(target instanceof Node)) return -1
	let node: Node | null = target as Node
	while (node && node.parentNode !== container) {
		node = node.parentNode
	}
	if (!node) return -1
	return Array.from(container.children).indexOf(node as Element)
}