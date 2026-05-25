import type {TokenIndex} from '../parsing/tokenIndex'
import type {TokenNode} from './types'

export function reconcileTextSurfaces(
	nodes: Iterable<TokenNode>,
	tokenIndex: TokenIndex,
	options: {editable: boolean; readOnly: boolean}
): void {
	const editableAttr = options.editable ? 'true' : 'false'

	for (const node of nodes) {
		const resolved = tokenIndex.resolveAddress(node.address)
		if (!resolved) continue

		if (node.textElement) {
			if (resolved.type !== 'text') continue
			if (node.textElement.textContent !== resolved.content) {
				node.textElement.textContent = resolved.content
			}
			node.textElement.contentEditable = editableAttr
			continue
		}

		if (resolved.type === 'mark') {
			if (options.readOnly) {
				node.tokenElement.removeAttribute('tabindex')
			} else {
				node.tokenElement.tabIndex = 0
			}
		}
	}
}