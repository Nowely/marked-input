import {setUseHookFactory, watch} from '@markput/core'
import {useSyncExternalStore} from 'react'

setUseHookFactory((sig: unknown) => {
	// oxlint-disable-next-line no-unsafe-type-assertion -- sig is a Signal callable; cast to {(): unknown} to invoke it without a generic parameter
	const s = sig as {(): unknown}
	const subscribe = (cb: () => void) => watch(s, cb)
	const getSnapshot = () => s()
	return () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
})