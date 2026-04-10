/** A signal or computed callable that has a .use() method for framework subscription. */
export type Subscribable<T = unknown> = (() => T) & {use(): T}

export interface LifecycleAdapter {
	onMount(callback: () => void): void
	onUnmount(callback: () => void): void
	/**
	 * Watch signal deps and run callback after framework render.
	 * First run is immediate (matches Vue immediate:true / React mount effect).
	 */
	watchPostRender(deps: Subscribable[], callback: () => void): void
	/**
	 * Watch a signal dep and run callback after framework DOM commit.
	 * First run is skipped (only fires on changes).
	 */
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