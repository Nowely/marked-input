import type {OverlayMatch, Token} from '@markput/core'
import {Caret} from '@markput/core'
import {computed, type Ref, type ComputedRef} from 'vue'

import type {Option} from '../../types'
import {useStore} from './useStore'

export interface OverlayHandler {
	style: ComputedRef<{
		left: string
		top: string
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
	const matchRef = store.state.overlayMatch.use() as Ref<OverlayMatch<Option> | undefined>

	const style = computed(() => {
		// Depend on matchRef so position recalculates as user types/moves caret
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _ = matchRef.value
		const pos = Caret.getAbsolutePosition()
		return {
			left: `${pos.left}px`,
			top: `${pos.top}px`,
		}
	})

	const close = () => store.events.clearOverlay()
	const select = (value: {value: string; meta?: string}) => {
		const match = matchRef.value
		if (!match) return
		const mark: Token = {
			type: 'mark',
			value: value.value,
			meta: value.meta,
			content: '',
			position: {start: match.index, end: match.index + match.span.length},
			descriptor: {
				index: 0,
				markup: match.option.markup,
			} as any,
			children: [],
			nested: undefined,
		}
		store.events.select({mark, match})
		store.events.clearOverlay()
	}

	const ref = {
		get current() {
			return store.refs.overlay
		},
		set current(v: HTMLElement | null) {
			store.refs.overlay = v
		},
	}

	return {match: matchRef, style, select, close, ref}
}