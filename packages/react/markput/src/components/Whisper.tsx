import {memo, useEffect} from 'react'
import {useStore} from '../lib/hooks/useStore'
import {useSlot} from '../lib/hooks/useSlot'
import {Suggestions} from './Suggestions'

/**
 * Whisper component - renders the overlay component for suggestions
 *
 * This component:
 * 1. Gets overlay match from store
 * 2. Resolves Overlay component using useSlot with Suggestions as fallback
 * 3. Renders the resolved Overlay component when match is available
 */
export const Whisper = memo(() => {
	const store = useStore()
	const overlayMatch = useStore(state => state.overlayMatch)
	const key = useStore(state => (state.overlayMatch ? state.key.get(state.overlayMatch.option) : undefined))

	// Resolve Overlay component and props with Suggestions as default fallback
	const [Overlay, props] = useSlot('overlay', overlayMatch?.option, undefined, Suggestions)

	useEffect(() => {
		store.nodes.input.target = store.nodes.focus.target
	}, [key])

	if (key) return <Overlay key={key} {...(props ?? {})} />
})

Whisper.displayName = 'Whisper'
