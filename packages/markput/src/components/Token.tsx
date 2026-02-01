import {memo} from 'react'
import type {MarkToken, TextToken, Token as TokenType} from '@markput/core'
import {TokenProvider} from '../lib/providers/TokenProvider'
// eslint-disable-next-line import/no-cycle -- Legitimate recursive component relationship: Token → Piece → Token
import {Piece} from './Piece'
import {TextSpan} from './TextSpan'

/**
 * Token component - renders a single token (text or mark) with recursive support for nested marks
 *
 * This component discriminates token types and delegates to type-safe sub-components:
 * - MarkToken → MarkTokenComponent (renders Piece with custom Mark component)
 * - TextToken → TextTokenComponent (renders TextSpan or plain text)
 *
 * Type discrimination happens here at the top level, allowing sub-components
 * to have compile-time type safety without runtime checks.
 *
 * The isNested prop determines editing behavior for TextTokens:
 * - isNested=false (default): TextTokens are editable contentEditable spans
 * - isNested=true: TextTokens render as plain text within nested marks
 *
 * The component is memoized for performance.
 */
export const Token = memo(({mark, isNested = false}: {mark: TokenType; isNested?: boolean}) => {
	// Type discrimination at top level for compile-time safety in sub-components
	if (mark.type === 'mark') {
		return <MarkTokenComponent token={mark} />
	}

	return <TextTokenComponent token={mark} isNested={isNested} />
})

Token.displayName = 'Token'

/**
 * MarkTokenComponent - renders a MarkToken with type safety
 *
 * This component:
 * - Accepts only MarkToken type (compile-time safety)
 * - Wraps content in TokenProvider for context access
 * - Delegates rendering to Piece component
 *
 * The component is memoized for performance.
 */
const MarkTokenComponent = memo(({token}: {token: MarkToken}) => (
	<TokenProvider value={token}>
		<Piece />
	</TokenProvider>
))

MarkTokenComponent.displayName = 'MarkTokenComponent'

/**
 * TextTokenComponent - renders a TextToken with type safety
 *
 * This component:
 * - Accepts only TextToken type (compile-time safety)
 * - isNested=true: renders plain text (no context needed)
 * - isNested=false: wraps in TokenProvider and renders TextSpan
 *
 * Performance optimization:
 * - Nested text tokens skip TokenProvider since context is never consumed
 *
 * The component is memoized for performance.
 */
const TextTokenComponent = memo(({token, isNested = false}: {token: TextToken; isNested?: boolean}) => {
	// Optimization: nested text tokens don't need context provider
	// They render as plain text and no child component consumes the token
	if (isNested) {
		return <>{token.content}</>
	}

	return (
		<TokenProvider value={token}>
			<TextSpan />
		</TokenProvider>
	)
})

TextTokenComponent.displayName = 'TextTokenComponent'
