import {memo, useEffect} from 'react'
import {createRoot} from 'react-dom/client'
import {DefaultClass, SystemEvent} from '../constants'
import {isAnnotated} from '../utils/checkers/isAnnotated'
import {getKey} from '../utils/functions/getKey'
import {useListener} from '../utils/hooks/useListener'
import {useStore} from '../utils/hooks/useStore'
import {EditableSpan} from './EditableSpan'
import {Piece} from './Piece'

//TODO fix updating0
export const Container = memo(() => {
	const store = useStore()
	const {className, style, pieces, refs, tokens, bus} = useStore(store => ({
		className: store.props.className ? DefaultClass + ' ' + store.props.className : DefaultClass,
		style: store.props.style,
		pieces: store.pieces,
		refs: store.refs,
		tokens: store.tokens,
		bus: store.bus,
	}), true)

	//TODO
	//const divOverride = useStore(getChildProps('div'), true)

	useListener('input', e => {
		bus.send(SystemEvent.Change, {node: e.target})
	}, [])

	useEffect(() => {
		const div1 = document.createElement('div')
		refs.container.current?.append(div1)

		const root = createRoot(div1)
		root.render(<div>ASsadas</div>)

		root.render('ASsadas2')
	}, [])
	//console.log(1)

	return (
		<div /*{...divOverride}*/ ref={refs.container} className={className} style={style}>
			{tokens.map(token => {
				//<NodeProvider key={getKey(token)} value={token}>
				return isAnnotated(token) ? <Piece key={getKey(token)}/> : <EditableSpan key={getKey(token)}/>
				//</NodeProvider>
			})}
		</div>
	)
})

Container.displayName = 'Container'