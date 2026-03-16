import {useMark} from '@markput/react'
import {useCallback, useReducer, useState} from 'react'

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

export const HeadingMark = () => {
	const mark = useMark()
	return <span className={styles.heading}>{mark.nested}</span>
}

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

export const BlockquoteMark = () => {
	const mark = useMark()
	return <span className={styles.blockquote}>{mark.nested}</span>
}

export const CounterMark = () => {
	const mark = useMark()
	const step = parseInt(mark.meta || '1', 10)
	const readOnly = mark.readOnly ?? false

	const [count, setCount] = useState(() => parseInt(mark.value || '0', 10))

	const decrement = useCallback(() => {
		setCount(prev => {
			const newValue = prev - step
			mark.value = String(newValue)
			return newValue
		})
	}, [step, mark])

	const increment = useCallback(() => {
		setCount(prev => {
			const newValue = prev + step
			mark.value = String(newValue)
			return newValue
		})
	}, [step, mark])

	return (
		<span className={styles.counter}>
			<button onClick={decrement} disabled={readOnly}>
				-
			</button>
			<span>{count}</span>
			<button onClick={increment} disabled={readOnly}>
				+
			</button>
			{mark.nested}
		</span>
	)
}