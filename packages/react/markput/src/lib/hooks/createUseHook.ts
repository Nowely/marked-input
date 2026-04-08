import {effect, setUseHookFactory} from '@markput/core'
import {useSyncExternalStore} from 'react'

setUseHookFactory((sig: unknown) => {
	// oxlint-disable-next-line no-unsafe-type-assertion -- sig is a Signal callable; cast to {(): unknown} to invoke it without a generic parameter
	const s = sig as {(): unknown}
	const subscribe = (cb: () => void) =>
		effect(() => {
			s()
			cb()
		})
	const getSnapshot = () => s()
	return () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
})