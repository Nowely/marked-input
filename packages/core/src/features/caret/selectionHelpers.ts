import type {Store} from '../../store'

export function isFullSelection(store: Store): boolean {
	const sel = window.getSelection()
	const container = store.feature.slots.container()
	if (!sel?.rangeCount || !container?.firstChild || !container.lastChild) return false

	try {
		const range = sel.getRangeAt(0)
		return (
			container.contains(range.startContainer) &&
			container.contains(range.endContainer) &&
			range.toString().length > 0
		)
	} catch {
		return false
	}
}

export function selectAllText(store: Store, event: KeyboardEvent): void {
	if ((event.ctrlKey || event.metaKey) && event.code === 'KeyA') {
		// In block mode, let the browser handle Ctrl+A natively so it selects
		// text within the focused block only, not across all blocks.
		if (store.feature.slots.isBlock()) return

		event.preventDefault()

		const selection = window.getSelection()
		const anchorNode = store.feature.slots.container()?.firstChild
		const focusNode = store.feature.slots.container()?.lastChild

		if (!selection || !anchorNode || !focusNode) return
		selection.setBaseAndExtent(anchorNode, 0, focusNode, 1)

		store.feature.caret.selecting('all')
	}
}