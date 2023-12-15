import {createRef, useEffect} from 'react'
import {Option, Piece} from '../../../types'
import {isObject} from '../../../utils/checkers/isObject'
import LinkedList from '../../../utils/classes/LinkedList/LinkedList'
import {Parser} from '../../../utils/classes/Parser/Parser'
import {Store} from '../../../utils/classes/Store'
import {useSelector} from '../../../utils/hooks/useSelector'
import {useStore} from '../../../utils/providers/StoreProvider'

//TODO Compare new input value with returned caching?
//TODO dont create a new object for returned value
//TODO move to marked text or store provider?
export const useValueParser = () => {
	const store = useStore()
	const {value, options} = useSelector(state => ({
		value: state.value,
		options: state.Mark ? state.options : undefined,
	}), true)

	useEffect(() => {
		const pieces = store.changedNode
			? updateByChangedLabel(store, options)
			: updateByChangedValue(value, options)


		store.setState({pieces})

	}, [value, options])
}

function toNodeData(piece: Piece) {
	return {
		mark: isObject(piece) ? piece : {label: piece},
		ref: createRef<HTMLElement>()
	}
}

function updateByChangedValue(value: string, options: Option[]) {
	const pieces = Parser.split(value, options)()
	const nodeData = pieces.map(toNodeData)
	return LinkedList.from(nodeData)
}

function updateByChangedLabel(store: Store, options: Option[]) {
	const pieces = Parser.split(store.changedNode!.data.mark.label, options)()
	if (pieces.length===1) return

	const nodeData = pieces.map(toNodeData)

	store.state.pieces.insertsBefore(store.changedNode!, nodeData)
	store.focusedNode = store.changedNode!.next
	store.changedNode!.remove()
	store.changedNode = undefined
	return store.state.pieces.shallowCopy()
}