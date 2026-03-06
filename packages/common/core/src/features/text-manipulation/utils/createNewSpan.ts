export function createNewSpan(span: string, annotation: string, index: number, source: string) {
	return span.slice(0, index) + annotation + span.slice(index + source.length)
}