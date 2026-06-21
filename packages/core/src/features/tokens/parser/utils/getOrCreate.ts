export function getOrCreate<K, V>(map: Map<K, V[]>, key: K): V[] {
	let arr = map.get(key)
	if (!arr) {
		arr = []
		map.set(key, arr)
	}
	return arr
}