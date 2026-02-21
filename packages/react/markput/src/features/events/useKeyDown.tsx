import {deleteMark, KEYBOARD} from '@markput/core'
import {useEffect} from 'react'
import {useDownOf} from '../../lib/hooks/useDownOf'
import {useListener} from '../../lib/hooks/useListener'
import {useStore} from '../../lib/hooks/useStore'

//TODO Focus on mark and attribute for this
//TODO different rules for editable
export function useKeyDown() {
	const store = useStore()

	useDownOf(KEYBOARD.LEFT, shiftFocusPrev)
	useDownOf(KEYBOARD.RIGHT, shiftFocusNext)

	useDownOf(KEYBOARD.DELETE, deleteSelfMark)
	useDownOf(KEYBOARD.BACKSPACE, deleteSelfMark)

	useDownOf(KEYBOARD.DELETE, deleteNextMark)
	useDownOf(KEYBOARD.BACKSPACE, deletePrevMark)

	useListener('keydown', selectAllText, [])
	useListener('paste', handlePaste, [])

	// beforeinput doesn't bubble, so we use capture phase on the container
	useEffect(() => {
		const container = store.refs.container
		if (!container) return

		const listener = (event: Event) => {
			handleBeforeInput(event as InputEvent)
		}

		container.addEventListener('beforeinput', listener, true)
		return () => container.removeEventListener('beforeinput', listener, true)
	}, [])

	function shiftFocusPrev(event: KeyboardEvent) {
		const {focus} = store.nodes
		if ((focus.isMark && !focus.isEditable) || focus.isCaretAtBeginning) {
			const prev = focus.prev
			prev.focus()
			if (!prev.isFocused) {
				prev.prev.focus()
				event.preventDefault()
			}
			focus.setCaretToEnd()
		}
	}

	function shiftFocusNext(event: KeyboardEvent) {
		const {focus} = store.nodes
		if ((focus.isMark && !focus.isEditable) || focus.isCaretAtEnd) {
			const next = focus.next
			next.focus()
			if (!next.isFocused) {
				next.next.focus()
				event.preventDefault()
			}
		}
	}

	function deleteSelfMark() {
		if (store.nodes.focus.isMark) deleteMark('self', store)
	}

	function deletePrevMark(event: KeyboardEvent) {
		if (store.nodes.focus.isSpan && store.nodes.focus.isCaretAtBeginning && store.nodes.focus.prev.target) {
			event.preventDefault()
			deleteMark('prev', store)
		}
	}

	//TODO pass focus
	//TODO on && !store.nodes.focus.next.isEditable remove first symbol
	function deleteNextMark(event: KeyboardEvent) {
		if (store.nodes.focus.isSpan && store.nodes.focus.isCaretAtEnd && store.nodes.focus.next.target) {
			event.preventDefault()
			deleteMark('next', store)
		}
	}

	function selectAllText(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.code === 'KeyA') {
			event.preventDefault()

			const selection = window.getSelection()
			const anchorNode = store.refs.container?.firstChild
			const focusNode = store.refs.container?.lastChild

			if (!selection || !anchorNode || !focusNode) return
			selection.setBaseAndExtent(anchorNode, 0, focusNode, 1)

			store.selecting = 'all'
		}
	}

	function isFullSelection(): boolean {
		const sel = window.getSelection()
		const container = store.refs.container
		if (!sel?.rangeCount || !container?.firstChild || !container?.lastChild) return false

		try {
			const range = sel.getRangeAt(0)
			// Check if selection spans the entire container
			return (
				container.contains(range.startContainer) &&
				container.contains(range.endContainer) &&
				range.toString().length > 0
			)
		} catch {
			return false
		}
	}

	function handleBeforeInput(event: InputEvent) {
		// Lazy validation: check if select-all state is still valid
		if (store.selecting !== 'all' || !isFullSelection()) {
			if (store.selecting === 'all') store.selecting = undefined
			return
		}

		// Don't handle paste here - separate handler below
		if (event.inputType === 'insertFromPaste') return

		event.preventDefault()

		// Determine new content based on input type
		const newContent = event.inputType.startsWith('delete') ? '' : (event.data ?? '')

		replaceAllContentWith(newContent)
	}

	function handlePaste(event: ClipboardEvent) {
		// Lazy validation: check if select-all state is still valid
		if (store.selecting !== 'all' || !isFullSelection()) {
			if (store.selecting === 'all') store.selecting = undefined
			return
		}

		event.preventDefault()
		const newContent = event.clipboardData?.getData('text/plain') ?? ''
		replaceAllContentWith(newContent)
	}

	function replaceAllContentWith(newContent: string) {
		// CRITICAL: Clear focus node before onChange to force getTokensByValue path
		// Otherwise getTokensByUI will read stale DOM and overwrite our tokens
		store.nodes.focus.target = null
		store.selecting = undefined

		// Call onChange — triggers value change → useEffect → Parse → getTokensByValue
		store.props.onChange?.(newContent)

		// For uncontrolled components (defaultValue), directly update tokens
		if (store.props.value === undefined) {
			store.tokens = store.parser?.parse(newContent) ?? [
				{
					type: 'text' as const,
					content: newContent,
					position: {start: 0, end: newContent.length},
				},
			]
		}

		// Restore focus after React re-render
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
}
