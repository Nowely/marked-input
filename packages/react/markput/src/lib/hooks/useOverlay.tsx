import type {OverlayMatch, OverlayPick, OverlayRow} from '@markput/core'
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
	 * THE LIST the open overlay offers, already narrowed by what was typed after the trigger: the
	 * matched option's `overlay.data` when it declares any, and the ROW MENU — every option
	 * carrying a `menu` — when it declares none. An overlay component filters nothing and knows
	 * neither source; it paints `label` and hands `pick` back to {@link OverlayHandler.choose}.
	 */
	rows: readonly OverlayRow[]
	/** Index into {@link OverlayHandler.rows} of the highlighted row; NaN when none is. */
	active: number
	/**
	 * Bind the list's keyboard protocol — arrows move the highlight, Enter chooses — to the
	 * editing host, and return the unbind. OPT-IN, because an overlay that is not a list must not
	 * swallow those keys: the built-in component calls it on mount, and a custom one calls it to
	 * get the same contract.
	 */
	activate: () => () => void
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
	const {match, rows, active, overlay} = useMarkput(s => ({
		match: s.overlay.match,
		rows: s.overlay.list.rows,
		active: s.overlay.list.active,
		overlay: s.overlay,
	}))

	// THE COMPUTED, not its value. `useMarkput` calls its selector ONCE, so `position()` handed
	// back a plain `{left, top}` that was then frozen for the whole life of the overlay component
	// — and the component is keyed by the matched OPTION, so it does not remount between
	// keystrokes. The popup therefore stayed at the position it opened at, and the flip below,
	// which is decided only once the popup has a measured size, could never be applied at all.
	const style = useMarkput(s => s.overlay.position)

	// close/select/choose/activate/ref are framework-free glue and live on the controller; only
	// the reactive match/rows/active/style bindings are React's.
	return {
		match,
		rows,
		active,
		style,
		select: overlay.select,
		choose: overlay.choose,
		activate: overlay.list.activate,
		close: overlay.close,
		ref: overlay.ref,
	}
}