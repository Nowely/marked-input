import {DependencyList} from 'react'
import {KEY} from '../../constants'
import {useListener} from './useListener'

export function useDownOf(key: KEY, callback: (event: KeyboardEvent) => void, deps: DependencyList = []) {
	useListener('keydown', (event) => {
		if (event.key === key) callback(event)
	}, deps)
}