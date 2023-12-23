import {memo} from 'react'
import {MarkStruct} from '../types'
import {isAnnotated} from '../utils/checkers/isAnnotated'
import {NodeProvider} from '../utils/providers/NodeProvider'
import {EditableSpan} from './EditableSpan'
import {Piece} from './Piece'

export const Token = memo(({mark}: { mark: MarkStruct }) => (
	<NodeProvider value={mark}>
		{isAnnotated(mark) ? <Piece/> : <EditableSpan/>}
	</NodeProvider>
))
