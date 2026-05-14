import type {Result, TokenAddress, TokenPath} from '../../shared/editorContracts'
import type {Token} from './parser/types'

export type TokenIndex = {
	pathFor(token: Token): TokenPath | undefined
	addressFor(path: TokenPath): TokenAddress | undefined
	resolve(path: TokenPath): Token | undefined
	resolveAddress(address: TokenAddress): Result<Token, 'stale'>
	key(path: TokenPath): string
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

export function createTokenIndex(tokens: readonly Token[]): TokenIndex {
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
		pathFor: token => paths.get(token),
		addressFor(path) {
			const token = resolvePath(tokens, path)
			return token ? {path: [...path], token} : undefined
		},
		resolve: path => resolvePath(tokens, path),
		resolveAddress(address) {
			const current = resolvePath(tokens, address.path)
			if (!current || current !== address.token) return {ok: false, reason: 'stale'}
			return {ok: true, value: current}
		},
		key: pathKey,
	}
}