import {useCallback, useState} from 'react'
import {MarkedInput} from 'rc-marked-input'
import {CustomContainer, PlainTextSpan, HTMLMark} from './components'
import {htmlToPlainText} from './utils'

interface SingleEditableControlledProps {
	onValueChange: (value: string) => void
}

/**
 * SingleEditableControlled - Encapsulates controlled contentEditable logic
 *
 * Manages its own state and re-renders on every change.
 * Notifies parent component via onValueChange callback.
 *
 * ⚠️ This demonstrates the PROBLEM with controlled contentEditable:
 * - React re-renders DOM on every change
 * - Cursor position resets
 * - Editing experience is broken
 */
export const SingleEditableControlled = ({onValueChange}: SingleEditableControlledProps) => {
	const [value, setValue] = useState('Hello @[John](id:123) and @[World](greeting)!')
	const containerRef = useState<HTMLDivElement | null>(null)[1]

	const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
		const html = e.currentTarget.innerHTML
		const plainText = htmlToPlainText(html)
		setValue(plainText)
		onValueChange(plainText)
	}, [onValueChange])

	return (
		<MarkedInput
			key="single-editable-controlled"
			value={value}
			onChange={() => {}} // Not used - we use manual onInput instead
			Mark={HTMLMark}
			slots={{
				container: CustomContainer,
				span: PlainTextSpan,
			}}
			slotProps={{
				container: {
					ref: containerRef,
					onInput: handleInput,
				} as any,
			}}
		/>
	)
}
