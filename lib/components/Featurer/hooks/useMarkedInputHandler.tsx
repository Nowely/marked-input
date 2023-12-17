import {ForwardedRef, useImperativeHandle} from 'react'
import {MarkedInputHandler} from '../../../types'
import {Store} from '../../../utils/classes/Store'
import {useStore} from '../../../utils/hooks/useStore'

const initHandler = (store: Store): MarkedInputHandler => ({
	get container() {
		return store.refs.container.current
	},
	get overlay() {
		return store.refs.overlay.current
	},
	focus() {
		store.pieces.head?.data.ref.current?.focus()
	}
})

export function useMarkedInputHandler(ref: ForwardedRef<MarkedInputHandler>) {
	const store = useStore()
	useImperativeHandle(ref, initHandler.bind(null, store), [])
}
