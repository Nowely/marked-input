import type {Store} from '../store'

export function handleBeforeInput(store: Store, event: InputEvent): void {
	const selecting = store.selecting
	if (selecting !== 'all' || !isFullSelection(store)) {
		if (selecting === 'all') store.selecting = undefined
		return
	}

	if (event.inputType === 'insertFromPaste') return

	event.preventDefault()

	const newContent = event.inputType.startsWith('delete') ? '' : (event.data ?? '')

	replaceAllContentWith(store, newContent)
}

export function handlePaste(store: Store, event: ClipboardEvent): void {
	const selecting = store.selecting
	if (selecting !== 'all' || !isFullSelection(store)) {
		if (selecting === 'all') store.selecting = undefined
		return
	}

	event.preventDefault()
	const newContent = event.clipboardData?.getData('text/plain') ?? ''
	replaceAllContentWith(store, newContent)
}

function isFullSelection(store: Store): boolean {
	const sel = window.getSelection()
	const container = store.refs.container
	if (!sel?.rangeCount || !container?.firstChild || !container?.lastChild) return false

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

export function replaceAllContentWith(store: Store, newContent: string): void {
	store.nodes.focus.target = null
	store.selecting = undefined

	store.props.onChange?.(newContent)

	if (store.props.value === undefined) {
		store.tokens = store.parser?.parse(newContent) ?? [
			{
				type: 'text' as const,
				content: newContent,
				position: {start: 0, end: newContent.length},
			},
		]
	}

	queueMicrotask(() => {
		const firstChild = store.refs.container?.firstChild as HTMLElement | null
		if (firstChild) {
			store.recovery = {
				anchor: store.nodes.focus,
				caret: newContent.length,
			}
			firstChild.focus()
		}
	})
}
