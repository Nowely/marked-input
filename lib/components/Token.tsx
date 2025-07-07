import {memo} from 'react'
import {MarkStruct} from '../types'
import {isAnnotated} from '../utils/checkers/isAnnotated'
import {TokenProvider} from '../utils/providers/TokenProvider'
import {EditableSpan} from './EditableSpan'
import {Piece} from './Piece'

export const Token = memo(({mark}: { mark: MarkStruct }) => (
	<TokenProvider value={mark}>
		{isAnnotated(mark) ? <Piece/> : <EditableSpan/>}
	</TokenProvider>
))
