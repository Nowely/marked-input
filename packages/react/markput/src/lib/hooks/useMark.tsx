import type {MarkToken} from '@markput/core'
import {MarkHandler} from '@markput/core'
import type {RefObject} from 'react'
import {useEffect, useRef, useState} from 'react'

import {useToken} from '../providers/TokenProvider'
import {useStore} from './useStore'

export interface MarkOptions {
	controlled?: boolean
}

export const useMark = <T extends HTMLElement = HTMLElement>(options: MarkOptions = {}): MarkHandler<T> => {
	const store = useStore()
	const token = useToken()
	const ref = useRef<HTMLElement>(null) as unknown as RefObject<T>

	if (token.type !== 'mark') {
		throw new Error('useMark can only be used with mark tokens')
	}

	const [mark] = useState(() => new MarkHandler<T>({ref, store, token: token as MarkToken}))

	useUncontrolledInit(ref, options, token as MarkToken)

	const readOnly = store.state.readOnly.use()
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