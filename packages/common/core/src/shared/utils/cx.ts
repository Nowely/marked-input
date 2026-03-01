export function cx(...classes: (string | undefined | null | false)[]): string | undefined {
	return classes.filter(Boolean).join(' ') || undefined
}
