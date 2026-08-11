import type {TreeNode} from '../features/tokens'

export type DomRef = (element: HTMLElement | null) => void

export type Range = {
	readonly start: number
	readonly end: number
}

export type MarkInfo = {
	/** Nesting level: a top-level mark has depth 0. */
	readonly depth: number
	/** Whether this mark directly contains other marks. */
	readonly hasNestedMarks: boolean
}

/**
 * Build a {@link MarkInfo} for a mark node at the given render depth. `depth` arrives by
 * construction from the render loop (the parent that maps the tree knows it), which is what
 * it always did — S1.7 only stops laundering it through a `TokenPath` whose LENGTH was the
 * real input (plan decision D-a). That unhooks this function from the path layer S1.8
 * deletes. Throws if `node` is not a mark node.
 */
export function toMarkInfo(node: TreeNode, depth: number): MarkInfo {
	if (node.kind !== 'mark') throw new Error('toMarkInfo: node is not a mark')
	return {depth, hasNestedMarks: node.children().some(child => child.kind === 'mark')}
}