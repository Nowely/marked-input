import type {MarkOptions, MarkToken} from '@markput/core'
import {MarkHandler} from '@markput/core'
import {useEffect, useMemo, useRef} from 'react'

import {useToken} from '../providers/TokenContext'
import {useMarkput} from './useMarkput'

export const useMark = <T extends HTMLElement = HTMLElement>(options: MarkOptions = {}): MarkHandler<T> => {
	const {store, readOnly} = useMarkput(s => ({store: s, readOnly: s.props.readOnly}))
	const token = useToken()
	if (token.type !== 'mark') throw new Error('useMark must be called within a mark token context')
	const ref = useRef<T>(null)

	const mark = useMemo(() => new MarkHandler<T>({ref, store, token}), [store, token])

	useUncontrolledInit(ref, options, token)

	useEffect(() => {
		mark.readOnly = readOnly
	}, [mark, readOnly])

	return mark
}

function useUncontrolledInit(ref: {readonly current: HTMLElement | null}, options: MarkOptions, token: MarkToken) {
	useEffect(() => {
		if (!options.controlled && ref.current) ref.current.textContent = token.content
	}, [])
}