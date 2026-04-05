import React from 'react'
import {Select} from 'storybook/internal/components'
import {addons, types, useStorybookApi} from 'storybook/manager-api'

const FRAMEWORKS = [
	{id: 'react', label: 'React', devPort: 6006},
	{id: 'vue', label: 'Vue', devPort: 6007},
]

const currentFramework =
	window.location.hostname === 'localhost'
		? FRAMEWORKS.find(f => f.devPort === parseInt(window.location.port))
		: FRAMEWORKS.find(f => window.location.hostname.includes(f.id))
const currentFrameworkId = currentFramework?.id ?? 'react'

function getUrlForFramework(targetId: string, storyId?: string): string {
	const target = FRAMEWORKS.find(f => f.id === targetId)
	if (!target) throw new Error(`Unknown framework: ${targetId}`)
	const path = storyId ? `?path=/story/${storyId}` : ''

	if (window.location.hostname === 'localhost') {
		return `http://localhost:${target.devPort}/${path}`
	}

	const hostname = window.location.hostname.replace(currentFrameworkId, targetId)
	return `${window.location.protocol}//${hostname}/${path}`
}

const ADDON_ID = 'framework-switcher'
const TOOL_ID = `${ADDON_ID}/tool`

function FrameworkSwitcherTool() {
	const api = useStorybookApi()
	// oxlint-disable-next-line typescript-eslint/no-unnecessary-condition
	const storyId = api.getCurrentStoryData()?.id

	return React.createElement(Select, {
		ariaLabel: 'Framework',
		options: FRAMEWORKS.map(f => ({value: f.id, title: f.label})),
		defaultOptions: currentFrameworkId,
		onSelect: value => {
			if (typeof value !== 'string' || value === currentFrameworkId) return
			window.location.href = getUrlForFramework(value, storyId)
		},
	})
}

addons.register(ADDON_ID, () => {
	addons.add(TOOL_ID, {
		type: types.TOOL,
		title: 'Framework',
		render: FrameworkSwitcherTool,
	})
})