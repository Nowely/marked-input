import {useListener} from '../../../utils/hooks/useListener'
import {useStore} from '../../../utils/hooks/useStore'

export const useFocusOnEmptyInput = () => {
	const pieces = useStore(state => state.pieces)
	useListener('click', () => {
		if (pieces.length === 1 && pieces.head?.data.mark.label === '')
			pieces.head?.data.ref.current?.focus()
	}, [pieces])
}