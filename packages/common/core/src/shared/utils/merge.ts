export function merge<T extends object>(...objects: (T | undefined | null | false)[]): T | undefined {
	const result = {} as T
	for (const obj of objects) {
		if (obj) {
			Object.assign(result, obj)
		}
	}

	return Object.keys(result).length > 0 ? result : undefined
}
