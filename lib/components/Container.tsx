import {memo} from 'react'
import {DefaultClass} from '../constants'
import {isAnnotated, NodeProvider, useStore} from '../utils'
import {getChildProps} from '../utils/getChildProps'
import {useCurrentState} from '../utils/useCurrentState'
import {useSelector} from '../utils/useSelector'
import {EditableSpan} from './EditableSpan'
import {Piece} from './Piece'

export const Container = memo(() => {
	const store = useStore()
	const className = useSelector(({className}) => (className ? DefaultClass + ' ' + className : DefaultClass))
	const {pieces, style} = useCurrentState('style', 'pieces', 'className')

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