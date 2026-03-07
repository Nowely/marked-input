import type {Token} from '@markput/core'
import {createContext, useContext} from 'react'

export const TokenContext = createContext<Token | undefined>(undefined)
TokenContext.displayName = 'TokenProvider'

export function useToken(): Token {
	const value = useContext(TokenContext)
	if (value === undefined) {
		throw new Error('Token not found. Make sure to wrap component in TokenContext.Provider.')
	}
	return value
}