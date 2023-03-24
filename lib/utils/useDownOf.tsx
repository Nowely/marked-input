import {DependencyList, KeyboardEvent} from 'react'
import {KEY} from '../constants'
import {useContainerListener} from './useListener'

export function useDownOf(key: KEY, callback: (event: KeyboardEvent<HTMLSpanElement>) => void, deps: DependencyList = []) {
	useContainerListener('keydown', (event) => {
		if (event.key === key) callback(event)
	}, deps)
}