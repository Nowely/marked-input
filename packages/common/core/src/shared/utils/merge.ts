export function merge<T extends object>(...objects: (T | undefined | null | false)[]): T | undefined {
	const result = Object.assign({}, ...objects.filter(Boolean))
	return Object.keys(result).length > 0 ? result : undefined
}