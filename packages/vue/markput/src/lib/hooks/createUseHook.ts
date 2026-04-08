import {effect, setUseHookFactory} from '@markput/core'
import {type Ref, shallowRef, onUnmounted} from 'vue'

setUseHookFactory((sig: unknown) => () => {
	// oxlint-disable-next-line no-unsafe-type-assertion -- sig is a Signal callable; cast to {(): unknown} to invoke it without a generic parameter
	const s = sig as {(): unknown}
	const r = shallowRef(s())
	const stop = effect(() => {
		r.value = s()
	})
	onUnmounted(stop)
	return r as Ref<unknown>
})