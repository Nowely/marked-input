import {memo} from 'react'
import {useSelector} from '../utils/hooks/useSelector'
import {Suggestions} from './Suggestions'

export const Whisper = memo(() => {
	// @ts-ignore TODO
	const key = useSelector(state => state.overlayMatch?.option.index)
	const Overlay = useSelector(state => state.Overlay ?? Suggestions)

	return key !== undefined ? <Overlay key={key}/> : null
})

Whisper.displayName = 'Whisper'