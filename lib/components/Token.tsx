import {memo} from 'react'
import {MarkStruct} from '../types'
import {isAnnotated} from '../utils/checkers/isAnnotated'
import {getKey} from '../utils/functions/getKey'
import {NodeProvider} from '../utils/providers/NodeProvider'
import {EditableSpan} from './EditableSpan'
import {Piece} from './Piece'

export const Token = memo(({mark}: { mark: MarkStruct }) => (
	<NodeProvider value={mark}>
		{isAnnotated(mark) ? <Piece key={getKey(mark)}/> : <EditableSpan key={getKey(mark)}/>}
	</NodeProvider>
))
