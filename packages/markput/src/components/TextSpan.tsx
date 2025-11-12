import {ClipboardEvent, useRef} from 'react'
import {getChildProps} from '../utils/functions/getChildProps'
import {useStore} from '../utils/hooks/useStore'
import {useToken} from '../utils/providers/TokenProvider'

// TextSpan - renders text tokens (non-annotated text)
export const TextSpan = () => {
	const token = useToken()
	const ref = useRef<HTMLSpanElement>(null)
	const readOnly = useStore(state => state.props.readOnly)
	const spanOverride = useStore(getChildProps('span'), true)

	// Ensure it's a TextToken
	if (token.type !== 'text') {
		throw new Error('TextSpan component expects a TextToken')
	}

	return (
		<span
			{...spanOverride}
			ref={ref}
			contentEditable={!readOnly}
			onPaste={handlePaste}
			suppressContentEditableWarning
		>
			{token.content}
		</span>
	)
}

function handlePaste(e: ClipboardEvent<HTMLSpanElement>) {
	e.preventDefault()
	const text = e.clipboardData.getData('text')
	document.execCommand('insertText', false, text)
}

