import {memo, useMemo} from 'react'

import {useSlot} from '../lib/hooks/useSlot'
import {useStore} from '../lib/providers/StoreContext'
import {Suggestions} from './Suggestions'

export const OverlayRenderer = memo(() => {
	const store = useStore()
	const overlayMatch = store.state.overlayMatch.use()
	const key = useMemo(() => (overlayMatch ? store.key.get(overlayMatch.option) : undefined), [overlayMatch])

	const [Overlay, props] = useSlot('overlay', overlayMatch?.option, undefined, Suggestions)

	if (key) return <Overlay key={key} {...(props ?? {})} />
})

OverlayRenderer.displayName = 'OverlayRenderer'