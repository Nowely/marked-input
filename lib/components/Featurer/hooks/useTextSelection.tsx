import {useEffect, useRef} from 'react'
import {useStore} from '../../../utils/hooks/useStore'

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
				store.props.readOnly = true
			}
		}

		document.addEventListener('mousemove', listener)
		return () => document.removeEventListener('mousemove', listener)
	}, [])

	useEffect(() => {
		const listener = () => {
			pressedUp.current = false
			ref.current = null
			store.props.readOnly = false
		}

		document.addEventListener('mouseup', listener)
		return () => document.removeEventListener('mouseup', listener)
	}, [])
}