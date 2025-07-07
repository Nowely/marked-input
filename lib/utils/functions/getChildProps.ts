import {Children} from 'react'
import type {Store} from '../classes/Store'

export const getChildProps = (type: string) => (state: Store) =>
	Children
		.map(state.props.children, child => child)
		?.find(child => child.type === type)
		?.props