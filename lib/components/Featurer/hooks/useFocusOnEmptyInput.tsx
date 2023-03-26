import {useListener} from '../../../utils/useListener'
import {useSelector} from '../../../utils/useSelector'

export const useFocusOnEmptyInput = () => {
	const pieces = useSelector(state => state.pieces)
	useListener('click', () => {
		if (pieces.length === 1 && pieces.head?.data.mark.label === '')
			pieces.head?.data.ref.current?.focus()
	}, [pieces])
}