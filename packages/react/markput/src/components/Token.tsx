import type {Token as TokenType} from '@markput/core'
import {memo} from 'react'

import {TokenContext} from '../lib/providers/TokenContext'
// eslint-disable-next-line import/no-cycle
import {MarkRenderer} from './MarkRenderer'
import {TextSpan} from './TextSpan'

/** Renders a token - marks via MarkRenderer, text via TextSpan or plain text if nested */
export const Token = memo(({mark, isNested = false}: {mark: TokenType; isNested?: boolean}) => {
	if (mark.type === 'mark') {
		return (
			<TokenContext value={mark}>
				<MarkRenderer />
			</TokenContext>
		)
	}

	if (isNested) {
		return <>{mark.content}</>
	}

	return (
		<TokenContext value={mark}>
			<TextSpan />
		</TokenContext>
	)
})

Token.displayName = 'Token'