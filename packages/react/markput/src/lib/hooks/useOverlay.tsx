import type {OverlayMatch, Store} from '@markput/core'
import {Caret, createMarkFromOverlay} from '@markput/core'
import type {RefObject} from 'react'
import {useCallback, useContext, useMemo, useRef} from 'react'

import type {Option} from '../../types'
import {StoreContext} from '../providers/StoreContext'
import {useMarkput} from './useMarkput'

export interface OverlayHandler {
	style: {
		left: number
		top: number
	}
	close: () => void
	select: (value: {value: string; meta?: string}) => void
	match: OverlayMatch<Option> | undefined
	ref: RefObject<HTMLElement | null>
}

export function useOverlay(): OverlayHandler {
	const match = useMarkput(s => s.feature.overlay.overlayMatch)
	const storeRef = useRef<Store | null>(null)
	if (storeRef.current === null) {
		const ctx = useContext(StoreContext)
		if (!ctx) throw new Error('Store not found')
		storeRef.current = ctx
	}
	const store = storeRef.current

	const style = useMemo(() => {
		if (!match) return {left: 0, top: 0}
		return Caret.getAbsolutePosition()
	}, [match])

	const close = useCallback(() => store.feature.overlay.overlayClose(), [store])
	const select = useCallback(
		(value: {value: string; meta?: string}) => {
			if (!match) return
			const mark = createMarkFromOverlay(match, value.value, value.meta)
			store.feature.overlay.overlaySelect({mark, match})
			store.feature.overlay.overlayClose()
		},
		[match, store]
	)

	const ref = useMemo(
		(): RefObject<HTMLElement | null> => ({
			get current() {
				return store.feature.overlay.overlay()
			},
			set current(v: HTMLElement | null) {
				store.feature.overlay.overlay(v)
			},
		}),
		[store]
	)

	return {match, style, select, close, ref}
}