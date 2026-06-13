import type {MarkInfo} from '@markput/core'

import {useTokenContext} from '../providers/TokenContext'

/** Mark metadata for the surrounding mark token context. */
export const useMarkInfo = (): MarkInfo => {
	const {token, path} = useTokenContext()
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