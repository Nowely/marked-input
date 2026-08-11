import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'
import type {Token} from '../parser/types'
import {createTokenTree} from '../tree/tree'
import type {TreeNode} from '../tree/types'

// oxlint-disable-next-line no-unsafe-type-assertion -- test fixture: the model specs never read descriptor fields
const descriptor = {} as MarkupDescriptor

export function textToken(content: string, start: number): Token {
	return {type: 'text', content, position: {start, end: start + content.length}}
}

export function markToken(value: string, content: string, start: number, children: Token[] = []): Token {
	return {
		type: 'mark',
		content,
		value,
		position: {start, end: start + content.length},
		descriptor,
		children,
	}
}
/**
 * The same fixtures as LIVE nodes, for the consumers that address rows and marks as
 * `TreeNode` since S2.8. Built through the tree so the nodes are the real thing —
 * signal-backed `text`/`value`, allocated ids, `slotRange` derived from the token's
 * `slot` — rather than a hand-forged literal that would drift from `TreeNode`.
 * Unwired, so `update`/`remove` answer `false` (see `createTokenTree`).
 */
export function nodesOf(tokens: readonly Token[]): readonly TreeNode[] {
	return createTokenTree(tokens).roots()
}