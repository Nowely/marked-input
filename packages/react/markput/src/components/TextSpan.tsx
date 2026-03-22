import {useLayoutEffect, useRef} from 'react'

import {useSlot} from '../lib/hooks/useSlot'
import {useToken} from '../lib/providers/TokenContext'

export const TextSpan = () => {
	const token = useToken()
	const ref = useRef<HTMLSpanElement>(null)

	const [SpanComponent, spanProps] = useSlot('span')

	if (token.type !== 'text') {
		throw new Error('TextSpan component expects a TextToken')
	}

	useLayoutEffect(() => {
		if (ref.current && ref.current.textContent !== token.content) {
			ref.current.textContent = token.content
		}
	}, [token.content])

	return <SpanComponent {...spanProps} ref={ref} />
}