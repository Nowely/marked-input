import {FormEvent, ClipboardEvent} from 'react'
import {getChildProps} from '../utils/functions/getChildProps'
import {useMark} from '../utils/hooks/useMark'
import {useStore} from '../utils/hooks/useStore'

//Editable block - edit text here
export const EditableSpan = () => {
	const {label, change, readOnly, ref} = useMark()
	const spanOverride = useStore(getChildProps('span'), true)

	const handleInput = (e: FormEvent<HTMLSpanElement>) => {
		const label = e.currentTarget.textContent ?? ''
		change({label}, {silent: true})
	}

	return (
		<span
			{...spanOverride}
			ref={ref}
			contentEditable={!readOnly}
			suppressContentEditableWarning
			onInput={handleInput}
			onPaste={handlePaste}
			children={label}
		/>
	)
}

function handlePaste(e: ClipboardEvent<HTMLSpanElement>) {
	e.preventDefault()
	const text = e.clipboardData.getData('text')
	document.execCommand('insertText', false, text)
}