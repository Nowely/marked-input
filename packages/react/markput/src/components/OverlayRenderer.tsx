import type {ComponentType} from 'react'
import {memo, useMemo} from 'react'

import {useStore} from '../lib/providers/StoreContext'
import type {OverlayProps} from '../types'
import {Suggestions} from './Suggestions'

export const OverlayRenderer = memo(() => {
	const store = useStore()
	const overlayMatch = store.state.overlayMatch.use()
	const key = useMemo(() => (overlayMatch ? store.key.get(overlayMatch.option) : undefined), [overlayMatch])

	const result = store.slot.overlay.use(overlayMatch?.option, Suggestions)
	const [Overlay, props] = result as readonly [ComponentType<any>, OverlayProps]

	if (key) return <Overlay key={key} {...(props ?? {})} />
})

OverlayRenderer.displayName = 'OverlayRenderer'