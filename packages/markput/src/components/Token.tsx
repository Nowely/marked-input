import {memo} from 'react'
import {Token as TokenType} from '@markput/core'
import {TokenProvider} from '../utils/providers/TokenProvider'
import {Piece} from './Piece'
import {TextSpan} from './TextSpan'

export const Token = memo(({mark}: {mark: TokenType}) => (
	<TokenProvider value={mark}>{mark.type === 'mark' ? <Piece /> : <TextSpan />}</TokenProvider>
))
