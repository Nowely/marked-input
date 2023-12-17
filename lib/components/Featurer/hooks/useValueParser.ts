import {createRef, useEffect} from 'react'
import {MarkStruct, Option, Piece} from '../../../types'
import {isAnnotated} from '../../../utils/checkers/isAnnotated'
import {isObject} from '../../../utils/checkers/isObject'
import LinkedList from '../../../utils/classes/LinkedList/LinkedList'
import {Parser} from '../../../utils/classes/Parser/Parser'
import {Store} from '../../../utils/classes/Store'
import {findGap} from '../../../utils/functions/findGap'
import {getClosestIndexes} from '../../../utils/functions/getClosestIndexes'
import {useSelector} from '../../../utils/hooks/useSelector'
import {useStore} from '../../../utils/providers/StoreProvider'

export const useValueParser = () => {
	const store = useStore()
	const {value, options} = useSelector(state => ({
		value: state.value,
		options: state.Mark ? state.options : undefined,
	}), true)

	useEffect(() => {
			if (store.changedNode)
				updateStateFromUI(store, options)
			else {
				updateStateFromValue(store, value, options)
			}
		}, [value, options]
	)
}

function updateStateFromValue(store: Store, value: string, options?: Option<MarkStruct>[]) {
	const ranges = getRangeMap(store)
	const gap = findGap(store.previousValue, value)
	store.previousValue = value

	console.log(gap)
	console.log(ranges)

	if (gap.left) {
		//Mark removing happen
		if (ranges.includes(gap.left) && gap.right && Math.abs(gap.left - gap.right) > 1) {
			const updatedIndex = ranges.indexOf(gap.left)
			updateByChangedNodes(store, updatedIndex - 1, updatedIndex)
			return
		}

		//Changing in label
		const [updatedIndex] = getClosestIndexes(ranges, gap.left)
		updateByChangedNode(store, updatedIndex)
		return
	}


	//Parse all string
	const tokens = Parser.split(value, options)()
	const nodeData = tokens.map(toNodeData)
	const pieces = LinkedList.from(nodeData)

	store.setState({pieces})
}

function getRangeMap(store: Store): number[] {
	let position = 0
	return store.state.pieces.map(node => {
		const length = isAnnotated(node.data.mark) ? node.data.mark.annotation.length : node.data.mark.label.length
		position += length
		return position - length
	}) ?? []
}

function toNodeData(piece: Piece) {
	return {
		mark: isObject(piece) ? piece : {label: piece},
		ref: createRef<HTMLElement>()
	}
}

function updateByChangedNodes(store: Store, index1: number, index2: number) {
	const node1 = store.state.pieces.getNode(index1)
	const node2 = store.state.pieces.getNode(index2)
	const newString = node1!.data.mark.label + node2!.data.mark.label
	const pieces = Parser.split(newString, store.state.options)()

	const nodeData = pieces.map(toNodeData)

	store.state.pieces?.insertAfter(node2!, nodeData[0])
	node1!.remove()
	node2!.remove()
	const result = store.state.pieces.shallowCopy()
	store.setState({pieces: result})
}

function updateByChangedNode(store: Store, nodeIndex: number) {
	const node = store.state.pieces.getNode(nodeIndex)
	const pieces = Parser.split(node!.data.mark.label, store.state.options)()
	if (pieces.length===1) return

	const nodeData = pieces.map(toNodeData)

	store.state.pieces.insertsBefore(node!, nodeData)
	store.focusedNode = node!.next
	node!.remove()
	const result = store.state.pieces.shallowCopy()
	store.setState({pieces: result})
}

function updateStateFromUI(store: Store, options?: Option[]) {
	const pieces = Parser.split(store.changedNode!.data.mark.label, options)()
	if (pieces.length===1) return

	const nodeData = pieces.map(toNodeData)

	store.state.pieces.insertsBefore(store.changedNode!, nodeData)
	store.focusedNode = store.changedNode!.next
	store.changedNode!.remove()
	store.changedNode = undefined
	const result = store.state.pieces.shallowCopy()
	store.setState({pieces: result})
}

function updateByChangedValue(value: string, options?: Option[]) {
	const pieces = Parser.split(value, options)()
	const nodeData = pieces.map(toNodeData)
	return LinkedList.from(nodeData)
}
