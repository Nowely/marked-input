export function assertNonNullable<T>(value: T): asserts value is NonNullable<T> {
	if (!value) throw new Error('Value must be a non nullable!')
}