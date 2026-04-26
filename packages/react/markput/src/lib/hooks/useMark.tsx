import type {MarkController} from '@markput/core'
import {MarkController as CoreMarkController} from '@markput/core'
import {useMemo} from 'react'

import {useTokenContext} from '../providers/TokenContext'
import {useMarkput} from './useMarkput'

export const useMark = (): MarkController => {
	const {store, token} = useTokenContext()
	const readOnly = useMarkput(s => s.props.readOnly)
	if (token.type !== 'mark') throw new Error('useMark must be called within a mark token context')

	return useMemo(() => CoreMarkController.fromToken(store, token), [store, token, readOnly])
}