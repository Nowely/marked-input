import {RefObject, useEffect, useRef, useState} from 'react'
import {MarkStruct, Store, SystemEvent} from '@markput/core'
import {useToken} from '../providers/TokenProvider'
import {useStore} from './useStore'

export interface MarkHandler<T> extends MarkStruct {
	/**
	 * MarkStruct ref. Used for focusing and key handling operations.
	 */
	ref: RefObject<T>
	/**
	 * Change mark.
	 * @param {Object} options - The options object
	 * @param {boolean} options.silent - If true, doesn't change itself label and value, only pass change event.
	 */
	change: (props: MarkStruct, options?: {silent: boolean}) => void
	/**
	 * Remove itself.
	 */
	remove: () => void
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

//TODO subscribe on label/value changing
export const useMark = <T extends HTMLElement = HTMLElement>(options: MarkOptions = {}): MarkHandler<T> => {
	const store = useStore()
	const token = useToken()
	const ref = useRef<HTMLElement>() as unknown as RefObject<T>

	const [mark] = useState(() => new MarkHandlerP<T>({ref, store, options, token}))

	useUncontrolledInit(ref, options, token)

	//Sync for state
	const readOnly = useStore(state => state.props.readOnly)
	useEffect(() => {
		mark.readOnly = readOnly
	}, [readOnly])

	return mark
}

type MarkHandlerPConstruct<T> = {ref: RefObject<T>; options: MarkOptions; store: Store; token: MarkStruct}

export class MarkHandlerP<T extends HTMLElement = HTMLElement> {
	ref: RefObject<T>
	readonly #options: MarkOptions
	readonly #store: Store
	readonly #token: MarkStruct

	readOnly?: boolean

	get label() {
		return this.#token.label
	}

	set label(value: string) {
		this.#token.label = value
		this.#store.bus.send(SystemEvent.Change, {node: this.#token})
	}

	constructor(param: MarkHandlerPConstruct<T>) {
		this.ref = param.ref
		this.#options = param.options
		this.#store = param.store
		this.#token = param.token
	}

	get value() {
		return this.#token.value
	}

	set value(value: string | undefined) {
		this.#token.value = value
		this.#store.bus.send(SystemEvent.Change, {node: this.#token})
	}

	change = (props: MarkStruct) => {
		this.#token.label = props.label
		this.#token.value = props.value
		this.#store.bus.send(SystemEvent.Change, {node: this.#token})
	}

	remove = () => this.#store.bus.send(SystemEvent.Delete, {token: this.#token})
}

function useUncontrolledInit(ref: RefObject<HTMLElement>, options: MarkOptions, token: MarkStruct) {
	useEffect(() => {
		if (ref.current && !options.controlled) ref.current.textContent = token.label
	}, [])
}
