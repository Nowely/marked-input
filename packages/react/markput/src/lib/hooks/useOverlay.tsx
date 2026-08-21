import type {OverlayMatch} from '@markput/core'
import type {RefObject} from 'react'

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

	// close/select/ref are framework-free glue and live on the controller; only the reactive
	// match/style bindings are React's.
	return {match, style, select: overlay.select, close: overlay.close, ref: overlay.ref}
}