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
	return {isDone, toggle, readOnly: mark.readOnly ?? false, childrenRaw: mark.childrenRaw}
}

// ─── Mark components (one per option) ─────────────────────────────────────────

export const TodoItemMark = () => {
	const {isDone, toggle, readOnly, childrenRaw} = useTodo()

	return (
		<span className={`${styles.todo} ${isDone ? styles.done : ''}`.trim()}>
			<input type="checkbox" className={styles.checkbox} checked={isDone} onChange={toggle} disabled={readOnly} />
			{childrenRaw}
		</span>
	)
}

export const TodoIndent1Mark = () => {
	const {isDone, toggle, readOnly, childrenRaw} = useTodo()

	return (
		<span className={`${styles.todoIndent1} ${isDone ? styles.done : ''}`.trim()}>
			<input type="checkbox" className={styles.checkbox} checked={isDone} onChange={toggle} disabled={readOnly} />
			{childrenRaw}
		</span>
	)
}