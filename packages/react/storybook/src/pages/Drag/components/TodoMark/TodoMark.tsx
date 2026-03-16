import {useMark} from '@markput/react'
import {useState} from 'react'

import type {TodoMarkProps} from './types'

export const TodoMark = ({nested, style, todo}: TodoMarkProps) => {
	const mark = useMark()
	const [isDone, setIsDone] = useState(mark.value === 'x')

	return (
		<span
			style={{
				...style,
				margin: '0 1px',
				opacity: isDone ? 0.55 : undefined,
			}}
		>
			{todo !== undefined && (
				<input
					type="checkbox"
					checked={isDone}
					onChange={() => {
						const next = !isDone
						setIsDone(next)
						mark.value = next ? 'x' : ' '
					}}
					disabled={mark.readOnly}
					style={{marginRight: 6}}
				/>
			)}
			{nested}
		</span>
	)
}