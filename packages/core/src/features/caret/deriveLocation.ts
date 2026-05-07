import type {CaretLocation, RawRange} from '../../shared/editorContracts'
import type {Token} from '../parsing'
import type {TokenIndex} from '../parsing/tokenIndex'

export function deriveLocation(
	range: RawRange | undefined,
	tokens: readonly Token[],
	index: TokenIndex
): CaretLocation | undefined {
	if (range === undefined) return undefined
	return findAt(range.start, tokens, [], index, 0)
}

function findAt(
	pos: number,
	tokens: readonly Token[],
	path: number[],
	index: TokenIndex,
	depth: number
): CaretLocation | undefined {
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i]
		if (pos < token.position.start || pos > token.position.end) continue
		const tokenPath = [...path, i]
		const address = index.addressFor(tokenPath)
		if (!address) return undefined
		if (token.type === 'mark' && token.children.length > 0) {
			const nested = findAt(pos, token.children, tokenPath, index, depth + 1)
			if (nested) return nested
		}
		if (token.type === 'text') return {address, role: 'text'}
		// depth > 0: nested mark inside a slot → 'markDescendant'
		// depth = 0: top-level mark (incl. drag-mode rows) → 'token'
		// 'row' is not produced; arrowNav only checks role !== 'text'
		return {address, role: depth > 0 ? 'markDescendant' : 'token'}
	}
	return undefined
}