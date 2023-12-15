import {useEffect} from 'react'
import {SystemEvent} from '../../../constants'
import {KEY} from '../../../constants'
import {useSelector} from '../../../utils/hooks/useSelector'
import {useStore} from '../../../utils/providers/StoreProvider'

export function useCloseOverlayByEsc() {
	const {bus} = useStore()
	const match = useSelector(state => state.overlayMatch)

	useEffect(() => {
		if (!match) return

		const handle = (event: KeyboardEvent) => {
			if (event.key === KEY.ESC)
				bus.send(SystemEvent.ClearTrigger)
		}

		window.addEventListener('keydown', handle)
		return () => window.removeEventListener('keydown', handle)
	}, [match])
}