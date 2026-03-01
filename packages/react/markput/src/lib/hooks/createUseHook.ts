import {useState, useEffect} from 'react'
import type {Signal} from '@markput/core'

export const createUseHook =
	<T>(signal: Signal<T>) =>
	() => {
		const [value, setValue] = useState(() => signal.get())
		useEffect(() => signal.on(setValue), [signal])
		return value
	}
