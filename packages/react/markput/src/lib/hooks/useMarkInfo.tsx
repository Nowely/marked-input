import type {MarkInfo} from '@markput/core'
import {findToken} from '@markput/core'

import {useTokenContext} from '../providers/TokenContext'

/**
 * Mark metadata for the surrounding mark token context.
 *
 * Staleness note: the returned `address` is frozen at the last STRUCTURAL
 * render — text-path commits patch the DOM without re-rendering, so its token
 * object and position can lag the value. Feeding a lagging address to
 * position-sensitive APIs is fail-closed (the index's object-identity check
 * turns it into a no-op rather than acting on a stale range) — for mutations
 * prefer handle- or `freshAddressFor`-based flows (`useMark`'s controller
 * already bridges identity internally).
 */
export const useMarkInfo = (): MarkInfo => {
	const {store, token} = useTokenContext()
	if (token.type !== 'mark') throw new Error('useMarkInfo must be called within a mark token context')

	// The context token comes from the renderer's reference-stable structure()
	// tree, so it must be resolved against the structure-aligned index — the
	// fresh index drops stale token objects after text-path commits.
	const index = store.tokens.structureIndex()
	const path = index.pathFor(token)
	if (!path) throw new Error('Mark token is not indexed')
	const address = index.addressFor(path)
	if (!address) throw new Error('Mark token path is stale')

	const info = findToken(store.tokens.structure(), token)
	return {
		address,
		depth: info?.depth ?? 0,
		hasNestedMarks: token.children.some(child => child.type === 'mark'),
		key: index.key(path),
	}
}