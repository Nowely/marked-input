import type {Store} from '../store/Store'
import {asFeature, FeatureManager} from './FeatureManager'

export const createCoreFeatures = (store: Store): FeatureManager => {
	const manager = new FeatureManager()

	manager
		.register(asFeature('keydown', store.controllers.keydown))
		.register(asFeature('system', store.controllers.system))
		.register(asFeature('focus', store.controllers.focus))
		.register(asFeature('textSelection', store.controllers.textSelection))
		.register(asFeature('contentEditable', store.controllers.contentEditable))

	return manager
}