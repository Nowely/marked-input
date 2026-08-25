import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'
import type {RowToken, Token} from '../parser/types'
import {createTokenTree, joinNodes} from '../tree/tree'
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
/** A block-mode PARAGRAPH row: no kind, and its body is the whole span it covers. */
export function rowToken(content: string, start: number, children: Token[]): RowToken {
	return {
		type: 'row',
		content,
		position: {start, end: start + content.length},
		slot: {content, start, end: start + content.length},
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
export function nodesOf(tokens: readonly (Token | RowToken)[]): readonly TreeNode[] {
	return createTokenTree(tokens).roots()
}
/**
 * The asserted SHAPE of a live tree: each root's kind, its own projection, and its range.
 *
 * The model specs used to read the deleted `tokens.current()` and match `{type, content, position}` on
 * the compat snapshot; these are the same three facts read off the nodes. Deliberately not
 * `__testing__/snapshot.ts` — that is S1 §7.1's output-equivalence ORACLE, and a model spec
 * asserting through it would be checking the model against the tree layer's own comparison
 * rather than against the fact it means.
 */
export function treeShape(
	nodes: readonly TreeNode[]
): {kind: string; content: string; position: {start: number; end: number}}[] {
	return nodes.map(node => ({kind: node.kind, content: joinNodes([node]), position: node.range()}))
}