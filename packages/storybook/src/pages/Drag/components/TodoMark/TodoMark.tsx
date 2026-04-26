import {useMark} from '@markput/react'
import type {MarkProps} from '@markput/react'
import {useState} from 'react'

import styles from './TodoMark.module.css'

// ─── Shared state hook ────────────────────────────────────────────────────────

const useTodo = () => {
	const mark = useMark()
	const [isDone, setIsDone] = useState(mark.value === 'x')
	const toggle = () => {
		const newDone = !isDone
		setIsDone(newDone)
		mark.update({value: newDone ? 'x' : ' '})
	}
	return {isDone, toggle, readOnly: mark.readOnly}
}

// ─── Mark components (one per option) ─────────────────────────────────────────

export const TodoItemMark = ({children}: MarkProps) => {
	const {isDone, toggle, readOnly} = useTodo()

	return (
		<div className={`${styles.todo} ${isDone ? styles.done : ''}`.trim()}>
			<input type="checkbox" className={styles.checkbox} checked={isDone} onChange={toggle} disabled={readOnly} />
			{children}
		</div>
	)
}

export const TodoIndent1Mark = ({children}: MarkProps) => {
	const {isDone, toggle, readOnly} = useTodo()

	return (
		<span className={`${styles.todoIndent1} ${isDone ? styles.done : ''}`.trim()}>
			<input type="checkbox" className={styles.checkbox} checked={isDone} onChange={toggle} disabled={readOnly} />
			{children}
		</span>
	)
}