import {type HTMLAttributes, type ReactNode} from 'react'

/**
 * PlainTextSpan - Renders text without contentEditable
 *
 * Since parent Container has contentEditable, we don't need it here.
 * Text is rendered as plain text node or non-editable span.
 */
interface PlainTextSpanProps extends HTMLAttributes<HTMLSpanElement> {
	children?: ReactNode
}

export const PlainTextSpan = ({children}: PlainTextSpanProps) => {
	// Just render text as plain node (without span wrapper)
	// Browser will handle editing through parent contentEditable
	return <>{children}</>
}
