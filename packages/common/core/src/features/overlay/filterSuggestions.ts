export function filterSuggestions(data: string[], search: string): string[] {
	const query = search.toLowerCase()
	return data.filter(s => s.toLowerCase().includes(query))
}