import type {OverlayMatch} from '@markput/core'
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
	match: Ref<OverlayMatch<Option> | undefined>
	ref: {
		get current(): HTMLElement | null
		set current(v: HTMLElement | null)
	}
}

export function useOverlay(): OverlayHandler {
	const {overlay} = useStore()
	const matchRef = useMarkput(s => s.overlay.match) as Ref<OverlayMatch<Option> | undefined>

	const style = computed(() => overlay.position())

	// close/select/ref are framework-free glue and live on the controller; only the reactive
	// match/style bindings are Vue's.
	return {match: matchRef, style, select: overlay.select, close: overlay.close, ref: overlay.ref}
}