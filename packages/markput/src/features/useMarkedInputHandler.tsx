import type {ForwardedRef} from 'react'
import {useImperativeHandle} from 'react'
import type {MarkedInputHandler} from '../types'
import type {Store} from '@markput/core'
import {useStore} from '../utils/hooks/useStore'

const initHandler = (store: Store): MarkedInputHandler => ({
	get container() {
		return store.refs.container
	},
	get overlay() {
		return store.refs.overlay
	},
	focus() {
		store.nodes.focus.head?.focus()
	},
})

export function useMarkedInputHandler(ref: ForwardedRef<MarkedInputHandler>) {
	const store = useStore()
	useImperativeHandle(ref, () => initHandler(store), [store])
}
