export type UseHookFactory = (sig: unknown) => () => unknown

let _factory: UseHookFactory | undefined

export function setUseHookFactory(f: UseHookFactory): void {
	_factory = f
}

export function getUseHookFactory(): UseHookFactory {
	if (!_factory) throw new Error('[markput] setUseHookFactory() must be called before using signal.use()')
	return _factory
}