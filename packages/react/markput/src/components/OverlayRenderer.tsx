import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {Suggestions} from './Suggestions'

export const OverlayRenderer = memo(() => {
	const {
		overlayMatch,
		key: keyGen,
		resolveOverlay,
	} = useMarkput(s => ({
		overlayMatch: s.feature.overlay.state.overlayMatch,
		key: s.key,
		resolveOverlay: s.feature.overlay.computed.overlaySlot,
	}))
	const key = useMemo(() => (overlayMatch ? keyGen.get(overlayMatch.option) : undefined), [overlayMatch])

	const [Overlay, props] = resolveOverlay(overlayMatch?.option, Suggestions)

	if (!key) return

	return <Overlay key={key} {...props} />
})

OverlayRenderer.displayName = 'OverlayRenderer'