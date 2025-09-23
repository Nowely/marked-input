import {memo} from 'react'
import {isAnnotated, MarkStruct} from '@markput/core'
import {TokenProvider} from '../utils/providers/TokenProvider'
import {EditableSpan} from './EditableSpan'
import {Piece} from './Piece'

export const Token = memo(({mark}: {mark: MarkStruct}) => (
	<TokenProvider value={mark}>{isAnnotated(mark) ? <Piece /> : <EditableSpan />}</TokenProvider>
))
