import {defineComponent, ref} from 'vue'

import type {Tab} from './Tabs'
import {Tabs} from './Tabs'

/**
 * The vue twin of `useTab.tsx`: same call shape, same return names. `activeTab` is a `Ref`
 * rather than a plain value — that is what a vue caller reads reactively, and a setup return
 * unwraps it in the template, so `activeTab === 'preview'` still reads the same on both sides.
 *
 * No type parameter: react's `<const T extends readonly Tab[]>` cannot narrow `activeTab`
 * either, because `Tab['value']` is `string` and inference widens the literals to it. Here it
 * would only be a parameter used once, which `no-unnecessary-type-parameters` refuses.
 */
export const useTab = (tabs: readonly Tab[]) => {
	const activeTab = ref(tabs[0]?.value)

	const handleChange = (value: string) => {
		if (tabs.some(tab => tab.value === value)) {
			activeTab.value = value
		}
	}

	const Tab = defineComponent({
		components: {Tabs},
		setup: () => ({tabs, activeTab, handleChange}),
		template: '<Tabs :tabs="tabs" :activeTabId="activeTab" :onChange="handleChange" />',
	})

	return {
		Tab,
		activeTab,
	} as const
}