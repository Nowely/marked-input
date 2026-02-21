import type {Ref} from 'react'
import {useImperativeHandle} from 'react'
import type {MarkedInputHandler} from '../types'
import type {Store} from '@markput/core'
import {useStore} from '../lib/hooks/useStore'

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

export function useMarkedInputHandler(ref?: Ref<MarkedInputHandler>) {
	const store = useStore()
	useImperativeHandle(ref, () => initHandler(store), [store])
}
