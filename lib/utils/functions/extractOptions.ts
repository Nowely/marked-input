import {Option} from '../../types'
import {DefaultOptionProps} from '../../constants'

export function extractOptions(options?: Option[]): Option[] {
	if (options?.length) return options.map(initOption)

	return [DefaultOptionProps]

	function initOption(props: Option, index: number) {
		return Object.assign({}, DefaultOptionProps, props, {index})
	}
}