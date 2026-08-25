import type {MenuEntry, OverlayMatch, OverlayPick} from '@markput/core'
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
	 * The row menu: one entry per option declaring a `menu`, already narrowed by what was typed
	 * after the trigger. A menu component filters nothing.
	 */
	entries: Ref<readonly MenuEntry[]>
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
	const entries = useMarkput(s => s.overlay.entries)

	const style = computed(() => overlay.position())

	// close/select/choose/ref are framework-free glue and live on the controller; only the
	// reactive match/entries/style bindings are Vue's.
	return {
		match: matchRef,
		entries,
		style,
		select: overlay.select,
		choose: overlay.choose,
		close: overlay.close,
		ref: overlay.ref,
	}
}