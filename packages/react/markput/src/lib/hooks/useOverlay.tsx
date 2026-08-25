import type {CoreOption, MenuEntry, OverlayMatch} from '@markput/core'
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
	 * Which gesture choosing an entry is on THIS row — `'insert'` on a row holding only the
	 * trigger, `'turnInto'` on a row with text. A label: `choose` runs the same splice either way.
	 */
	mode: 'insert' | 'turnInto' | undefined
	/**
	 * The one accept path. `{option}` turns the caret's row into that option's row kind and
	 * removes the trigger in the same splice; `{value, meta}` writes the trigger option's markup,
	 * which is what {@link select} does.
	 */
	choose: (pick: {option?: CoreOption; value?: string; meta?: string}) => boolean
	match: OverlayMatch<Option> | undefined
	ref: RefObject<HTMLElement | null>
}

export function useOverlay(): OverlayHandler {
	const {match, entries, mode, overlay} = useMarkput(s => ({
		match: s.overlay.match,
		entries: s.overlay.entries,
		mode: s.overlay.mode,
		overlay: s.overlay,
	}))

	const style = useMarkput(s => s.overlay.position())

	// close/select/choose/ref are framework-free glue and live on the controller; only the
	// reactive match/entries/mode/style bindings are React's.
	return {
		match,
		entries,
		mode,
		style,
		select: overlay.select,
		choose: overlay.choose,
		close: overlay.close,
		ref: overlay.ref,
	}
}