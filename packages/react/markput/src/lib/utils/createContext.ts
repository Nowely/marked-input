import {createContext as createReactContext, useContext} from 'react'

export const createContext = <T>(name: string) => {
	const context = createReactContext<T | undefined>(undefined)
	context.displayName = name

	const useHook = () => {
		const value = useContext(context)
		if (value === undefined) {
			throw new Error(`Context "${name}" not found. Make sure to wrap component in its Provider.`)
		}
		return value
	}

	return [useHook, context.Provider, context] as const
}