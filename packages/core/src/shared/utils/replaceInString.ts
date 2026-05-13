import type {Range} from '../editorContracts'

export function replaceInString(current: string, range: Range, replacement: string): string | undefined {
	if (range.start < 0 || range.end < range.start || range.end > current.length) return undefined
	return current.slice(0, range.start) + replacement + current.slice(range.end)
}