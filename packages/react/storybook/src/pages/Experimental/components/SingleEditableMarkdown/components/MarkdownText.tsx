import {type HTMLAttributes, type ReactNode} from 'react'

/**
 * MarkdownText - Renders markdown text content
 *
 * Since parent Container has contentEditable, we render text as-is.
 * Browser will handle editing through parent contentEditable.
 */
interface MarkdownTextProps extends HTMLAttributes<HTMLSpanElement> {
	children?: ReactNode
}

export const MarkdownText = ({children}: MarkdownTextProps) => {
	return <>{children}</>
}
