import {memo} from 'react'
import {DefaultClass} from '../constants'
import {isAnnotated, NodeProvider, useStore} from '../utils'
import {useSelector} from '../utils/useSelector'
import {EditableSpan} from './EditableSpan'
import {Piece} from './Piece'

export const Container = memo(() => {
	const store = useStore()
	const {className, style, pieces} = useSelector(state => ({
		className: state.className ? DefaultClass + ' ' + state.className : DefaultClass,
		style: state.style,
		pieces: state.pieces,
	}), true)

	/*const children = useSelector(state =>
		React.Children.toArray(state.children).find((value) => (value as ReactElement).type === 'div')?.props, true)*/

	return (
		<div ref={store.containerRef} className={className} style={style} /*{...children}*/>
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