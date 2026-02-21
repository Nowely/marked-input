import {useListener} from '../../lib/hooks/useListener'
import {useStore} from '../../lib/hooks/useStore'

export const useFocusOnEmptyInput = () => {
	const store = useStore()
	const tokens = useStore(state => state.tokens)

	useListener(
		'click',
		() => {
			if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
				const element = store.refs.container?.firstElementChild as HTMLElement | undefined
				element?.focus()
			}
		},
		[tokens]
	)
}
