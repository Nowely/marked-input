import type {Computed, Signal} from '../../../shared/signals'
import {computed, signal} from '../../../shared/signals'
import type {Token} from '../parser/types'
import {annotate} from '../parser/utils/annotate'
import type {Id, MarkCommands, MarkNode, TextNode, TreeNode} from './types'

export interface TokenTree {
	// NOT ReturnType<typeof signal<...>> — instantiation picks the last overload
	// (Signal<T | undefined>) and poisons every consumer with `| undefined`.
	readonly roots: Signal<readonly TreeNode[]>
	readonly value: Computed<string>
	/** Allocates fresh ids from the tree-local counter; adoption builds its new nodes through it. */
	readonly buildNode: (token: Token) => TreeNode
}

export function createTokenTree(
	tokens: readonly Token[],
	/**
	 * Spec §2.3's `mark.update`/`mark.remove`. Optional because the tree is built UNWIRED in
	 * the specs and in the §7.1 snapshot gate, where there is no transaction layer to write
	 * through; an unwired node's verbs answer `false`, which is the same fail-closed answer a
	 * dead node gives.
	 */
	commands?: () => MarkCommands | undefined
): TokenTree {
	let nextId = 1
	const alloc = (): Id => nextId++

	const buildNode = (token: Token): TreeNode => {
		if (token.type === 'text') {
			const node: TextNode = {
				kind: 'text',
				id: alloc(),
				text: signal({initial: token.content}),
				position: {...token.position},
				range: () => ({...node.position}),
			}
			return node
		}
		const node: MarkNode = {
			kind: 'mark',
			id: alloc(),
			descriptor: token.descriptor,
			// A plain field, not a getter: `descriptor` is readonly and `descriptor.markup` is
			// immutable, so the two cannot diverge, and the node stays a plain data object the
			// equality helpers walk without surprises.
			markup: token.descriptor.markup,
			value: signal({initial: token.value}),
			meta: signal({initial: token.meta}),
			// Explicit generic: inferred `Signal<TreeNode[]>` is not assignable to
			// `Signal<readonly TreeNode[]>` (the write signature is contravariant).
			children: signal<readonly TreeNode[]>({initial: token.children.map(buildNode)}),
			// Field-wise, not a spread of `token.slot`: the token carries a `content` mirror
			// the node deliberately does not keep (see `MarkNode.slotRange`).
			slotRange: token.slot ? {start: token.slot.start, end: token.slot.end} : undefined,
			position: {...token.position},
			// Same rule as joinNodes and materializeNode: a slot mark always parses with >=1
			// text child, so children are the sole slot source.
			slot: () => (node.descriptor.hasSlot ? joinNodes(node.children()) : undefined),
			range: () => ({...node.position}),
			update: patch => commands?.()?.update(node, patch) ?? false,
			remove: () => commands?.()?.remove(node) ?? false,
		}
		return node
	}

	// Explicit generic for the same reason as `children` above.
	const roots = signal<readonly TreeNode[]>({initial: tokens.map(buildNode)})

	const value = computed(() => joinNodes(roots()))

	return {roots, value, buildNode}
}

/** Depth-first id lookup over live nodes (spec §2.3's `input.find`). */
export function findNode(nodes: readonly TreeNode[], id: Id): TreeNode | undefined {
	for (const node of nodes) {
		if (node.id === id) return node
		if (node.kind === 'mark') {
			const found = findNode(node.children(), id)
			if (found) return found
		}
	}
	return undefined
}

/** Index of the ROOT whose subtree contains `id` — the block row index, off ids instead of a handle's frozen path. */
export function rootIndexOf(roots: readonly TreeNode[], id: Id): number | undefined {
	for (let index = 0; index < roots.length; index++) {
		if (containsNode(roots[index], id)) return index
	}
	return undefined
}

function containsNode(node: TreeNode, id: Id): boolean {
	if (node.id === id) return true
	return node.kind === 'mark' && node.children().some(child => containsNode(child, id))
}

/** The node's previous (-1) or next (+1) sibling within its OWN parent's child list. */
export function siblingOf(roots: readonly TreeNode[], id: Id, direction: -1 | 1): TreeNode | undefined {
	const found = locateSiblings(roots, id)
	return found ? found.siblings[found.index + direction] : undefined
}

function locateSiblings(
	nodes: readonly TreeNode[],
	id: Id
): {siblings: readonly TreeNode[]; index: number} | undefined {
	for (let index = 0; index < nodes.length; index++) {
		const node = nodes[index]
		if (node.id === id) return {siblings: nodes, index}
		if (node.kind === 'mark') {
			const found = locateSiblings(node.children(), id)
			if (found) return found
		}
	}
	return undefined
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