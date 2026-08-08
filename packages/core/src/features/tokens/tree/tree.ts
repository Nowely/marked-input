import type {Computed, Signal} from '../../../shared/signals'
import {computed, signal} from '../../../shared/signals'
import type {Token} from '../parser/types'
import {annotate} from '../parser/utils/annotate'
import type {Id, MarkNode, TextNode, TreeNode} from './types'

export interface TokenTree {
	// NOT ReturnType<typeof signal<...>> — instantiation picks the last overload
	// (Signal<T | undefined>) and poisons every consumer with `| undefined`.
	readonly roots: Signal<TreeNode[]>
	readonly value: Computed<string>
	/** Internal id allocator — shared by build and adopt so ids never collide. */
	readonly alloc: () => Id
	readonly buildNode: (token: Token) => TreeNode
}

export function createTokenTree(initial: Token[]): TokenTree {
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
			slot: token.slot ? {...token.slot} : undefined,
			position: {...token.position},
		}
		return node
	}

	const roots = signal({initial: initial.map(buildNode)})

	const value = computed(() => joinNodes(roots()))

	return {roots, value, alloc, buildNode}
}

/** The string projection: mirrors parser/utils/toString over live nodes. */
export function joinNodes(nodes: readonly TreeNode[]): string {
	let result = ''

	for (const node of nodes) {
		if (node.kind === 'text') {
			result += node.text()
			continue
		}

		const children = node.children()
		const slot = node.descriptor.hasSlot
			? children.length > 0
				? joinNodes(children)
				: node.slot?.content
			: undefined

		result += annotate(node.descriptor.markup, {value: node.value(), meta: node.meta(), slot})
	}

	return result
}