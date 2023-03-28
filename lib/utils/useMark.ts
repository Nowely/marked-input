import {RefObject, useCallback, useState} from 'react'
import {SystemEvent} from '../constants'
import {MarkStruct} from '../types'
import {useNode, useStore} from './index'
import {useSelector} from './useSelector'

export interface DynamicMark<T> extends MarkStruct {
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

export const useMark = <T extends HTMLElement = HTMLElement, >(): DynamicMark<T> => {
	const node = useNode()
	const {bus} = useStore()
	const readOnly = useSelector(state => state.readOnly)

	const [label, setLabel] = useState<string>(node.mark.label)
	const [value, setValue] = useState<string | undefined>(node.mark.value)

	const change = useCallback((props: MarkStruct, options?: { silent: boolean }) => {
		if (!options?.silent) {
			setLabel(props.label)
			setValue(props.value)
		}
		bus.send(SystemEvent.Change, {key: node.key, value: {...props}})
	}, [])

	const remove = useCallback(() => {
		setLabel('')
		setValue(undefined)
		bus.send(SystemEvent.Delete, {key: node.key})
	}, [])

	return {label, value, change, remove, readOnly, ref: node.ref as RefObject<T>}
}