import {memo} from 'react'
import type {Token as TokenType} from '@markput/core'
import {TokenProvider} from '../lib/providers/TokenProvider'
// eslint-disable-next-line import/no-cycle -- Legitimate recursive component relationship: Token → Piece → Token
import {Piece} from './Piece'
import {TextSpan} from './TextSpan'

/** Renders a token - marks via Piece, text via TextSpan or plain text if nested */
export const Token = memo(({mark, isNested = false}: {mark: TokenType; isNested?: boolean}) => {
	if (mark.type === 'mark') {
		return (
			<TokenProvider value={mark}>
				<Piece />
			</TokenProvider>
		)
	}

	if (isNested) {
		return <>{mark.content}</>
	}

	return (
		<TokenProvider value={mark}>
			<TextSpan />
		</TokenProvider>
	)
})

Token.displayName = 'Token'
