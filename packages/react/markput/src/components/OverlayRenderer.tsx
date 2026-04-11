import {memo, useMemo} from 'react'

import {useStore} from '../lib/providers/StoreContext'
import {Suggestions} from './Suggestions'

export const OverlayRenderer = memo(() => {
	const store = useStore()
	const overlayMatch = store.state.overlayMatch.use()
	const key = useMemo(() => (overlayMatch ? store.key.get(overlayMatch.option) : undefined), [overlayMatch])

	const resolveOverlay = store.computed.overlay.use()
	const [Overlay, props] = resolveOverlay(overlayMatch?.option, Suggestions)

	if (!key) return

	return <Overlay key={key} {...props} />
})

OverlayRenderer.displayName = 'OverlayRenderer'