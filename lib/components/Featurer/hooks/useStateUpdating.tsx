import {useEffect} from 'react'
import {extractOptions, useStore} from '../../../utils'
import {MarkedInputProps} from '../../MarkedInput'

export const useStateUpdating = (props: MarkedInputProps<any>) => {
	const store = useStore()
	const {options, ...other} = props
	useEffect(() => store.setState({options: extractOptions(options)}), [options])
	useEffect(() => store.setState({...other}))
}