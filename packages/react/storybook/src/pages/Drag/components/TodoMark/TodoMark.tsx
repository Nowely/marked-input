import {useMark} from '@markput/react'
import type {MarkProps} from '@markput/react'
import {useCallback, useReducer, useState} from 'react'

import styles from './TodoMark.module.css'

export type TodoType = 'heading' | 'todo' | 'todo-indent1' | 'todo-indent2' | 'blockquote' | 'counter'

export interface TodoMarkProps extends MarkProps {
	type: TodoType
}

const CLASS_MAP: Record<TodoType, string> = {
	heading: styles.heading,
	todo: styles.todo,
	'todo-indent1': styles.todoIndent1,
	'todo-indent2': styles.todoIndent2,
	blockquote: styles.blockquote,
	counter: styles.counter,
}

export const TodoMark = ({nested, type}: TodoMarkProps) => {
	const {isDone} = useTodoState()

	const isTodo = type === 'todo' || type === 'todo-indent1' || type === 'todo-indent2'

	return (
		<span className={`${CLASS_MAP[type]} ${isTodo && isDone ? styles.done : ''}`.trim()}>
			<TodoCheckbox visible={isTodo} />
			<CounterWidget visible={type === 'counter'} />
			{nested}
		</span>
	)
}

interface TodoCheckboxProps {
	visible?: boolean
}

const TodoCheckbox = ({visible = true}: TodoCheckboxProps) => {
	const {isDone, toggle, readOnly} = useTodoState()

	if (!visible) {
		return null
	}

	return <input type="checkbox" checked={isDone} onChange={toggle} disabled={readOnly} className={styles.checkbox} />
}

interface CounterWidgetProps {
	visible?: boolean
}

const CounterWidget = ({visible = true}: CounterWidgetProps) => {
	const mark = useMark()

	if (!visible) {
		return null
	}

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
		</span>
	)
}

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
	}
}