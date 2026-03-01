import {useState, useEffect} from 'react'
import type {Signal, UseHookFactory} from '@markput/core'

export function createUseSignalHook(): UseHookFactory {
	return <T>(signal: Signal<T>) =>
		() => {
			const [value, setValue] = useState(() => signal.get())
			useEffect(() => signal.on(setValue), [signal])
			return value
		}
}
