import type {OverlayMatch} from '@markput/core'
import {Caret, createMarkFromOverlay} from '@markput/core'
import type {RefObject} from 'react'
import {useCallback, useMemo} from 'react'

import type {Option} from '../../types'
import {useMarkput} from './useMarkput'

export interface OverlayHandler {
	style: {
		left: number
		top: number
	}
	close: () => void
	select: (value: {value: string; meta?: string}) => void
	match: OverlayMatch<Option> | undefined
	ref: RefObject<HTMLElement | null>
}

export function useOverlay(): OverlayHandler {
	const {match, emit, state} = useMarkput(s => ({
		match: s.state.overlayMatch,
		emit: s.emit,
		state: s.state,
	}))

	const style = useMemo(() => {
		if (!match) return {left: 0, top: 0}
		return Caret.getAbsolutePosition()
	}, [match])

	const close = useCallback(() => emit.overlayClose(), [])
	const select = useCallback(
		(value: {value: string; meta?: string}) => {
			if (!match) return
			const mark = createMarkFromOverlay(match, value.value, value.meta)
			emit.overlaySelect({mark, match})
			emit.overlayClose()
		},
		[match]
	)

	const ref = useMemo(
		(): RefObject<HTMLElement | null> => ({
			get current() {
				return state.overlay()
			},
			set current(v: HTMLElement | null) {
				state.overlay(v)
			},
		}),
		[]
	)

	return {match, style, select, close, ref}
}