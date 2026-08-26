import {KEYBOARD} from '../../shared/constants'

export type NavigationAction = 'up' | 'down' | 'select' | 'none'

export interface NavigationResult {
	action: NavigationAction
	index: number
}

/**
 * THE PROTOCOL, as arithmetic: a list that has rows takes the arrows and Enter, and a list that has
 * none takes nothing — `length === 0` is the only refusal left.
 *
 * IT HAS NO "NOTHING IS HIGHLIGHTED" CASE any more. {@link OverlayListModel.active} holds the first
 * row from the moment a list opens, so the NaN arms were three answers to a state that cannot
 * occur — and the one on Enter was a shipped defect: it declined the key, the row keymap split the
 * row, and the trigger the user had typed stayed in the document.
 */
export function navigateSuggestions(key: string, activeIndex: number, length: number): NavigationResult {
	if (length === 0) return {action: 'none', index: activeIndex}

	switch (key) {
		case KEYBOARD.UP:
			return {action: 'up', index: (length + ((activeIndex - 1) % length)) % length}
		case KEYBOARD.DOWN:
			return {action: 'down', index: (activeIndex + 1) % length}
		case KEYBOARD.ENTER:
			return {action: 'select', index: activeIndex}
		default:
			return {action: 'none', index: activeIndex}
	}
}