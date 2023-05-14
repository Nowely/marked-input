import {memo} from 'react'
import {DefaultClass} from '../constants'
import {NodeProvider, useStore} from '../utils'
import {useSelector} from '../utils/useSelector'
import {EditableSpan} from './EditableSpan'
import {getChildProps} from '../utils/getChildProps'
import {Piece} from './Piece'
import {isAnnotated} from "../utils/isAnnotated";

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
			{pieces.toArray().map((node) =>
				<NodeProvider key={node.key} value={node}>
					{
						isAnnotated(node.mark) ? <Piece/> : <EditableSpan/>
					}
				</NodeProvider>
			)}
		</div>
	)
})

Container.displayName = 'Container'