const weakMap = new WeakMap<object, number>()
let counter = 1

export const getKey = (object: object) => {
	if (weakMap.has(object))
		return weakMap.get(object)

	weakMap.set(object, counter)
	return counter++
}