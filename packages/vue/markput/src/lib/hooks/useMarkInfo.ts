import type {MarkInfo} from '@markput/core'
import {toMarkInfo} from '@markput/core'
import {inject} from 'vue'

import {TOKEN_KEY} from '../providers/tokenKey'

/** Mark metadata for the surrounding mark token context. */
export const useMarkInfo = (): MarkInfo => {
	const contextRef = inject(TOKEN_KEY)
	if (!contextRef) throw new Error('Token not found. Make sure to use useMarkInfo inside a Token provider.')

	const {depth, node} = contextRef.value
	if (node.kind !== 'mark') throw new Error('useMarkInfo must be called within a mark token context')
	return toMarkInfo(node, depth)
}