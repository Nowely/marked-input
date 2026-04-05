import {KEYBOARD} from '../../shared/constants'

export type NavigationAction = 'up' | 'down' | 'select' | 'none'

export interface NavigationResult {
	action: NavigationAction
	index: number
}

export function navigateSuggestions(key: string, activeIndex: number, length: number): NavigationResult {
	if (length === 0) return {action: 'none', index: activeIndex}

	const hasActive = !isNaN(activeIndex)

	switch (key) {
		case KEYBOARD.UP:
			return {action: 'up', index: hasActive ? (length + ((activeIndex - 1) % length)) % length : 0}
		case KEYBOARD.DOWN:
			return {action: 'down', index: hasActive ? (activeIndex + 1) % length : 0}
		case KEYBOARD.ENTER:
			return hasActive ? {action: 'select', index: activeIndex} : {action: 'none', index: activeIndex}
		default:
			return {action: 'none', index: activeIndex}
	}
}