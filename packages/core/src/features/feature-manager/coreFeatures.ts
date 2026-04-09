import type {Store} from '../store/Store'
import {asFeature, FeatureManager} from './FeatureManager'

export const createCoreFeatures = (store: Store): FeatureManager => {
	const manager = new FeatureManager()

	manager
		.register(asFeature('keydown', store.features.keydown))
		.register(asFeature('system', store.features.system))
		.register(asFeature('focus', store.features.focus))
		.register(asFeature('textSelection', store.features.textSelection))
		.register(asFeature('contentEditable', store.features.contentEditable))
		.register(asFeature('copy', store.features.copy))

	return manager
}