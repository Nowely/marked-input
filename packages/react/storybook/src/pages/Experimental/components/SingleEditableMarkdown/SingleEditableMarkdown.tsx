import {useEffect, useState} from 'react'
import type {Markup} from '@markput/react'
import {MarkedInput} from '@markput/react'
import {MarkdownContainer, MarkdownMark, MarkdownText} from './components'
import {htmlToMarkdown} from './utils'

// Markdown markup patterns
const BoldMarkup: Markup = '**__nested__**'
const ItalicMarkup: Markup = '*__nested__*'
const CodeMarkup: Markup = '`__nested__`'
const LinkMarkup: Markup = '[__value__](__meta__)'
const HeadingMarkup: Markup = '# __value__\n'
const BlockquoteMarkup: Markup = '> __value__'

const MARKDOWN_OPTIONS = [
	{
		markup: BoldMarkup,
		mark: ({value, children}: any) => ({
			value,
			children,
			type: 'bold',
		}),
	},
	{
		markup: ItalicMarkup,
		mark: ({value, children}: any) => ({
			value,
			children,
			type: 'italic',
		}),
	},
	{
		markup: CodeMarkup,
		mark: ({value, children}: any) => ({
			value,
			children,
			type: 'code',
		}),
	},
	{
		markup: LinkMarkup,
		mark: ({value, children}: any) => ({
			value,
			children,
			type: 'link',
		}),
	},
	{
		markup: HeadingMarkup,
		mark: ({value, children}: any) => ({
			value,
			children,
			type: 'heading',
		}),
	},
	{
		markup: BlockquoteMarkup,
		mark: ({value, children}: any) => ({
			value,
			children,
			type: 'blockquote',
		}),
	},
]

interface SingleEditableMarkdownProps {
	onValueChange?: (value: string) => void
}

/**
 * SingleEditableMarkdown - Markdown editor using uncontrolled contentEditable with MutationObserver
 *
 * Features:
 * - Native markdown editing with **bold**, *italic*, `code`, [link](url)
 * - Cursor stays in place naturally (uncontrolled approach)
 * - Real-time preview and conversion
 * - MutationObserver tracks changes without React re-renders
 *
 * This is the markdown version of SingleEditableUncontrolled!
 */
export const SingleEditableMarkdown = ({onValueChange}: SingleEditableMarkdownProps) => {
	const initialValue = `# Welcome to Markdown Editor

Try editing this text with **bold**, *italic*, \`code\`, and [links](https://example.com).

> This is a blockquote
> You can add multiple lines

- List item 1
- List item 2
- List item 3`

	const [container, setContainer] = useState<HTMLDivElement | null>(null)

	useEffect(() => {
		if (!container) return

		const observer = new MutationObserver(() => {
			const html = container.innerHTML
			const markdown = htmlToMarkdown(html)
			onValueChange?.(markdown)
		})

		observer.observe(container, {
			characterData: true,
			characterDataOldValue: true,
			childList: true,
			subtree: true,
		})

		return () => observer.disconnect()
	}, [container, onValueChange])

	return (
		<MarkedInput
			key="single-editable-markdown"
			defaultValue={initialValue}
			Mark={MarkdownMark}
			slots={{
				container: MarkdownContainer,
				span: MarkdownText,
			}}
			slotProps={{
				container: {
					ref: setContainer,
				} as any,
			}}
			options={MARKDOWN_OPTIONS}
		/>
	)
}
