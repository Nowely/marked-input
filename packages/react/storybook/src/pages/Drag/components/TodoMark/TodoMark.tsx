import {useMark} from '@markput/react'
import {useState} from 'react'

import styles from './TodoMark.module.css'

// ─── Shared state hook ────────────────────────────────────────────────────────

const useTodo = () => {
	const mark = useMark()
	const [isDone, setIsDone] = useState(mark.value === 'x')
	const toggle = () => {
		const newDone = !isDone
		setIsDone(newDone)
		mark.value = newDone ? 'x' : ' '
	}
	return {isDone, toggle, readOnly: mark.readOnly ?? false, nested: mark.nested}
}

// ─── Mark components (one per option) ─────────────────────────────────────────

export const TodoItemMark = () => {
	const {isDone, toggle, readOnly, nested} = useTodo()

	return (
		<span className={`${styles.todo} ${isDone ? styles.done : ''}`.trim()}>
			<input type="checkbox" className={styles.checkbox} checked={isDone} onChange={toggle} disabled={readOnly} />
			{nested}
		</span>
	)
}

export const TodoIndent1Mark = () => {
	const {isDone, toggle, readOnly, nested} = useTodo()

	return (
		<span className={`${styles.todoIndent1} ${isDone ? styles.done : ''}`.trim()}>
			<input type="checkbox" className={styles.checkbox} checked={isDone} onChange={toggle} disabled={readOnly} />
			{nested}
		</span>
	)
}