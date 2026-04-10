import type {Store} from '@markput/core'
import {getLifecycleAdapterFactory} from '@markput/core'

export function useCoreFeatures(store: Store) {
	// oxlint-disable-next-line no-non-null-assertion -- factory is always registered via side-effect import in MarkedInput.vue
	const adapter = getLifecycleAdapterFactory()!()
	store.lifecycle.setup(adapter)
}