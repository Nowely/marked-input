import type {MarkInfo} from '@markput/core'
import {toMarkInfo} from '@markput/core'

import {useTokenContext} from '../providers/TokenContext'

/** Mark metadata for the surrounding mark token context. */
export const useMarkInfo = (): MarkInfo => {
	const {token, path} = useTokenContext()
	if (token.type !== 'mark') throw new Error('useMarkInfo must be called within a mark token context')
	return toMarkInfo(token, path)
}