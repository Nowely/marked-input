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

export type MarkSnapshot = {
	readonly value: string
	readonly meta: string | undefined
	readonly slot: string | undefined
	readonly readOnly: boolean
}

export type MarkInfo = {
	/** The mark token's stable identity id (use with `store.tokens.handle(id)` for the live handle). */
	readonly id: number
	/** The mark's render-time tree path (one index per nesting level). */
	readonly path: TokenPath
	readonly depth: number
	readonly hasNestedMarks: boolean
	readonly key: string
}