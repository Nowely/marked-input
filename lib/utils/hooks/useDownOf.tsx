import {DependencyList} from 'react'
import {KEYBOARD} from '../../constants'
import {useListener} from './useListener'

export function useDownOf(key: KEYBOARD, callback: (event: KeyboardEvent) => void, deps: DependencyList = []) {
	useListener('keydown', (event) => {
		if (event.key === key) callback(event)
	}, deps)
}