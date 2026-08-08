import type {MarkToken, TextToken, Token} from '../parser/types'
import {annotate} from '../parser/utils/annotate'
import type {TreeNode} from './types'

/** Materialize plain Token snapshots (compat read shape). Ids included. */
export function snapshot(nodes: readonly TreeNode[]): Token[] {
	return nodes.map(snapshotNode)
}

function snapshotNode(node: TreeNode): Token {
	if (node.kind === 'text') {
		const token: TextToken = {
			type: 'text',
			content: node.text(),
			position: {...node.position},
			id: node.id,
		}
		return token
	}

	const children = snapshot(node.children())
	// Same rule as joinNodes: children are the sole slot source (a slot mark always
	// has >=1 text child), so the stored `slot.content` is never read back here. Each
	// child token already carries its own projection, so joining them keeps the whole
	// walk O(N) and lets a memoizing parent reuse cached children instead of
	// re-projecting them. The parser creates `slot` exactly when the markup has a slot
	// gap, so one gate drives both the projected content and the slot mirror.
	const slotText = node.descriptor.hasSlot ? children.map(child => child.content).join('') : undefined
	const token: MarkToken = {
		type: 'mark',
		content: annotate(node.descriptor.markup, {value: node.value(), meta: node.meta(), slot: slotText}),
		position: {...node.position},
		id: node.id,
		descriptor: node.descriptor,
		value: node.value(),
		meta: node.meta(),
		// `slotText === undefined` is the type narrow, not a second runtime case:
		// `hasSlot` holds exactly when `slot !== undefined`, so the two disjuncts always
		// agree. Dropping it stops compiling (string | undefined into string).
		slot: node.slot === undefined || slotText === undefined ? undefined : {...node.slot, content: slotText},
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