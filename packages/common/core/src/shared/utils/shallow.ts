export function shallow(objA: unknown, objB: unknown) {
	if (Object.is(objA, objB)) {
		return true
	}
	if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
		return false
	}
	const keysA = Object.keys(objA)
	if (keysA.length !== Object.keys(objB).length) {
		return false
	}
	for (const key of keysA) {
		if (!Object.prototype.hasOwnProperty.call(objB, key)) {
			return false
		}
		if (!Object.is(Reflect.get(objA, key), Reflect.get(objB, key))) {
			return false
		}
	}
	return true
}