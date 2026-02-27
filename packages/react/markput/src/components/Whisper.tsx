import {memo, useEffect} from 'react'
import {useStore} from '../lib/hooks/useStore'
import {useSlot} from '../lib/hooks/useSlot'
import {Suggestions} from './Suggestions'

export const Whisper = memo(() => {
	const store = useStore()
	const overlayMatch = useStore(state => state.state.overlayMatch.get())
	const key = useStore(state => {
		const match = state.state.overlayMatch.get()
		return match ? state.key.get(match.option) : undefined
	})

	const [Overlay, props] = useSlot('overlay', overlayMatch?.option, undefined, Suggestions)

	useEffect(() => {
		store.nodes.input.target = store.nodes.focus.target
	}, [key])

	if (key) return <Overlay key={key} {...(props ?? {})} />
})

Whisper.displayName = 'Whisper'
