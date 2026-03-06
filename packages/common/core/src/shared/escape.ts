// escape RegExp special characters to match RegExp.escape behavior
// Escapes all characters that have special meaning in regular expressions
export const escape = (str: string): string => {
	return str.replace(/[.*+?^${}()|[\]\\\\]/g, '\\$&')
}