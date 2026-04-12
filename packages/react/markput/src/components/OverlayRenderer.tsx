import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/providers/StoreContext'
import {Suggestions} from './Suggestions'

export const OverlayRenderer = memo(() => {
	const store = useStore()
	const overlayMatch = useMarkput(s => s.state.overlayMatch)
	const key = useMemo(() => (overlayMatch ? store.key.get(overlayMatch.option) : undefined), [overlayMatch])

	const resolveOverlay = useMarkput(s => s.computed.overlay)
	const [Overlay, props] = resolveOverlay(overlayMatch?.option, Suggestions)

	if (!key) return

	return <Overlay key={key} {...props} />
})

OverlayRenderer.displayName = 'OverlayRenderer'