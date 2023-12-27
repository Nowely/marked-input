import {memo, useEffect} from 'react'
import {getKey} from '../utils/functions/getKey'
import {useStore} from '../utils/hooks/useStore'
import {Suggestions} from './Suggestions'

export const Whisper = memo(() => {
	const store = useStore()
	const key = useStore(state => state.overlayMatch ? getKey(state.overlayMatch.option) : undefined)
	const Overlay = useStore(state => state.props.Overlay ?? Suggestions)

	useEffect(() => {
		store.input.target = store.focus.target
	}, [key])

	if (key)
		return <Overlay key={key}/>
})

Whisper.displayName = 'Whisper'