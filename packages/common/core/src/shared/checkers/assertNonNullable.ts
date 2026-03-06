export function assertNonNullable<T>(value: T): asserts value is NonNullable<T> {
	if (value === null || value === undefined) throw new Error('Value must be a non nullable!')
}