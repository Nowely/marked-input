import type {TokenPath} from '../../shared/editorContracts'
import type {Token} from './parser/types'

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