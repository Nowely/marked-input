import {useEffect, useState} from 'react'
import type {Signal} from '@markput/core'

export function useReactive<T>(signal: Signal<T>): T {
	const [value, setValue] = useState(() => signal())
	useEffect(() => signal.on(setValue), [signal])
	return value
}
