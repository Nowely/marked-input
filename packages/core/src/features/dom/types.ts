import type {TokenAddress, TokenPath} from '../../shared/editorContracts'

export type TokenNode = {
	readonly path: TokenPath
	readonly address: TokenAddress
	readonly tokenElement: HTMLElement
	readonly textElement?: HTMLElement
	readonly rowElement?: HTMLElement
	readonly childSequenceHost?: HTMLElement
}

export type Lookup =
	| {readonly kind: 'control'}
	| {readonly kind: 'token'; readonly node: TokenNode; readonly element: HTMLElement}