import type {Signal} from '@markput/core'
import {useState, useEffect} from 'react'

export const createUseHook =
	<T>(signal: Signal<T>) =>
	() => {
		const [value, setValue] = useState(() => signal.get())
		useEffect(() => signal.on(setValue), [signal])
		return value
	}