import type {CoreOption} from '@markput/core'
import type {ComponentType} from 'react'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/providers/StoreContext'
import type {OverlayProps} from '../types'
import {Suggestions} from './Suggestions'

export const OverlayRenderer = memo(() => {
	const store = useStore()
	const overlayMatch = useMarkput(s => s.state.overlayMatch)
	const key = useMemo(() => (overlayMatch ? store.key.get(overlayMatch.option) : undefined), [overlayMatch])

	// oxlint-disable-next-line no-unsafe-type-assertion -- OverlaySlot returns [unknown, unknown] in core; React-specific type asserted here
	const resolveOverlay = useMarkput(s => s.computed.overlay) as (
		option?: CoreOption,
		defaultComponent?: unknown
	) => readonly [ComponentType<OverlayProps>, OverlayProps]
	const [Overlay, props] = resolveOverlay(overlayMatch?.option, Suggestions)

	if (!key) return

	return <Overlay key={key} {...props} />
})

OverlayRenderer.displayName = 'OverlayRenderer'