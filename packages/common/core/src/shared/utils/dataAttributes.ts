/**
 * Converts object with camelCase data attribute keys to kebab-case data-* attributes
 *
 * Takes keys like 'dataUserId' and converts to 'data-user-id'
 *
 * @param obj - Object potentially containing camelCase data attribute keys
 * @returns New object with converted data attributes
 *
 * @example
 * convertDataAttrs({ dataUserId: '123', dataUserName: 'John', className: 'test' })
 * // Returns: { 'data-user-id': '123', 'data-user-name': 'John', className: 'test' }
 *
 * convertDataAttrs({ dataTestId * @example
: 'test', dataFoo: 'bar' })
 * // Returns: { 'data-test-id': 'test', 'data-foo': 'bar' }
 */
export function convertDataAttrs(obj: Record<string, unknown> | undefined): Record<string, unknown> {
	if (!obj) return {}

	return Object.fromEntries(
		Object.entries(obj).map(([key, value]) => {
			if (key.startsWith('data') && key.length > 4 && key[4] === key[4].toUpperCase()) {
				const kebab = key
					.slice(4)
					.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
					.toLowerCase()
				return [`data-${kebab}`, value]
			}
			return [key, value]
		})
	)
}
