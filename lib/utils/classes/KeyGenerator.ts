export class KeyGenerator {
	#counter = 1
	#map = new WeakMap<object, number>()

	get(object: object) {
		if (this.#map.has(object))
			return this.#map.get(object)

		this.#map.set(object, this.#counter)
		return this.#counter++
	}
}