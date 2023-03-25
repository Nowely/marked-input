import {Children} from 'react'
import {State} from '../types'

export const getChildProps = (type: string) => (state: State) =>
	Children
		.map(state.children, child => child)
		?.find(child => child.type === type)
		?.props