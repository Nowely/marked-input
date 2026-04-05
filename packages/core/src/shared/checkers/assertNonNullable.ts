export function assertNonNullable<T>(value: T): asserts value is NonNullable<T> {
	// oxlint-disable-next-line no-unnecessary-condition
	if (value === null || value === undefined) throw new Error('Value must be a non nullable!')
}