import type {Store, TreeNode} from '@markput/core'
import {createContext, useContext} from 'react'

export type TokenContextValue = {
	readonly store: Store
	readonly node: TreeNode
	/**
	 * Nesting level, by construction from the render loop: a top-level token is 0. It
	 * replaced the render-time `TokenPath` at S1.7 — `path.length - 1` was the only thing
	 * anything here read off it, and the path layer goes at S1.8 (plan decision D-a).
	 */
	readonly depth: number
}

export const TokenContext = createContext<TokenContextValue | undefined>(undefined)
TokenContext.displayName = 'TokenProvider'

export function useTokenContext(): TokenContextValue {
	const value = useContext(TokenContext)
	if (value === undefined) {
		throw new Error('Token not found. Make sure to wrap component in TokenContext.Provider.')
	}
	return value
}