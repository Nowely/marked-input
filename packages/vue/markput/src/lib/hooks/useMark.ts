import type {MarkNode} from '@markput/core'
import {inject} from 'vue'

import {TOKEN_KEY} from '../providers/tokenKey'

/**
 * The live mark node for the surrounding mark token context (spec §2.3) — a context READ
 * since S2.8. It used to be `store.tokens.markFor(token)`, a lookup FROM the render
 * projection BACK to the node behind it; with the projection gone the context carries the
 * node itself.
 *
 * Resolved ONCE in `setup`, which is safe by construction: adoption keeps a node object
 * exactly when it keeps its id, and a new id means a new key and a fresh component.
 */
export const useMark = (): MarkNode => {
	const contextRef = inject(TOKEN_KEY)

	if (!contextRef) {
		throw new Error('Token not found. Make sure to use useMark inside a Token provider.')
	}

	const node = contextRef.value.node
	if (node.kind !== 'mark') throw new Error('useMark must be called within a mark token context')

	return node
}