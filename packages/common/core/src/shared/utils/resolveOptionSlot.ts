export function resolveOptionSlot<T extends object>(optionConfig: T | ((base: T) => T) | undefined, baseProps: T): T {
	if (optionConfig !== undefined) {
		return typeof optionConfig === 'function' ? optionConfig(baseProps) : optionConfig
	}
	return baseProps ?? {}
}