import type {OverlayMatch} from '@markput/core'
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

	const style = useMarkput(s => s.overlay.position())

	const close = useCallback(() => overlay.close(), [overlay])
	const select = useCallback(
		(value: {value: string; meta?: string}) => overlay.choose(value.value, value.meta),
		[overlay]
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