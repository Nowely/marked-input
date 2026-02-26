import {useEffect, useState} from 'react'
import type {Reactive} from '@markput/core'

export function useReactive<T>(reactive: Reactive<T>): T {
	const [value, setValue] = useState(() => reactive.get())
	useEffect(() => reactive.subscribe(setValue), [reactive])
	return value
}
