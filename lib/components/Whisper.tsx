import {memo} from 'react'
import {useSelector} from '../utils/useSelector'
import {Suggestions} from './Suggestions'

export const Whisper = memo(() => {
	const key = useSelector(state => state.options.indexOf(state.overlayMatch?.option ?? {}))
	const Overlay = useSelector(state => state.Overlay ?? Suggestions)

	return key !== -1 ? <Overlay key={key}/> : null
})

Whisper.displayName = 'Whisper'