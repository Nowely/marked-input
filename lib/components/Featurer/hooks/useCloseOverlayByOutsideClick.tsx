import {useEffect} from 'react'
import {SystemEvent} from '../../../constants'
import {useStore} from '../../../utils'
import {useSelector} from '../../../utils/useSelector'

export function useCloseOverlayByOutsideClick() {
	const store = useStore()
	const match = useSelector(state => state.overlayMatch)

	useEffect(() => {
		if (!match) return

		const handleClick = (event: MouseEvent) => {
			let target = event.target as HTMLElement | null
			if (store.overlayRef.current?.contains(target) || store.containerRef.current?.contains(target)) return
			store.bus.send(SystemEvent.ClearTrigger)
		}

		document.addEventListener('click', handleClick)
		return () => document.removeEventListener('click', handleClick)
	}, [match])
}