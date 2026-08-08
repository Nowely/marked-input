import type {Computed, Signal} from '../../../shared/signals'
import {computed, signal} from '../../../shared/signals'
import type {Token} from '../parser/types'
import {annotate} from '../parser/utils/annotate'
import type {Id, MarkNode, TextNode, TreeNode} from './types'

export interface TokenTree {
	// NOT ReturnType<typeof signal<...>> — instantiation picks the last overload
	// (Signal<T | undefined>) and poisons every consumer with `| undefined`.
	readonly roots: Signal<readonly TreeNode[]>
	readonly value: Computed<string>
	/** Allocates fresh ids from the tree-local counter; adoption builds its new nodes through it. */
	readonly buildNode: (token: Token) => TreeNode
}

export function createTokenTree(tokens: readonly Token[]): TokenTree {
	let nextId = 1
	const alloc = (): Id => nextId++

	const buildNode = (token: Token): TreeNode => {
		if (token.type === 'text') {
			const node: TextNode = {
				kind: 'text',
				id: alloc(),
				text: signal({initial: token.content}),
				position: {...token.position},
			}
			return node
		}
		const node: MarkNode = {
			kind: 'mark',
			id: alloc(),
			descriptor: token.descriptor,
			value: signal({initial: token.value}),
			meta: signal({initial: token.meta}),
			// Explicit generic: inferred `Signal<TreeNode[]>` is not assignable to
			// `Signal<readonly TreeNode[]>` (the write signature is contravariant).
			children: signal<readonly TreeNode[]>({initial: token.children.map(buildNode)}),
			// Field-wise, not a spread of `token.slot`: the token carries a `content` mirror
			// the node deliberately does not keep (see `MarkNode.slot`).
			slot: token.slot ? {start: token.slot.start, end: token.slot.end} : undefined,
			position: {...token.position},
		}
		return node
	}

	// Explicit generic for the same reason as `children` above.
	const roots = signal<readonly TreeNode[]>({initial: tokens.map(buildNode)})

	const value = computed(() => joinNodes(roots()))

	return {roots, value, buildNode}
}

/** The string projection: mirrors parser/utils/toString over live nodes. */
export function joinNodes(nodes: readonly TreeNode[]): string {
	let result = ''

	for (const node of nodes) {
		if (node.kind === 'text') {
			result += node.text()
			continue
		}

		// A slot mark always parses with >=1 text child, and empty-text filtering is top-level
		// only — children are the sole slot source; the node stores no slot text.
		const slot = node.descriptor.hasSlot ? joinNodes(node.children()) : undefined

		result += annotate(node.descriptor.markup, {value: node.value(), meta: node.meta(), slot})
	}

	return result
}