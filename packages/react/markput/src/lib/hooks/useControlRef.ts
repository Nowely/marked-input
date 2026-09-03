import type {RefCallback} from 'react'
import {useContext, useMemo} from 'react'

import {StoreContext} from '../providers/StoreContext'

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
 * A CONTEXT read, not a subscription: the store outlives every render of the editor it belongs
 * to, so there is nothing here for a signal to notify. Memoised because the registration is
 * keyed by the callback — calling `tokens.control()` inline files a fresh entry on every paint
 * and releases the old one only when React happens to run the detach.
 */
export const useControlRef = (): RefCallback<HTMLElement> => {
	const store = useContext(StoreContext)
	if (store === undefined) throw new Error('useControlRef must be called inside a MarkedInput')

	return useMemo(() => store.tokens.control(), [store])
}