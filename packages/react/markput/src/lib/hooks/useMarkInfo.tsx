import type {MarkInfo} from '@markput/core'
import {findToken} from '@markput/core'

import {useTokenContext} from '../providers/TokenContext'

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