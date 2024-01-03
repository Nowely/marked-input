import {RefObject, useEffect, useReducer, useRef, useState} from 'react'
import {SystemEvent} from '../../constants'
import {MarkStruct} from '../../types'
import {Store} from '../classes/Store'
import {useToken} from '../providers/TokenProvider'
import {useStore} from './useStore'

export interface MarkHandler<T> extends MarkStruct {
	/**
	 * MarkStruct ref. Used for focusing and key handling operations.
	 */
	ref: RefObject<T>
	/**
	 * Change mark.
	 * @options.silent doesn't change itself label and value, only pass change event.
	 */
	//change: (props: MarkStruct, options?: { silent: boolean }) => void
	/**
	 * Remove itself.
	 */
	//remove: () => void
	/**
	 * Passed the readOnly prop value
	 */
	readOnly?: boolean
}

export interface MarkOptions {
	/**
	 * @default false
	 */
	controlled?: boolean
}

//TODO subscribe on external
export const useMark = <T extends HTMLElement = HTMLElement, >(options: MarkOptions = {}): MarkHandlerP<T> => {
	const store = useStore()
	const token = useToken()
	const ref = useRef<HTMLElement>() as unknown as RefObject<T>

	const [mark] = useState(() => new MarkHandlerP<T>({ref, store, options, token}))

	useUncontrolledInit(ref, options, token)

	const readOnly = useStore(state => state.props.readOnly)
	useEffect(() => {
		mark.readOnly = readOnly
	}, [readOnly])


	return mark
}

type MarkHandlerPConstruct = { ref: RefObject<HTMLElement>; options: MarkOptions; store: Store; token: MarkStruct }

export class MarkHandlerP<T extends HTMLElement = HTMLElement> {
	ref: RefObject<HTMLElement>
	#options: MarkOptions
	#store: Store
	#token: MarkStruct

	readOnly?: boolean

	get label() {
		return this.#token.label
	}

	set label(value: string) {
		this.#token.label = value
		this.#store.bus.send(SystemEvent.Change, {node: this.#token})
	}

	constructor(param: MarkHandlerPConstruct) {
		this.ref = param.ref
		this.#options = param.options
		this.#store = param.store
		this.#token = param.token
	}

	change = (props: MarkStruct) => {
		this.#token.label = props.label
		this.#token.value = props.value
		this.#store.bus.send(SystemEvent.Change, {node: this.#token})
	}

	remove = () => {
		/*setLabel('')
		setValue(undefined)*/
		this.#store.bus.send(SystemEvent.Delete)
	}
}

function useUncontrolledInit(ref: RefObject<HTMLElement>, options: MarkOptions, token: MarkStruct) {
	useEffect(() => {
		if (ref.current && !options.controlled)
			ref.current.textContent = token.label
	}, [])
}