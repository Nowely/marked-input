import {assertAnnotated, useNode} from '../utils'
import {useSelector} from '../utils/useSelector'

export function Piece() {
	const {data} = useNode()
	const {options, Mark} = useSelector(state => ({options: state.options, Mark: state.Mark}), true)

	assertAnnotated(data.mark)

	const defaultProps = {label: data.mark.label, value: data.mark.value}
	const props = options[data.mark.optionIndex].initMark?.(defaultProps) ?? defaultProps

	//TODO correct typing
	// @ts-ignore
	return <Mark {...props}/>
}