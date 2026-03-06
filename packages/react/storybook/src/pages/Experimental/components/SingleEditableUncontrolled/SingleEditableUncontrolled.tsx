import {MarkedInput} from '@markput/react'
import {useEffect, useState} from 'react'

import {CustomContainer, HTMLMark, PlainTextSpan} from './components'
import {htmlToPlainText} from './utils'

interface SingleEditableUncontrolledProps {
	onValueChange: (value: string) => void
}

/**
 * SingleEditableUncontrolled - Encapsulates uncontrolled contentEditable logic with MutationObserver
 *
 * Manages its own state and tracks changes via MutationObserver.
 * Cursor stays in place naturally.
 * Notifies parent component via onValueChange callback.
 *
 * This is the recommended approach for single contentEditable!
 */
export const SingleEditableUncontrolled = ({onValueChange}: SingleEditableUncontrolledProps) => {
	const initialValue = 'Hello @[John](id:123) and @[World](greeting)! Try editing - cursor stays in place!'
	const [container, setContainer] = useState<HTMLDivElement | null>(null)

	useEffect(() => {
		if (!container) return

		const observer = new MutationObserver(() => {
			const html = container.innerHTML
			const plainText = htmlToPlainText(html)
			onValueChange(plainText)
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
			key="single-editable-uncontrolled"
			defaultValue={initialValue}
			Mark={HTMLMark}
			slots={{
				container: CustomContainer,
				span: PlainTextSpan,
			}}
			slotProps={{
				container: {
					ref: setContainer,
				} as any,
			}}
		/>
	)
}