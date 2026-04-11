import type {Store} from '../../store'

export function isFullSelection(store: Store): boolean {
	const sel = window.getSelection()
	const container = store.refs.container
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
		// In block/drag mode, let the browser handle Ctrl+A natively so it selects
		// text within the focused block only, not across all blocks.
		if (store.props.drag()) return

		event.preventDefault()

		const selection = window.getSelection()
		const anchorNode = store.refs.container?.firstChild
		const focusNode = store.refs.container?.lastChild

		if (!selection || !anchorNode || !focusNode) return
		selection.setBaseAndExtent(anchorNode, 0, focusNode, 1)

		store.state.selecting('all')
	}
}