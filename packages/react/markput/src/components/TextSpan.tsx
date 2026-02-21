import type {ClipboardEvent} from 'react'
import {useLayoutEffect, useRef} from 'react'
import {resolveSlot, resolveSlotProps} from '../lib/utils/resolveSlot'
import {useStore} from '../lib/hooks/useStore'
import {useToken} from '../lib/providers/TokenProvider'

/**
 * TextSpan - renders text tokens (non-annotated text)
 *
 * This component renders editable text content. In nested contexts, text tokens
 * render as plain text without contentEditable to maintain atomic mark behavior.
 *
 * Editing Behavior:
 * - Root-level TextSpan: contentEditable enabled for direct text editing
 * - Nested TextSpan: renders as plain text (non-editable) within marks
 * - Native browser caret movement works between editable zones
 * - Marks are treated as atomic blocks from text editing perspective
 *
 * The hybrid model (atomic blocks with internal editing) works naturally:
 * - Text level: Marks are atomic units (Del/Backspace removes entire mark)
 * - Mark level: Each Mark component is independent and can be editable
 * - Nested text: Plain text content within nested marks
 *
 * React 19 Note:
 * Uses ref-based content setting via useLayoutEffect instead of React children
 * to prevent caret reset during re-renders caused by style changes.
 */
export const TextSpan = () => {
	const token = useToken()
	const ref = useRef<HTMLSpanElement>(null)
	const {readOnly, SpanComponent, spanProps} = useStore(
		state => ({
			readOnly: state.props.readOnly,
			SpanComponent: resolveSlot('span', state),
			spanProps: resolveSlotProps('span', state),
		}),
		true
	)

	// Ensure it's a TextToken
	if (token.type !== 'text') {
		throw new Error('TextSpan component expects a TextToken')
	}

	// Set content via ref to prevent React from resetting caret during re-renders
	useLayoutEffect(() => {
		if (ref.current && ref.current.textContent !== token.content) {
			ref.current.textContent = token.content
		}
	}, [token.content])

	return (
		<SpanComponent
			{...spanProps}
			ref={ref}
			contentEditable={!readOnly}
			onPaste={handlePaste}
			suppressContentEditableWarning
		/>
	)
}

function handlePaste(e: ClipboardEvent<HTMLSpanElement>) {
	e.preventDefault()
	const text = e.clipboardData.getData('text')
	document.execCommand('insertText', false, text)
}
