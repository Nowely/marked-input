import type {RefObject} from 'react'
import {useEffect, useRef, useState} from 'react'
import type {MarkToken} from '@markput/core'
import {useToken} from '../providers/TokenProvider'
import {useStore} from './useStore'
import {MarkHandler} from '../classes/MarkHandler'

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
	const ref = useRef<HTMLElement>(null) as unknown as RefObject<T>

	if (token.type !== 'mark') {
		throw new Error('useMark can only be used with mark tokens')
	}

	const [mark] = useState(() => new MarkHandler<T>({ref, store, token}))

	useUncontrolledInit(ref, options, token)

	//Sync for state
	const readOnly = useStore(state => state.props.readOnly)
	useEffect(() => {
		mark.readOnly = readOnly
	}, [readOnly])

	return mark
}

function useUncontrolledInit(ref: RefObject<HTMLElement>, options: MarkOptions, token: MarkToken) {
	useEffect(() => {
		if (ref.current && !options.controlled) ref.current.textContent = token.content
	}, [])
}
