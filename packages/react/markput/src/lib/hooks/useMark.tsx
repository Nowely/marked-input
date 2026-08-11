import type {MarkNode} from '@markput/core'

import {useTokenContext} from '../providers/TokenContext'
import {useMarkput} from './useMarkput'

/**
 * The live mark node for the surrounding mark token context (spec §2.3) — a context READ
 * since S2.8. It used to be `store.tokens.markFor(token)`, a lookup FROM the render
 * projection BACK to the node behind it; with the projection gone the context carries the
 * node itself.
 */
export const useMark = (): MarkNode => {
	const {node} = useTokenContext()
	// Subscribe to readOnly changes to trigger a re-render when it changes; the node's write
	// verbs read readOnly lazily, so the retained node is correct either way.
	useMarkput(s => s.props.readOnly)
	if (node.kind !== 'mark') throw new Error('useMark must be called within a mark token context')

	return node
}