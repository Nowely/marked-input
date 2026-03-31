import type {MarkOptions, MarkToken} from '@markput/core'
import {MarkHandler} from '@markput/core'
import {useEffect, useRef, useState} from 'react'

import {useStore} from '../providers/StoreContext'
import {useToken} from '../providers/TokenContext'

export const useMark = <T extends HTMLElement = HTMLElement>(options: MarkOptions = {}): MarkHandler<T> => {
	const store = useStore()
	const token = useToken()
	if (token.type !== 'mark') throw new Error('useMark must be called within a mark token context')
	const ref = useRef<T>(null)

	const [mark] = useState(() => new MarkHandler<T>({ref, store, token}))

	useUncontrolledInit(ref, options, token)

	const readOnly = store.state.readOnly.use()
	useEffect(() => {
		mark.readOnly = readOnly
	}, [readOnly])

	return mark
}

function useUncontrolledInit(ref: {readonly current: HTMLElement | null}, options: MarkOptions, token: MarkToken) {
	useEffect(() => {
		if (!options.controlled && ref.current) ref.current.textContent = token.content
	}, [])
}