import type {Store, Token, TokenPath} from '@markput/core'
import {createContext, useContext} from 'react'

export type TokenContextValue = {
	readonly store: Store
	readonly token: Token
	/** Render-time tree path: arrives from the tree map by construction (the parent knows each child's index). */
	readonly path: TokenPath
}

export const TokenContext = createContext<TokenContextValue | undefined>(undefined)
TokenContext.displayName = 'TokenProvider'

export function useToken(): Token {
	const value = useContext(TokenContext)
	if (value === undefined) {
		throw new Error('Token not found. Make sure to wrap component in TokenContext.Provider.')
	}
	return value.token
}

export function useTokenContext(): TokenContextValue {
	const value = useContext(TokenContext)
	if (value === undefined) {
		throw new Error('Token not found. Make sure to wrap component in TokenContext.Provider.')
	}
	return value
}