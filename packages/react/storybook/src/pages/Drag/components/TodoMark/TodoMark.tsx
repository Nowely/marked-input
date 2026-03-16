import {useMark} from '@markput/react'
import type {MarkProps} from '@markput/react'
import {useReducer} from 'react'
import type {CSSProperties} from 'react'

export interface TodoMarkProps extends MarkProps {
	style?: CSSProperties
	todo?: 'pending' | 'done'
}

export const TodoMark = ({nested, style, todo}: TodoMarkProps) => {
	const mark = useMark()
	const [isDone, toggle] = useReducer(state => {
		const newState = !state
		mark.value = newState ? 'x' : ' '
		return newState
	}, mark.value === 'x')

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
					onChange={toggle}
					disabled={mark.readOnly}
					style={{marginRight: 6}}
				/>
			)}
			{nested}
		</span>
	)
}