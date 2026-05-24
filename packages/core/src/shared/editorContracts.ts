import type {Token} from '../features/parsing/parser/types'

export type TokenPath = readonly number[]

export type TokenAddress = {
	readonly path: TokenPath
	readonly token: Token
}

export type DomRef = (element: HTMLElement | null) => void

export type Range = {
	readonly start: number
	readonly end: number
}

export type RawSelection = {
	readonly range: Range
	readonly direction?: 'forward' | 'backward'
}

export type NodeLocationResult =
	| {
			ok: true
			value: {
				readonly address: TokenAddress
				readonly tokenElement: HTMLElement
				readonly textElement?: HTMLElement
				readonly rowElement?: HTMLElement
			}
	  }
	| {
			ok: false
			reason: 'notIndexed' | 'outsideEditor' | 'control'
	  }

export type RawSelectionResult =
	| {
			ok: true
			value: RawSelection
	  }
	| {
			ok: false
			reason: 'notIndexed' | 'outsideEditor' | 'control' | 'mixedBoundary' | 'invalidBoundary'
	  }

export type BoundaryPositionResult =
	| {
			ok: true
			value: number
	  }
	| {
			ok: false
			reason: 'notIndexed' | 'outsideEditor' | 'control' | 'invalidBoundary' | 'composing'
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
	readonly address: TokenAddress
	readonly depth: number
	readonly hasNestedMarks: boolean
	readonly key: string
}