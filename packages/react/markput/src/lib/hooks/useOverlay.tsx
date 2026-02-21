import type {RefObject} from 'react'
import {useCallback} from 'react'
import type {OverlayMatch, Token} from '@markput/core'
import {Caret, SystemEvent} from '@markput/core'
import type {Option} from '../../types'
import {useStore} from './useStore'

export interface OverlayHandler {
	/**
	 * Style with caret absolute position. Used for placing an overlay.
	 */
	style: {
		left: number
		top: number
	}
	/**
	 * Used for close overlay.
	 */
	close: () => void
	/**
	 * Used for insert an annotation instead a triggered value.
	 */
	select: (value: {value: string; meta?: string}) => void
	/**
	 * Overlay match details
	 */
	match: OverlayMatch<Option>
	ref: RefObject<HTMLElement>
}

export function useOverlay(): OverlayHandler {
	const store = useStore()
	const match = useStore(store => store.overlayMatch!)
	const style = Caret.getAbsolutePosition()

	const close = useCallback(() => store.bus.send(SystemEvent.ClearTrigger), [])
	const select = useCallback(
		(value: {value: string; meta?: string}) => {
			// Create a temporary MarkToken for the event
			const mark: Token = {
				type: 'mark',
				value: value.value,
				meta: value.meta,
				content: '',
				position: {start: match.index, end: match.index + match.span.length},
				descriptor: {
					index: 0, // TODO: get correct index
					markup: match.option.markup,
				} as any, // TODO: fix typing
				children: [],
				nested: undefined,
			}
			store.bus.send(SystemEvent.Select, {mark, match})
			store.bus.send(SystemEvent.ClearTrigger)
		},
		[match]
	)

	return {match, style, select, close, ref: {current: store.refs.overlay} as RefObject<HTMLElement>}
}
