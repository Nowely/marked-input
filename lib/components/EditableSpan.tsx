import {ClipboardEvent, useEffect} from 'react'
import {getChildProps} from '../utils/functions/getChildProps'
import {useMark} from '../utils/hooks/useMark'
import {useStore} from '../utils/hooks/useStore'

//Editable block - edit text here
export const EditableSpan = () => {
	const mark = useMark()
	const spanOverride = useStore(getChildProps('span'), true)
	//TODO this error mark.label = ''

	
	return (
		<span
			{...spanOverride}
			ref={mark.ref}
			contentEditable={!mark.readOnly}
			onPaste={handlePaste}
		/>
	)
}

function handlePaste(e: ClipboardEvent<HTMLSpanElement>) {
	e.preventDefault()
	const text = e.clipboardData.getData('text')
	document.execCommand('insertText', false, text)
}