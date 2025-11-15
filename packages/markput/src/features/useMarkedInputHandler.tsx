import {ForwardedRef, useImperativeHandle} from 'react'
import {MarkedInputHandler} from '../types'
import {Store} from '@markput/core'
import {useStore} from '../utils/hooks/useStore'

const initHandler = (store: Store): MarkedInputHandler => ({
	get container() {
		return store.refs.container
	},
	get overlay() {
		return store.refs.overlay
	},
	focus() {
		store.focus.head?.focus()
	},
})

export function useMarkedInputHandler(ref: ForwardedRef<MarkedInputHandler>) {
	const store = useStore()
	useImperativeHandle(ref, () => initHandler(store), [store])
}
