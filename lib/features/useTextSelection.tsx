import {useEffect, useRef} from 'react'
import {useStore} from '../utils/hooks/useStore'

export function useTextSelection() {
	const store = useStore()
	const pressedUp = useRef(false)
	const ref = useRef<Node | null>(null)

	useEffect(() => {
		const listener = (e: MouseEvent) => {
			ref.current = e.target as Node
			pressedUp.current = true
		}

		document.addEventListener('mousedown', listener)
		return () => document.removeEventListener('mousedown', listener)
	}, [])

	useEffect(() => {
		const listener = (e: MouseEvent) => {
			const isPressed = pressedUp.current
			const isNotInnerSome =
				!store.refs.container.current?.contains(ref.current) || ref.current !== e.target
			const isInside = window.getSelection()?.containsNode(store.refs.container.current!, true)

			if (isPressed && isNotInnerSome && isInside) {
				store.selecting = true
			}
		}

		document.addEventListener('mousemove', listener)
		return () => document.removeEventListener('mousemove', listener)
	}, [])

	useEffect(() => {
		const listener = () => {
			pressedUp.current = false
			ref.current = null
			store.selecting = false
		}

		document.addEventListener('mouseup', listener)
		return () => document.removeEventListener('mouseup', listener)
	}, [])

	useSelectionListener()
}

function useSelectionListener() {
	const store = useStore()
	const selecting = useStore(store => store.selecting)

	useEffect(() => {
		if (!selecting) return

		const nodes = [...store.refs.container.current!.children] as HTMLElement[]
		const preservedState = nodes.map(value => value.contentEditable)

		nodes.forEach(value => value.contentEditable = 'false')

		return () => nodes.forEach((value, index) => value.contentEditable = preservedState[index])

	}, [selecting])
}