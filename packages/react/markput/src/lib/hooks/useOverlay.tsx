import type {OverlayMatch} from '@markput/core'
import {Caret, createMarkFromOverlay} from '@markput/core'
import type {RefObject} from 'react'
import {useCallback, useMemo} from 'react'

import type {Option} from '../../types'
import {useStore} from '../providers/StoreContext'

export interface OverlayHandler {
	style: {
		left: number
		top: number
	}
	close: () => void
	select: (value: {value: string; meta?: string}) => void
	match: OverlayMatch<Option>
	ref: RefObject<HTMLElement | null>
}

export function useOverlay(): OverlayHandler {
	const store = useStore()
	const match = store.state.overlayMatch.use()
	if (!match) throw new Error('useOverlay requires an active overlay match')
	const style = useMemo(() => Caret.getAbsolutePosition(), [match])

	const close = useCallback(() => store.on.clearOverlay.emit(), [])
	const select = useCallback(
		(value: {value: string; meta?: string}) => {
			const mark = createMarkFromOverlay(match, value.value, value.meta)
			store.on.select.emit({mark, match})
			store.on.clearOverlay.emit()
		},
		[match]
	)

	const ref = useMemo(
		(): RefObject<HTMLElement | null> => ({
			get current() {
				return store.refs.overlay
			},
			set current(v: HTMLElement | null) {
				store.refs.overlay = v
			},
		}),
		[]
	)

	return {match, style, select, close, ref}
}