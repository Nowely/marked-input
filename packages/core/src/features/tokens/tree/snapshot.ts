import type {MarkToken, TextToken, Token} from '../parser/types'
import {annotate} from '../parser/utils/annotate'
import type {TreeNode} from './types'

const NO_CHILDREN: Token[] = []

/** Materialize plain Token snapshots (compat read shape). Ids included. */
export function snapshot(nodes: readonly TreeNode[]): Token[] {
	return nodes.map(node => materializeNode(node, node.kind === 'mark' ? snapshot(node.children()) : NO_CHILDREN))
}

/**
 * One node → one Token, given its children's tokens. Split out of `snapshot` so
 * `snapshotMemo` can feed CACHED child tokens instead of re-projecting them;
 * `snapshot` itself stays the pure, unmemoized §7.1 output-equivalence gate — a
 * memo inside it would gate adoption against its own cache. `children` is ignored
 * for text nodes.
 */
export function materializeNode(node: TreeNode, children: Token[]): Token {
	if (node.kind === 'text') {
		const token: TextToken = {
			type: 'text',
			content: node.text(),
			position: {...node.position},
			id: node.id,
		}
		return token
	}

	// Same rule as joinNodes: children are the sole slot source (a slot mark always has
	// >=1 text child), and the node stores no slot text to read instead. Each child token
	// already carries its own projection, so joining them keeps the whole walk O(N) and
	// lets a memoizing parent reuse cached children instead of re-projecting them. The
	// parser creates `slot` exactly when the markup has a slot gap, so one gate drives
	// both the projected content and the token's slot text.
	const slotText = node.descriptor.hasSlot ? children.map(child => child.content).join('') : undefined
	const token: MarkToken = {
		type: 'mark',
		content: annotate(node.descriptor.markup, {value: node.value(), meta: node.meta(), slot: slotText}),
		position: {...node.position},
		id: node.id,
		descriptor: node.descriptor,
		value: node.value(),
		meta: node.meta(),
		// The compat Token keeps a `content` mirror the node does not: it is derived here,
		// from the same children the projection uses.
		//
		// `slotText === undefined` is the type narrow, not a second runtime case:
		// `hasSlot` holds exactly when `slotRange !== undefined`, so the two disjuncts always
		// agree. Dropping it stops compiling (string | undefined into string).
		slot:
			node.slotRange === undefined || slotText === undefined
				? undefined
				: {content: slotText, start: node.slotRange.start, end: node.slotRange.end},
		children,
	}
	return token
}

/** Deep-comparison helper for the equivalence properties: parsed tokens carry no ids. */
export function stripIds(tokens: readonly Token[]): Token[] {
	return tokens.map(({id: _id, ...rest}) =>
		rest.type === 'mark' ? {...rest, children: stripIds(rest.children)} : rest
	)
}