/**
 * Merges multiple style objects, with later values overriding earlier ones
 *
 * @param styles - Style objects to merge (object, undefined, null, false)
 * @returns Merged style object or undefined if all values are falsy
 */
export function mergeStyles<T extends object>(...styles: (T | undefined | null | false)[]): T | undefined {
	const merged = {} as T
	for (const style of styles) {
		if (style) {
			Object.assign(merged, style)
		}
	}

	return Object.keys(merged).length > 0 ? merged : undefined
}
