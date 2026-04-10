import type {MarkputHandler, Store} from '@markput/core'
import {getLifecycleAdapterFactory} from '@markput/core'
import {useImperativeHandle} from 'react'

export function useCoreFeatures(store: Store, ref: React.Ref<MarkputHandler> | undefined) {
	useImperativeHandle(ref, () => store.handler, [store])

	// oxlint-disable-next-line no-non-null-assertion -- factory is always registered via side-effect import in MarkedInput.tsx
	const adapter = getLifecycleAdapterFactory()!()
	store.lifecycle.setup(adapter)
	// activate() registers React hooks (useEffect/useLayoutEffect) — React-specific extension
	// oxlint-disable-next-line no-unsafe-type-assertion -- React adapter always has activate(); core interface doesn't expose it
	;(adapter as unknown as {activate(): void}).activate()
}