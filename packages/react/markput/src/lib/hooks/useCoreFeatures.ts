import type {MarkputHandler, Store} from '@markput/core'
import {useEffect, useImperativeHandle, useLayoutEffect} from 'react'

import type {Option} from '../../types'

export function useCoreFeatures(store: Store, ref: React.Ref<MarkputHandler> | undefined) {
	useImperativeHandle(ref, () => store.handler, [store])

	useEffect(() => {
		store.lifecycle.enable<Option>({
			getTrigger: option => option.overlay?.trigger,
		})
		return () => store.lifecycle.disable()
	}, [])

	const value = store.state.value.use()
	const Mark = store.state.Mark.use()
	const coreOptions = store.state.options.use()
	const hasPerOptionMark = (coreOptions as Option[] | undefined)?.some(opt => opt.Mark != null)
	const options = Mark || hasPerOptionMark ? coreOptions : undefined
	const tokens = store.state.tokens.use()

	useEffect(() => {
		store.lifecycle.syncParser(value, options)
	}, [value, options])

	useLayoutEffect(() => {
		store.lifecycle.recoverFocus()
	}, [tokens])
}