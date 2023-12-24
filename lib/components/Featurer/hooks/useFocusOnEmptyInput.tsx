import {useListener} from '../../../utils/hooks/useListener'
import {useStore} from '../../../utils/hooks/useStore'

export const useFocusOnEmptyInput = () => {
	const store = useStore()
	const tokens = useStore(state => state.tokens)

	useListener('click', () => {
		if (tokens.length === 1 && tokens[0].label === '') {
			const element = store.refs.container.current?.firstElementChild as HTMLElement | undefined
			element?.focus()
		}
	}, [tokens])
}