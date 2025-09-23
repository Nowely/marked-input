import {DependencyList} from 'react'
import {useListener} from './useListener'
import {KEYBOARD} from '@markput/core'

export function useDownOf(key: KEYBOARD, callback: (event: KeyboardEvent) => void, deps: DependencyList = []) {
	useListener(
		'keydown',
		event => {
			if (event.key === key) callback(event)
		},
		deps
	)
}
