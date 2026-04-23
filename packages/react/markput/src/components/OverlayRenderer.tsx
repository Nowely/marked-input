import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {Suggestions} from './Suggestions'

export const OverlayRenderer = memo(() => {
	const {
		match,
		key: keyGen,
		resolveOverlay,
	} = useMarkput(s => ({
		match: s.overlay.match,
		key: s.key,
		resolveOverlay: s.overlay.slot,
	}))
	const key = useMemo(() => (match ? keyGen.get(match.option) : undefined), [match])

	const [Overlay, props] = resolveOverlay(match?.option, Suggestions)

	if (!key) return

	return <Overlay key={key} {...props} />
})

OverlayRenderer.displayName = 'OverlayRenderer'