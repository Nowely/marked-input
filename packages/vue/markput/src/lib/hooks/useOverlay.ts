import type {OverlayMatch} from '@markput/core'
import {Caret, createMarkFromOverlay} from '@markput/core'
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
	const store = useStore()
	const matchRef = useMarkput(s => s.state.overlayMatch) as Ref<OverlayMatch<Option> | undefined>

	const style = computed(() => {
		// Depend on matchRef so position recalculates as user types/moves caret
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _ = matchRef.value
		if (!matchRef.value) return {left: 0, top: 0}
		return Caret.getAbsolutePosition()
	})

	const close = () => store.event.overlayClose()
	const select = (value: {value: string; meta?: string}) => {
		const match = matchRef.value
		if (!match) return
		const mark = createMarkFromOverlay(match, value.value, value.meta)
		store.event.overlaySelect({mark, match})
		store.event.overlayClose()
	}

	const ref = {
		get current() {
			return store.state.overlay()
		},
		set current(v: HTMLElement | null) {
			store.state.overlay(v)
		},
	}

	return {match: matchRef, style, select, close, ref}
}