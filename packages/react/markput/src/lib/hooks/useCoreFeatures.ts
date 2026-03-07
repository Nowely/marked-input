import type {MarkputHandler, Store} from '@markput/core'
import {useEffect, useImperativeHandle} from 'react'

import type {Option} from '../../types'

export function useCoreFeatures(store: Store, ref: React.Ref<MarkputHandler> | undefined) {
	useImperativeHandle(ref, () => store.createHandler(), [store])

	useEffect(() => {
		store.lifecycle.enable<Option>({
			getTrigger: option => option.overlay?.trigger,
		})
		return () => store.lifecycle.disable()
	}, [])

	const value = store.state.value.use()
	const Mark = store.state.Mark.use()
	const coreOptions = store.state.options.use()
	const options = Mark ? coreOptions : undefined
	const tokens = store.state.tokens.use()

	useEffect(() => {
		store.lifecycle.syncParser(value, options)
	}, [value, options])

	useEffect(() => {
		store.lifecycle.recoverFocus()
	}, [tokens])
}