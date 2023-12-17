import {memo} from 'react'
import {DefaultClass} from '../constants'
import {getKey} from '../utils/functions/getKey'
import {useStore} from '../utils/hooks/useStore'
import {NodeProvider} from '../utils/providers/NodeProvider'
import {EditableSpan} from './EditableSpan'
import {getChildProps} from '../utils/functions/getChildProps'
import {Piece} from './Piece'
import {isAnnotated} from "../utils/checkers/isAnnotated";

export const Container = memo(() => {
	const {className, style, pieces, refs} = useStore(store => ({
		className: store.props.className ? DefaultClass + ' ' + store.props.className : DefaultClass,
		style: store.props.style,
		pieces: store.pieces,
		refs: store.refs
	}), true)

	const divOverride = useStore(getChildProps('div'), true)

	return (
		<div {...divOverride} ref={refs.container} className={className} style={style}>
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