import type {MenuEntry, OverlayMatch, OverlayPick} from '@markput/core'
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
	/**
	 * The row menu: one entry per option declaring a `menu`, already narrowed by what was typed
	 * after the trigger. A menu component filters nothing.
	 */
	entries: readonly MenuEntry[]
	/**
	 * The one accept path. `{option}` turns the caret's row into that option's row kind and
	 * removes the trigger in the same splice; `{value, meta}` writes the trigger option's markup,
	 * which is what {@link select} does.
	 */
	choose: (pick: OverlayPick) => boolean
	match: OverlayMatch<Option> | undefined
	ref: RefObject<HTMLElement | null>
}

export function useOverlay(): OverlayHandler {
	const {match, entries, overlay} = useMarkput(s => ({
		match: s.overlay.match,
		entries: s.overlay.entries,
		overlay: s.overlay,
	}))

	const style = useMarkput(s => s.overlay.position())

	// close/select/choose/ref are framework-free glue and live on the controller; only the
	// reactive match/entries/style bindings are React's.
	return {
		match,
		entries,
		style,
		select: overlay.select,
		choose: overlay.choose,
		close: overlay.close,
		ref: overlay.ref,
	}
}