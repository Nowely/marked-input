import {useMark} from '@markput/react'
import type {MarkProps} from '@markput/react'
import {useReducer} from 'react'
import type {CSSProperties} from 'react'

export type TodoType = 'heading' | 'todo' | 'todo-indent1' | 'todo-indent2' | 'blockquote'

export interface TodoMarkProps extends MarkProps {
	type: TodoType
}

const STYLE_MAP: Record<TodoType, CSSProperties> = {
	heading: {display: 'block', fontSize: '1.4em', fontWeight: 'bold', margin: '0.3em 0'},
	todo: {display: 'block'},
	'todo-indent1': {display: 'block', paddingLeft: '22px', borderLeft: '2px solid #d0d7de'},
	'todo-indent2': {display: 'block', paddingLeft: '22px', marginLeft: '24px', borderLeft: '2px solid #d0d7de'},
	blockquote: {display: 'block', fontSize: '0.85em', color: '#888', fontStyle: 'italic', marginTop: 16},
}

export const TodoMark = ({nested, type}: TodoMarkProps) => {
	const mark = useMark()
	const [isDone, toggle] = useReducer(state => {
		const newState = !state
		mark.value = newState ? 'x' : ' '
		return newState
	}, mark.value === 'x')

	const isTodo = type === 'todo' || type === 'todo-indent1' || type === 'todo-indent2'

	return (
		<span
			style={{
				...STYLE_MAP[type],
				margin: '0 1px',
				opacity: isTodo && isDone ? 0.55 : undefined,
			}}
		>
			{isTodo && (
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