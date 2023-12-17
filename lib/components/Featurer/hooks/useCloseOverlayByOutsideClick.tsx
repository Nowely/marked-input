import {useEffect} from 'react'
import {EVENT} from '../../../constants'
import {useSelector} from '../../../utils/hooks/useSelector'
import {useStore} from '../../../utils/providers/StoreProvider'

export function useCloseOverlayByOutsideClick() {
	const store = useStore()
	const match = useSelector(state => state.overlayMatch)

	useEffect(() => {
		if (!match) return

		const handleClick = (event: MouseEvent) => {
			let target = event.target as HTMLElement | null
			if (store.overlayRef.current?.contains(target) || store.containerRef.current?.contains(target)) return
			store.bus.send(EVENT.ClearTrigger)
		}

		document.addEventListener('click', handleClick)
		return () => document.removeEventListener('click', handleClick)
	}, [match])
}