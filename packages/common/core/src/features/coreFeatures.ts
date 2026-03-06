import {asFeature, FeatureManager} from './FeatureManager'
import type {Store} from './store/Store'

export const createCoreFeatures = (store: Store): FeatureManager => {
	const manager = new FeatureManager()

	manager
		.register(asFeature('keydown', store.controllers.keydown))
		.register(asFeature('system', store.controllers.system))
		.register(asFeature('focus', store.controllers.focus))
		.register(asFeature('textSelection', store.controllers.textSelection))

	return manager
}