import {useLayoutEffect, useRef} from 'react'

import {useToken} from '../lib/providers/TokenContext'
import type {MarkProps} from '../types'

export const Span = (_props: MarkProps) => {
	const token = useToken()
	const ref = useRef<HTMLSpanElement>(null)

	if (token.type !== 'text') {
		throw new Error('Span expects a text token')
	}

	useLayoutEffect(() => {
		if (ref.current && ref.current.textContent !== token.content) {
			ref.current.textContent = token.content
		}
	}, [token.content])

	return <span ref={ref} />
}