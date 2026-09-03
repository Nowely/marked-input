import type {OverlayMatch, OverlayPick, OverlayRow} from '@markput/core'
import {computed, type Ref, type ComputedRef} from 'vue'

import type {Option} from '../../types'
import {useMarkput} from './useMarkput'
import {useStore} from './useStore'

export interface OverlayHandler {
	style: ComputedRef<{
		left: number
		top: number
	}>
	close: () => void
	select: (value: {value: string; meta?: string}) => void
	/**
	 * THE LIST the open overlay offers, already narrowed by what was typed after the trigger: the
	 * matched option's `overlay.data` when it declares any, and the ROW MENU — every option
	 * carrying a `menu` — when it declares none. An overlay component filters nothing and knows
	 * neither source; it paints `label` and hands `pick` back to {@link OverlayHandler.choose}.
	 */
	rows: Ref<readonly OverlayRow[]>
	/** Index into {@link OverlayHandler.rows} of the highlighted row; NaN when none is. */
	active: Ref<number>
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
	 * which is what {@link OverlayHandler.select} does.
	 */
	choose: (pick: OverlayPick) => boolean
	match: Ref<OverlayMatch<Option> | undefined>
	ref: {
		get current(): HTMLElement | null
		set current(v: HTMLElement | null)
	}
}

export function useOverlay(): OverlayHandler {
	const {overlay} = useStore()
	const matchRef = useMarkput(s => s.overlay.match) as Ref<OverlayMatch<Option> | undefined>
	const rows = useMarkput(s => s.overlay.list.rows)
	const active = useMarkput(s => s.overlay.list.active)

	// THROUGH `useMarkput`, which is the bridge between the two reactive systems. A Vue `computed`
	// calling `overlay.position()` directly tracks NOTHING — Vue cannot see a core signal — so the
	// popup stayed at whatever position it was first evaluated at, and the flip below, which is
	// decided only once the popup has a measured size, could never be applied at all.
	const position = useMarkput(s => s.overlay.position)
	const style = computed(() => position.value)

	// close/select/choose/activate/ref are framework-free glue and live on the controller; only
	// the reactive match/rows/active/style bindings are Vue's.
	return {
		match: matchRef,
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