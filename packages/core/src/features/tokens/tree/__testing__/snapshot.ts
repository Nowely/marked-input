import type {MarkToken, RowToken, TextToken, Token} from '../../parser/types'
import {annotate} from '../../parser/utils/annotate'
import type {TreeNode} from '../types'

/**
 * TEST-ONLY, and it earns that: this is S1 §7.1's output-equivalence ORACLE — after every
 * adopt, `stripIds(snapshot(tree))` must deep-equal a fresh parse of the tree's projection.
 * `adopt.spec`, `adopt.property.spec`, `transactions.spec`, `valueBoundary.spec` and this
 * module's own spec all assert through it, and it is the only check that compares the
 * WHOLE tree — structure, positions, slot text, derived `content` — against the parser
 * rather than against a hand-written expectation.
 *
 * It used to be production: the compat `Token` projection both adapters rendered, memoized
 * by `tree/snapshotMemo.ts` and lowered by `seam/treeInput.ts`. S2.8 deleted all of that
 * (the adapters render `TreeNode` now), and the oracle is what stayed — deliberately
 * UNMEMOIZED, because a memo inside it would gate adoption against its own cache. The
 * `materializeNode` split that existed to feed the memo cached children went with it.
 *
 * Ids are included; {@link stripIds} takes them off for the comparison against a parse,
 * which carries none.
 */
export function snapshot(nodes: readonly TreeNode[], separator?: string): (Token | RowToken)[] {
	const lastRow = nodes.findLastIndex(node => node.kind === 'row')
	return nodes.map((node, index) => materializeNode(node, index < lastRow ? (separator ?? '') : ''))
}

function materializeNode(node: TreeNode, separator: string): Token | RowToken {
	if (node.kind === 'row') {
		const children = node.children().map(materializeInline)
		const body = children.map(child => child.content).join('')
		const descriptor = node.descriptor()
		const slotStart = children[0]?.position.start ?? node.position.start
		const token: RowToken = {
			type: 'row',
			// Same rule as `joinNodes`' row arm: the kind's markup wrapped around the body, and
			// the separator supplied by the JOIN rather than by the row.
			content:
				(descriptor ? annotate(descriptor.markup, {value: body, slot: body, meta: node.meta()}) : body) +
				separator,
			position: {...node.position},
			id: node.id,
			descriptor,
			meta: node.meta(),
			slot: {content: body, start: slotStart, end: children[children.length - 1]?.position.end ?? slotStart},
			children,
		}
		return token
	}
	return materializeInline(node)
}

/** A Row is never an inline child, so everything below a root materializes to `Token`. */
function materializeInline(node: TreeNode): Token {
	if (node.kind === 'row') throw new Error('A Row is never an inline child')

	if (node.kind === 'text') {
		const token: TextToken = {
			type: 'text',
			content: node.text(),
			position: {...node.position},
			id: node.id,
		}
		return token
	}

	const children = node.children().map(materializeInline)
	// Same rule as joinNodes: children are the sole slot source (a slot mark always has
	// >=1 text child), and the node stores no slot text to read instead. The parser creates
	// `slot` exactly when the markup has a slot gap, so one gate drives both the projected
	// content and the token's slot text.
	const slotText = node.descriptor.hasSlot ? children.map(child => child.content).join('') : undefined
	const token: MarkToken = {
		type: 'mark',
		content: annotate(node.descriptor.markup, {value: node.value(), meta: node.meta(), slot: slotText}),
		position: {...node.position},
		id: node.id,
		descriptor: node.descriptor,
		value: node.value(),
		meta: node.meta(),
		// The Token keeps a `content` mirror the node does not: it is derived here, from the
		// same children the projection uses.
		//
		// `slotText === undefined` is the type narrow, not a second runtime case: `hasSlot`
		// holds exactly when `slotRange !== undefined`, so the two disjuncts always agree.
		// Dropping it stops compiling (string | undefined into string).
		slot:
			node.slotRange === undefined || slotText === undefined
				? undefined
				: {content: slotText, start: node.slotRange.start, end: node.slotRange.end},
		children,
	}
	return token
}

/** Deep-comparison helper for the equivalence properties: parsed tokens carry no ids. */
export function stripIds(tokens: readonly Token[]): Token[]
export function stripIds(tokens: readonly (Token | RowToken)[]): (Token | RowToken)[]
export function stripIds(tokens: readonly (Token | RowToken)[]): (Token | RowToken)[] {
	// A mark's and a row's children are both `Token[]`, so the recursion takes the
	// narrow overload and the rebuilt token keeps its children type without a cast.
	return tokens.map(({id: _id, ...rest}) =>
		rest.type === 'text' ? rest : {...rest, children: stripIds(rest.children)}
	)
}