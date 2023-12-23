export function getNodeIndex(node: HTMLElement) {
	return [...node!.parentElement!.children].indexOf(node)
}