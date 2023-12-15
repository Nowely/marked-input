import {memo} from 'react'
import {DefaultClass} from '../constants'
import {getKey} from '../utils/functions/getKey'
import {useSelector} from '../utils/hooks/useSelector'
import {NodeProvider} from '../utils/providers/NodeProvider'
import {useStore} from '../utils/providers/StoreProvider'
import {EditableSpan} from './EditableSpan'
import {getChildProps} from '../utils/functions/getChildProps'
import {Piece} from './Piece'
import {isAnnotated} from "../utils/checkers/isAnnotated";

export const Container = memo(() => {
	const store = useStore()
	const {className, style, pieces} = useSelector(state => ({
		className: state.className ? DefaultClass + ' ' + state.className : DefaultClass,
		style: state.style,
		pieces: state.pieces,
	}), true)

	const divOverride = useSelector(getChildProps('div'), true)

	return (
		<div {...divOverride} ref={store.containerRef} className={className} style={style}>
			{pieces?.map((node) =>
				<NodeProvider key={getKey(node)} value={node}>
					{
						isAnnotated(node.data.mark) ? <Piece/> : <EditableSpan/>
					}
				</NodeProvider>
			)}
		</div>
	)
})

Container.displayName = 'Container'