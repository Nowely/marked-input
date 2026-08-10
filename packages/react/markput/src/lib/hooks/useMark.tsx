import type {MarkNode} from '@markput/core'
import {useMemo} from 'react'

import {useTokenContext} from '../providers/TokenContext'
import {useMarkput} from './useMarkput'

/** The live mark node for the surrounding mark token context (spec §2.3). */
export const useMark = (): MarkNode => {
	const {store, token} = useTokenContext()
	// Subscribe to readOnly changes to trigger a re-render when it changes; the node's write
	// verbs read readOnly lazily, so the retained node is correct either way.
	useMarkput(s => s.props.readOnly)
	if (token.type !== 'mark') throw new Error('useMark must be called within a mark token context')

	return useMemo(() => store.tokens.markFor(token), [store, token])
}