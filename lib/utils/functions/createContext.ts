import React, {Context, useContext} from 'react'

export const createContext = <T, >(name: string): [() => T, React.Provider<NonNullable<T>>, React.Context<NonNullable<T>>] => {
	const defaultContext = React.createContext<T | undefined>(undefined)
	defaultContext.displayName = name

	const hook = createContextHook(defaultContext)
	const provider = defaultContext.Provider as React.Provider<NonNullable<T>>
	const context = defaultContext as React.Context<NonNullable<T>>

	return [hook, provider, context]


	function createContextHook<T, >(context: Context<T>) {
		return () => {
			const value = useContext(context)

			if (value) return value as NonNullable<T>

			throw new Error(`The context ${context.displayName} didn't found!`)
		}
	}
}