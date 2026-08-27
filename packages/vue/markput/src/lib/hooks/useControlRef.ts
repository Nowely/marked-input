import {unwrapEl} from '../unwrapEl'
import {useStore} from './useStore'

/**
 * The ref a CONSUMER'S CONTROL takes: a toggle's arrow, a to-do's checkbox, a language
 * `<select>`, a view-tab bar. Everything a row's component paints sits inside the one
 * contenteditable container, and an element the editor knows nothing about is document content —
 * the caret enters it, the browser edits it, and what the user typed into a checkbox's label
 * lands in the value.
 *
 * The freeze `bind` performs is not an answer here: it walks a MARK's root down to its slot host
 * and freezes what hangs off that path, and a ROW is its own host, so nothing on a row's element
 * is ever walked. A control announces itself instead.
 *
 * CREATED ONCE IN `setup`, for the reason `Row.vue` records about `consign` and `children`: the
 * registration is keyed by the callback, so calling `tokens.control()` inside the ref itself
 * files a fresh entry on every paint and releases the old one only by chance.
 *
 * It takes Vue's ref ARGUMENT rather than an element, which is the one place this differs from
 * React's hook: a template ref on a component resolves to the instance, and a component whose
 * root is not an element has no element to register (`unwrapEl`).
 */
export const useControlRef = (): ((element: unknown) => void) => {
	const control = useStore().tokens.control()

	return (element: unknown) => control(unwrapEl(element))
}