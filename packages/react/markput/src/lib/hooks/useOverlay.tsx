import type {OverlayMatch, Token} from '@markput/core'
import {Caret} from '@markput/core'
import type {RefObject} from 'react'
import {useCallback, useMemo} from 'react'

import type {Option} from '../../types'
import {useStore} from '../providers/StoreContext'

export interface OverlayHandler {
	style: {
		left: number
		top: number
	}
	close: () => void
	select: (value: {value: string; meta?: string}) => void
	match: OverlayMatch<Option>
	ref: RefObject<HTMLElement>
}

export function useOverlay(): OverlayHandler {
	const store = useStore()
	const match = store.state.overlayMatch.use()!
	const style = Caret.getAbsolutePosition()

	const close = useCallback(() => store.events.clearOverlay(), [])
	const select = useCallback(
		(value: {value: string; meta?: string}) => {
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
		},
		[match]
	)

	const ref = useMemo<RefObject<HTMLElement>>(
		() =>
			({
				get current() {
					return store.refs.overlay
				},
				set current(v: HTMLElement | null) {
					store.refs.overlay = v
				},
			}) as RefObject<HTMLElement>,
		[]
	)

	return {match, style, select, close, ref}
}