import type {MarkInfo} from '@markput/core'

import {useTokenContext} from '../providers/TokenContext'

/**
 * Mark metadata for the surrounding mark token context.
 *
 * Staleness note: the returned `address` is frozen at the last STRUCTURAL
 * render — text-path commits patch the DOM without re-rendering, so its token
 * object and position can lag the value. Feeding a lagging address to
 * position-sensitive APIs is fail-closed (the model bridges tokens by identity
 * and rejects replaced ones) — for mutations prefer handle-based flows
 * (`useMark`'s controller already bridges identity internally).
 */
export const useMarkInfo = (): MarkInfo => {
	const {token, address} = useTokenContext()
	if (token.type !== 'mark') throw new Error('useMarkInfo must be called within a mark token context')

	return {
		address,
		// One path segment per nesting level: a top-level token has depth 0.
		depth: address.path.length - 1,
		hasNestedMarks: token.children.some(child => child.type === 'mark'),
		key: address.path.join('.'),
	}
}