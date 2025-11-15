import {memo} from 'react'
import {Token as TokenType} from '@markput/core'
import {TokenProvider} from '../utils/providers/TokenProvider'
import {Piece} from './Piece'
import {TextSpan} from './TextSpan'

/**
 * Token component - renders a single token (text or mark) with recursive support for nested marks
 *
 * This component handles both TextToken and MarkToken types:
 * - TextToken: renders as TextSpan (editable text) when isNested=false, or plain text when isNested=true
 * - MarkToken: renders as Piece (custom Mark component with optional nested children)
 *
 * The isNested prop determines editing behavior:
 * - isNested=false (default): TextTokens are editable contentEditable spans
 * - isNested=true: TextTokens render as plain text within nested marks
 *
 * The component is memoized for performance and provides the token via context
 * to child components through TokenProvider.
 */
export const Token = memo(({mark, isNested = false}: {mark: TokenType; isNested?: boolean}) => (
	<TokenProvider value={mark}>
		{mark.type === 'mark' ? (
			<Piece />
		) : isNested ? (
			// For nested text tokens, render as plain text without contentEditable
			mark.content
		) : (
			<TextSpan />
		)}
	</TokenProvider>
))

Token.displayName = 'Token'
