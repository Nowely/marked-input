import {useStore} from '../utils/hooks/useStore'
import {useToken} from '../utils/providers/TokenProvider'

export function Piece() {
	const node = useToken()
	const {options, Mark} = useStore(store => ({options: store.props.options, Mark: store.props.Mark}), true)

	// Ensure it's a MarkToken
	if (node.type !== 'mark') {
		throw new Error('Piece component expects a MarkToken')
	}

	const defaultProps = {value: node.value, meta: node.meta}
	// TODO correct typing
	// @ts-expect-error
	const props = options[node.descriptor.index].initMark?.(node) ?? defaultProps

	//TODO correct typing
	// @ts-ignore
	return <Mark {...props} />
}
