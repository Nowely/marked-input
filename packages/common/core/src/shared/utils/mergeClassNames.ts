/**
 * Merges multiple class names, filtering out falsy values
 *
 * @param classes - Class names to merge (strings, undefined, null, false)
 * @returns Merged class name string or undefined if all values are falsy
 */
export function mergeClassNames(...classes: (string | undefined | null | false)[]): string | undefined {
	return classes.filter(Boolean).join(' ') || undefined
}
