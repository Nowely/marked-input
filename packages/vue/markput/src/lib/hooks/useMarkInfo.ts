import type {MarkInfo} from '@markput/core'
import {inject} from 'vue'

import {TOKEN_KEY} from '../providers/tokenKey'

/** Mark metadata for the surrounding mark token context. */
export const useMarkInfo = (): MarkInfo => {
	const contextRef = inject(TOKEN_KEY)
	if (!contextRef) throw new Error('Token not found. Make sure to use useMarkInfo inside a Token provider.')

	const {path, token} = contextRef.value
	if (token.type !== 'mark') throw new Error('useMarkInfo must be called within a mark token context')
	if (token.id === undefined) throw new Error('useMarkInfo: mark token has no id (not reconciled)')

	return {
		id: token.id,
		path,
		// One path segment per nesting level: a top-level token has depth 0.
		depth: path.length - 1,
		hasNestedMarks: token.children.some(child => child.type === 'mark'),
		key: path.join('.'),
	}
}