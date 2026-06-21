import type {Token} from '../features/tokens'

export type TokenPath = readonly number[]

export type DomRef = (element: HTMLElement | null) => void

export type Range = {
	readonly start: number
	readonly end: number
}

export type RawSelection = {
	readonly range: Range
	readonly direction?: 'forward' | 'backward'
}

export type OptionalMarkFieldPatch = {readonly kind: 'set'; readonly value: string} | {readonly kind: 'clear'}

export type MarkPatch = {
	readonly value?: string
	readonly meta?: OptionalMarkFieldPatch
	readonly slot?: OptionalMarkFieldPatch
}

export type MarkInfo = {
	/** Nesting level: a top-level mark has depth 0. */
	readonly depth: number
	/** Whether this mark directly contains other marks. */
	readonly hasNestedMarks: boolean
}

/**
 * Build a {@link MarkInfo} snapshot for a mark token at the given render-tree path.
 * `path` is an input used to compute `depth = path.length - 1`; it is not returned.
 * Throws if `token` is not a mark token.
 */
export function toMarkInfo(token: Token, path: TokenPath): MarkInfo {
	if (token.type !== 'mark') throw new Error('toMarkInfo: token is not a mark')
	return {
		depth: path.length - 1,
		hasNestedMarks: token.children.some(child => child.type === 'mark'),
	}
}