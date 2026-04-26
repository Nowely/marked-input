import type {Result, TokenAddress, TokenPath, TokenShapeSnapshot} from '../../shared/editorContracts'
import type {Token} from './parser/types'

export type TokenIndex = {
	readonly generation: number
	pathFor(token: Token): TokenPath | undefined
	addressFor(path: TokenPath): TokenAddress | undefined
	resolve(path: TokenPath): Token | undefined
	resolveAddress(address: TokenAddress, expected?: TokenShapeSnapshot): Result<Token, 'stale'>
	key(path: TokenPath): string
	equals(a: TokenPath, b: TokenPath): boolean
}

export function pathEquals(a: TokenPath, b: TokenPath): boolean {
	return a.length === b.length && a.every((part, index) => part === b[index])
}

export function pathKey(path: TokenPath): string {
	return path.join('.')
}

export function resolvePath(tokens: readonly Token[], path: TokenPath): Token | undefined {
	if (path.length === 0) return undefined
	let current: readonly Token[] = tokens
	let token: Token | undefined
	for (const index of path) {
		if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined
		token = current[index]
		current = token.type === 'mark' ? token.children : []
	}
	return token
}

export function snapshotTokenShape(token: Token): TokenShapeSnapshot {
	if (token.type === 'text') return {kind: 'text'}
	return {kind: 'mark', descriptor: token.descriptor, descriptorIndex: token.descriptor.index}
}

function shapeMatches(token: Token, expected: TokenShapeSnapshot): boolean {
	if (expected.kind === 'text') return token.type === 'text'
	return (
		token.type === 'mark' &&
		token.descriptor === expected.descriptor &&
		token.descriptor.index === expected.descriptorIndex
	)
}

export function createTokenIndex(tokens: readonly Token[], generation: number): TokenIndex {
	const paths = new WeakMap<Token, TokenPath>()

	const visit = (items: readonly Token[], parent: TokenPath) => {
		items.forEach((token, index) => {
			const path = [...parent, index]
			paths.set(token, path)
			if (token.type === 'mark') visit(token.children, path)
		})
	}

	visit(tokens, [])

	return {
		generation,
		pathFor: token => paths.get(token),
		addressFor: path => (resolvePath(tokens, path) ? {path: [...path], parseGeneration: generation} : undefined),
		resolve: path => resolvePath(tokens, path),
		resolveAddress(address, expected) {
			if (address.parseGeneration !== generation) return {ok: false, reason: 'stale'}
			const token = resolvePath(tokens, address.path)
			if (!token) return {ok: false, reason: 'stale'}
			if (expected && !shapeMatches(token, expected)) return {ok: false, reason: 'stale'}
			return {ok: true, value: token}
		},
		key: pathKey,
		equals: pathEquals,
	}
}