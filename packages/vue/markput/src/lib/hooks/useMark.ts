import type {MarkController} from '@markput/core'
import {MarkController as CoreMarkController} from '@markput/core'
import {inject} from 'vue'

import {TOKEN_KEY} from '../providers/tokenKey'
import {useMarkput} from './useMarkput'
import {useStore} from './useStore'

export const useMark = (): MarkController => {
	const store = useStore()
	const tokenRef = inject(TOKEN_KEY)

	if (!tokenRef) {
		throw new Error('Token not found. Make sure to use useMark inside a Token provider.')
	}

	const token = tokenRef.value
	if (token.type !== 'mark') throw new Error('useMark must be called within a mark token context')

	useMarkput(s => s.props.readOnly)
	return CoreMarkController.fromToken(store, token)
}