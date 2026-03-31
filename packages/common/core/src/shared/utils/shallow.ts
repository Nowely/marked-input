export function shallow(objA: unknown, objB: unknown) {
	if (Object.is(objA, objB)) {
		return true
	}
	if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
		return false
	}
	const a = objA as Record<string, unknown>
	const b = objB as Record<string, unknown>
	const keysA = Object.keys(a)
	if (keysA.length !== Object.keys(b).length) {
		return false
	}
	for (let i = 0; i < keysA.length; i++) {
		if (!Object.prototype.hasOwnProperty.call(b, keysA[i]) || !Object.is(a[keysA[i]], b[keysA[i]])) {
			return false
		}
	}
	return true
}