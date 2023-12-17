import {RefObject, useCallback, useState} from 'react'
import {EVENT} from '../../constants'
import {MarkStruct} from '../../types'
import {useNode} from '../providers/NodeProvider'
import {useStore} from '../providers/StoreProvider'
import {useSelector} from './useSelector'

export interface MarkHandler<T> extends MarkStruct {
	/**
	 * MarkStruct ref. Used for focusing and key handling operations.
	 */
	ref: RefObject<T>
	/**
	 * Change mark.
	 * @options.silent doesn't change itself label and value, only pass change event.
	 */
	change: (props: MarkStruct, options?: { silent: boolean }) => void
	/**
	 * Remove itself.
	 */
	remove: () => void
	/**
	 * Passed the readOnly prop value
	 */
	readOnly?: boolean
}

export const useMark = <T extends HTMLElement = HTMLElement, >(): MarkHandler<T> => {
	const node = useNode()
	const {bus} = useStore()
	const readOnly = useSelector(state => state.readOnly)

	const [label, setLabel] = useState<string>(node.data.mark.label)
	const [value, setValue] = useState<string | undefined>(node.data.mark.value)

	const change = useCallback((props: MarkStruct, options?: { silent: boolean }) => {
		if (!options?.silent) {
			setLabel(props.label)
			setValue(props.value)
		}
		bus.send(EVENT.Change, {node, value: {...props}})
	}, [])

	const remove = useCallback(() => {
		setLabel('')
		setValue(undefined)
		bus.send(EVENT.Delete, {node})
	}, [])

	return {label, value, change, remove, readOnly, ref: node.data.ref as RefObject<T>}
}