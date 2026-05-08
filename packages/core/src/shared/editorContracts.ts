import type {MarkupDescriptor} from '../features/parsing/parser/core/MarkupDescriptor'
import type {Store} from '../store/Store'

export type TokenPath = readonly number[]

export type TokenAddress = {
	readonly path: TokenPath
	readonly parseGeneration: number
}

export type Result<T, Reason extends string> = {ok: true; value: T} | {ok: false; reason: Reason}

export type DomRef = (element: HTMLElement | null) => void

export type Range = {
	readonly start: number
	readonly end: number
}

export type RawSelection = {
	readonly range: Range
	readonly direction?: 'forward' | 'backward'
}

export type NodeLocationResult = Result<
	{
		readonly address: TokenAddress
		readonly tokenElement: HTMLElement
		readonly textElement?: HTMLElement
		readonly rowElement?: HTMLElement
	},
	'notIndexed' | 'outsideEditor' | 'control'
>

export type RawSelectionResult = Result<
	RawSelection,
	'notIndexed' | 'outsideEditor' | 'control' | 'mixedBoundary' | 'invalidBoundary'
>

export type BoundaryPositionResult = Result<
	number,
	'notIndexed' | 'outsideEditor' | 'control' | 'invalidBoundary' | 'composing'
>

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

export type TokenShapeSnapshot =
	| {readonly kind: 'text'}
	| {
			readonly kind: 'mark'
			readonly descriptor: MarkupDescriptor
			readonly descriptorIndex: number
	  }

export type DomIndex = {
	readonly generation: number
}

export type DomDiagnostic = {
	readonly kind:
		| 'missingRole'
		| 'stalePath'
		| 'outsideEditor'
		| 'controlBoundary'
		| 'mixedBoundary'
		| 'invalidBoundary'
		| 'renderReentry'
		| 'recoveryFailed'
		| 'missingContainer'
		| 'ambiguousStructure'
	readonly path?: TokenPath
	readonly reason: string
}

export type MarkControllerConstructor = new (store: Store, address: TokenAddress, snapshot: MarkSnapshot) => unknown