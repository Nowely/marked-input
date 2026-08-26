import {key} from '@markput/core'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {OverlayList} from './OverlayList/OverlayList'

export const OverlayRenderer = memo(() => {
	const {match, resolveOverlay} = useMarkput(s => ({
		match: s.overlay.match,
		resolveOverlay: s.overlay.slot,
	}))
	const overlayKey = useMemo(() => (match ? key.get(match.option) : undefined), [match])

	const [Overlay, props] = resolveOverlay(match?.option, OverlayList)

	if (!overlayKey) return

	return <Overlay key={overlayKey} {...props} />
})

OverlayRenderer.displayName = 'OverlayRenderer'