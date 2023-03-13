import {ForwardedRef, useImperativeHandle} from 'react'
import {MarkedInputHandler} from '../../../types'
import {useStore} from '../../../utils'
import {Store} from '../../../utils/Store'

const initHandler = (store: Store): MarkedInputHandler => ({
	get container() {
		return store.containerRef.current
	},
	get overlay() {
		return store.overlayRef.current
	},
	focus() {
		store.state.pieces.head?.data.ref.current?.focus()
	}
})

export function useMarkedInputHandler(ref: ForwardedRef<MarkedInputHandler>) {
	const store = useStore()
	useImperativeHandle(ref, initHandler.bind(null, store), [])
}
