import {State} from '../types'
import {useSelector} from './useSelector'

const selector = <K extends (keyof State)[], >(state: State, ...values: K): Pick<State, K[number]> =>
	values.reduce((acc, key) => {
		acc[key] = state[key]
		return acc
	}, {} as Record<keyof State, any>)
export const useCurrentState = <K extends (keyof State)[], >(...key: K): Pick<State, K[number]> =>
	useSelector(state => selector(state, ...key), true)