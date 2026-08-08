import {key} from '@markput/core'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {Suggestions} from './Suggestions'

export const OverlayRenderer = memo(() => {
	const {match, resolveOverlay} = useMarkput(s => ({
		match: s.overlay.match,
		resolveOverlay: s.overlay.slot,
	}))
	const overlayKey = useMemo(() => (match ? key.get(match.option) : undefined), [match])

	const [Overlay, props] = resolveOverlay(match?.option, Suggestions)

	if (!overlayKey) return

	return <Overlay key={overlayKey} {...props} />
})

OverlayRenderer.displayName = 'OverlayRenderer'