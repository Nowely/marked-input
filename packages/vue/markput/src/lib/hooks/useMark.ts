import type {MarkNode} from '@markput/core'
import {inject} from 'vue'

import {TOKEN_KEY} from '../providers/tokenKey'
import {useMarkput} from './useMarkput'
import {useStore} from './useStore'

/**
 * The live mark node for the surrounding mark token context (spec §2.3).
 *
 * Resolved ONCE in `setup`, which is safe by construction: adoption keeps a node object
 * exactly when it keeps its id, and a new id means a new `keyOf` and a fresh component.
 */
export const useMark = (): MarkNode => {
	const store = useStore()
	const contextRef = inject(TOKEN_KEY)

	if (!contextRef) {
		throw new Error('Token not found. Make sure to use useMark inside a Token provider.')
	}

	const token = contextRef.value.token
	if (token.type !== 'mark') throw new Error('useMark must be called within a mark token context')

	useMarkput(s => s.props.readOnly)
	return store.tokens.markFor(token)
}