import type {Token as TokenType} from '@markput/core'
import {memo} from 'react'

import {TokenProvider} from '../lib/providers/TokenProvider'
// eslint-disable-next-line import/no-cycle
import {MarkRenderer} from './MarkRenderer'
import {TextSpan} from './TextSpan'

/** Renders a token - marks via MarkRenderer, text via TextSpan or plain text if nested */
export const Token = memo(({mark, isNested = false}: {mark: TokenType; isNested?: boolean}) => {
	if (mark.type === 'mark') {
		return (
			<TokenProvider value={mark}>
				<MarkRenderer />
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