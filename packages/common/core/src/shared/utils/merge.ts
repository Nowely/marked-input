export function merge<T extends object>(...objects: (T | undefined | null | false)[]): T | undefined {
	// oxlint-disable-next-line no-unsafe-argument, no-unsafe-call, no-unsafe-return
	const result = Object.assign({}, ...objects.filter(Boolean)) as T
	return Object.keys(result).length > 0 ? result : undefined
}