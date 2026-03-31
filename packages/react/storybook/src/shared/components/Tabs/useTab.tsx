import {useState} from 'react'

import type {Tab} from './Tabs'
import {Tabs} from './Tabs'

export const useTab = <const T extends readonly Tab[]>(tabs: T) => {
	type TabValue = T[number]['value']
	const [activeTab, setActiveTabId] = useState<TabValue>(tabs[0]?.value as TabValue)

	const handleChange = (value: string) => {
		if (tabs.some(tab => tab.value === value)) {
			setActiveTabId(value as TabValue)
		}
	}

	const Tab = () => <Tabs tabs={tabs} activeTabId={activeTab} onChange={handleChange} />

	return {
		Tab,
		activeTab,
	} as const
}