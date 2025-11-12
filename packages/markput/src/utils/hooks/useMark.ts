import {RefObject, useEffect, useRef, useState} from 'react'
import {Token, MarkToken, Store, SystemEvent} from '@markput/core'
import {useToken} from '../providers/TokenProvider'
import {useStore} from './useStore'

export interface MarkHandler<T> {
	/**
	 * MarkToken ref. Used for focusing and key handling operations.
	 */
	ref: RefObject<T>
	/**
	 * Change mark.
	 * @param {Object} options - The options object
	 * @param {boolean} options.silent - If true, doesn't change itself value and meta, only pass change event.
	 */
	change: (props: {value: string, meta?: string}, options?: {silent: boolean}) => void
	/**
	 * Remove itself.
	 */
	remove: () => void
	/**
	 * Passed the readOnly prop value
	 */
	readOnly?: boolean
	/**
	 * The value of the mark
	 */
	value: string
	/**
	 * The meta of the mark
	 */
	meta?: string
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

	// useMark can only be used with MarkToken
	if (token.type !== 'mark') {
		throw new Error('useMark hook can only be used with MarkToken')
	}

	const [mark] = useState(() => new MarkHandlerP<T>({ref, store, options, token}))

	useUncontrolledInit(ref, options, token)

	//Sync for state
	const readOnly = useStore(state => state.props.readOnly)
	useEffect(() => {
		mark.readOnly = readOnly
	}, [readOnly])

	return mark
}

type MarkHandlerPConstruct<T> = {ref: RefObject<T>; options: MarkOptions; store: Store; token: MarkToken}

export class MarkHandlerP<T extends HTMLElement = HTMLElement> {
	ref: RefObject<T>
	readonly #options: MarkOptions
	readonly #store: Store
	readonly #token: MarkToken

	readOnly?: boolean

	get value() {
		return this.#token.value
	}

	set value(value: string) {
		this.#token.value = value
		this.#store.bus.send(SystemEvent.Change, {node: this.#token})
	}

	get meta() {
		return this.#token.meta
	}

	set meta(value: string | undefined) {
		this.#token.meta = value
		this.#store.bus.send(SystemEvent.Change, {node: this.#token})
	}

	constructor(param: MarkHandlerPConstruct<T>) {
		this.ref = param.ref
		this.#options = param.options
		this.#store = param.store
		this.#token = param.token
	}

	change = (props: {value: string, meta?: string}) => {
		this.#token.value = props.value
		this.#token.meta = props.meta
		this.#store.bus.send(SystemEvent.Change, {node: this.#token})
	}

	remove = () => this.#store.bus.send(SystemEvent.Delete, {token: this.#token})
}

function useUncontrolledInit(ref: RefObject<HTMLElement>, options: MarkOptions, token: MarkToken) {
	useEffect(() => {
		if (ref.current && !options.controlled) ref.current.textContent = token.value
	}, [])
}
