import {useMark} from '@markput/react'
import {useReducer} from 'react'

import styles from './TodoMark.module.css'

// ─── Shared state hook ────────────────────────────────────────────────────────

const useTodoState = () => {
	const mark = useMark()
	const [isDone, toggle] = useReducer(state => {
		const newState = !state
		mark.value = newState ? 'x' : ' '
		return newState
	}, mark.value === 'x')

	return {
		isDone,
		toggle,
		readOnly: mark.readOnly ?? false,
		nested: mark.nested,
	}
}

// ─── Shared checkbox component ────────────────────────────────────────────────

const TodoCheckbox = () => {
	const {isDone, toggle, readOnly} = useTodoState()

	return <input type="checkbox" checked={isDone} onChange={toggle} disabled={readOnly} className={styles.checkbox} />
}

// ─── Mark components (one per option) ─────────────────────────────────────────

export const TodoItemMark = () => {
	const {isDone, nested} = useTodoState()

	return (
		<span className={`${styles.todo} ${isDone ? styles.done : ''}`.trim()}>
			<TodoCheckbox />
			{nested}
		</span>
	)
}

export const TodoIndent1Mark = () => {
	const {isDone, nested} = useTodoState()

	return (
		<span className={`${styles.todoIndent1} ${isDone ? styles.done : ''}`.trim()}>
			<TodoCheckbox />
			{nested}
		</span>
	)
}