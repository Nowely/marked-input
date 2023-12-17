import {memo} from 'react'
import {useStore} from '../utils/hooks/useStore'
import {Suggestions} from './Suggestions'

export const Whisper = memo(() => {
	// @ts-ignore TODO
	const key = useStore(state => state.overlayMatch?.option.index)
	const Overlay = useStore(state => state.props.Overlay ?? Suggestions)

	return key !== undefined ? <Overlay key={key}/> : null
})

Whisper.displayName = 'Whisper'