import {SystemEvent, annotate, createNewSpan, toString} from '@markput/core'
import {useListener} from '../../utils/hooks/useListener'
import {useStore} from '../../utils/hooks/useStore'

//TODO upgrade to full members of react events to external
export function useSystemListeners() {
	const store = useStore()

	useListener(
		SystemEvent.Change,
		() => {
			const {onChange} = store.props

			if (!store.nodes.focus.target) return

			// Update token content
			const token = store.tokens[store.nodes.focus.index]
			if (token.type === 'text') {
				token.content = store.nodes.focus.content
			} else if (token.type === 'mark') {
				// Update mark value from the editable content
				token.value = store.nodes.focus.content
			}

			onChange?.(toString(store.tokens))
			store.bus.send(SystemEvent.Parse)
			//bus.send(SystemEvent.CheckTrigger) TODO check on value change
		},
		[]
	)

	useListener(
		SystemEvent.Delete,
		({token}) => {
			const {onChange} = store.props

			store.tokens.splice(store.tokens.indexOf(token), 1)

			onChange?.(toString(store.tokens))
		},
		[]
	)

	useListener(
		SystemEvent.Select,
		event => {
			const {Mark, onChange} = store.props
			const {
				mark,
				match: {option, span, index, source},
			} = event

			// Use ParserV2 annotate with new format
			const annotation =
				mark.type === 'mark'
					? annotate(option.markup!, {
							value: mark.value,
							meta: mark.meta,
						})
					: annotate(option.markup!, {
							value: mark.content,
						})

			const newSpan = createNewSpan(span, annotation, index, source)

			store.recovery = Mark
				? {caret: 0, anchor: store.nodes.input.next, isNext: true}
				: {caret: index + annotation.length, anchor: store.nodes.input}

			if (store.nodes.input.target) {
				store.nodes.input.content = newSpan
				const inputToken = store.tokens[store.nodes.input.index]
				if (inputToken.type === 'text') {
					inputToken.content = newSpan
				}

				store.nodes.focus.target = store.nodes.input.target
				store.nodes.input.clear()
				onChange?.(toString(store.tokens))
				store.bus.send(SystemEvent.Parse)
			}
		},
		[]
	)
}
