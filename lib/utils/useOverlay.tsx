import {RefObject, useCallback} from 'react'
import {SystemEvent} from '../constants'
import {MarkStruct, OverlayMatch} from '../types'
import {Caret} from './Caret'
import {useStore} from './index'
import {useSelector} from './useSelector'

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
	select: (value: MarkStruct) => void
	/**
	 * Overlay match details
	 */
	match: OverlayMatch
	ref: RefObject<HTMLElement>
}

export function useOverlay(): OverlayHandler {
	const store = useStore()
	const match = useSelector(state => state.overlayMatch!)
	const style = Caret.getAbsolutePosition()

	const close = useCallback(() => store.bus.send(SystemEvent.ClearTrigger), [])
	const select = useCallback((value: MarkStruct) => {
		store.bus.send(SystemEvent.Select, {value, match})
		store.bus.send(SystemEvent.ClearTrigger)
	}, [match])

	return {match, style, select, close, ref: store.overlayRef}
}