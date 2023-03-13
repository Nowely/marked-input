import {memo} from 'react'
import {useSelector} from '../utils/useSelector'
import {Suggestions} from './Suggestions'

export const Whisper = memo(() => {
	const key = useSelector(state => state.trigger?.option.index)
	const Overlay = useSelector(state => state.Overlay ?? Suggestions)

	return key !== undefined ? <Overlay key={key}/> : null
})

Whisper.displayName = 'Whisper'