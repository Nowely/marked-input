/** A signal or computed callable that has a .use() method for framework subscription. */
export type Subscribable<T = unknown> = (() => T) & {use(): T}

export interface LifecycleAdapter {
	onLifecycle(mount: () => void, unmount: () => void): void
	/** Watch signal deps and run callback after framework render. First run is immediate. */
	watchPostRender(deps: Subscribable[], callback: () => void): void
	/** Watch a signal dep and run callback after framework DOM commit. First run is skipped. */
	watchPostCommit(dep: Subscribable, callback: () => void): void
}

export type LifecycleAdapterFactory = () => LifecycleAdapter

let _adapterFactory: LifecycleAdapterFactory | undefined

export function setLifecycleAdapterFactory(f: LifecycleAdapterFactory): void {
	_adapterFactory = f
}

export function getLifecycleAdapterFactory(): LifecycleAdapterFactory | undefined {
	return _adapterFactory
}