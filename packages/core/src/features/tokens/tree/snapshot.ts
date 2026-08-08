import type {MarkToken, TextToken, Token} from '../parser/types'
import {annotate} from '../parser/utils/annotate'
import {joinNodes} from './tree'
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

	const children = node.children()
	// Same rule as joinNodes: children are the sole slot source (a slot mark always
	// has >=1 text child). The parser creates `slot` exactly when the markup has a
	// slot gap, so one gate drives both the projected content and the slot mirror.
	const slotText = node.descriptor.hasSlot ? joinNodes(children) : undefined
	const token: MarkToken = {
		type: 'mark',
		content: annotate(node.descriptor.markup, {value: node.value(), meta: node.meta(), slot: slotText}),
		position: {...node.position},
		id: node.id,
		descriptor: node.descriptor,
		value: node.value(),
		meta: node.meta(),
		slot: node.slot === undefined || slotText === undefined ? undefined : {...node.slot, content: slotText},
		children: snapshot(children),
	}
	return token
}

/** Deep-comparison helper for the equivalence properties: parsed tokens carry no ids. */
export function stripIds(tokens: readonly Token[]): Token[] {
	return tokens.map(token => {
		if (token.type === 'mark') {
			const {id: _id, ...rest} = token
			return {...rest, children: stripIds(token.children)}
		}
		const {id: _id, ...rest} = token
		return rest
	})
}