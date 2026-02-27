import type {RefObject} from 'react'
import {useCallback} from 'react'
import type {OverlayMatch, Token} from '@markput/core'
import {Caret} from '@markput/core'
import type {Option} from '../../types'
import {useStore} from './useStore'

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
	const match = useStore(store => store.state.overlayMatch.get()!)
	const style = Caret.getAbsolutePosition()

	const close = useCallback(() => store.state.$clearOverlay.emit(), [])
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
			store.state.$select.emit({mark, match})
			store.state.$clearOverlay.emit()
		},
		[match]
	)

	return {match, style, select, close, ref: {current: store.refs.overlay} as RefObject<HTMLElement>}
}
