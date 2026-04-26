import type {OverlayMatch} from '@markput/core'
import {Caret, createMarkFromOverlay} from '@markput/core'
import type {RefObject} from 'react'
import {useCallback, useMemo} from 'react'

import type {Option} from '../../types'
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
	const {match, overlay} = useMarkput(s => ({match: s.overlay.match, overlay: s.overlay}))

	const style = useMemo(() => {
		if (!match) return {left: 0, top: 0}
		return Caret.getAbsolutePosition()
	}, [match])

	const close = useCallback(() => overlay.close(), [overlay])
	const select = useCallback(
		(value: {value: string; meta?: string}) => {
			if (!match) return
			const mark = createMarkFromOverlay(match, value.value, value.meta)
			overlay.select({mark, match})
			overlay.close()
		},
		[match, overlay]
	)

	const ref = useMemo(
		(): RefObject<HTMLElement | null> => ({
			get current() {
				return overlay.element()
			},
			set current(v: HTMLElement | null) {
				overlay.element(v)
			},
		}),
		[overlay]
	)

	return {match, style, select, close, ref}
}