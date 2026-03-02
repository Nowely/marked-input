import {type Ref, shallowRef} from 'vue'
import type {Signal} from '@markput/core'

export const createUseHook =
	<T>(signal: Signal<T>) =>
	(): Ref<T> => {
		const value = shallowRef(signal.get()) as Ref<T>
		signal.on(v => {
			value.value = v
		})
		return value
	}
