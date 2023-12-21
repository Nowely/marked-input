import {ClipboardEvent, useEffect} from 'react'
import {getChildProps} from '../utils/functions/getChildProps'
import {useMark} from '../utils/hooks/useMark'
import {useStore} from '../utils/hooks/useStore'

//Editable block - edit text here
export const EditableSpan = () => {
	const {label, readOnly, ref} = useMark()
	const spanOverride = useStore(getChildProps('span'), true)

	useEffect(() => {
		if (ref.current)
			ref.current.textContent = label
	}, [])

	return (
		<span
			{...spanOverride}
			ref={ref}
			contentEditable={!readOnly}
			onPaste={handlePaste}
		/>
	)
}

function handlePaste(e: ClipboardEvent<HTMLSpanElement>) {
	e.preventDefault()
	const text = e.clipboardData.getData('text')
	document.execCommand('insertText', false, text)
}