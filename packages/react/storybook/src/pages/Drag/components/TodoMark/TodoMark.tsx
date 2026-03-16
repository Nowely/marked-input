import {useMark} from '@markput/react'
import type {MarkProps} from '@markput/react'
import {useReducer} from 'react'

import styles from './TodoMark.module.css'

export type TodoType = 'heading' | 'todo' | 'todo-indent1' | 'todo-indent2' | 'blockquote'

export interface TodoMarkProps extends MarkProps {
	type: TodoType
}

const CLASS_MAP: Record<TodoType, string> = {
	heading: styles.heading,
	todo: styles.todo,
	'todo-indent1': styles.todoIndent1,
	'todo-indent2': styles.todoIndent2,
	blockquote: styles.blockquote,
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
		<span className={`${CLASS_MAP[type]} ${isTodo && isDone ? styles.done : ''}`.trim()}>
			{isTodo && (
				<input
					type="checkbox"
					checked={isDone}
					onChange={toggle}
					disabled={mark.readOnly}
					className={styles.checkbox}
				/>
			)}
			{nested}
		</span>
	)
}