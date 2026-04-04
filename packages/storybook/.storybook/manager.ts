import React from 'react'
import {Button} from 'storybook/internal/components'
import {addons, types, useStorybookApi} from 'storybook/manager-api'

const isReact = window.location.port === '6006'
const otherPort = isReact ? '6007' : '6006'
const otherLabel = isReact ? 'Vue' : 'React'

const ADDON_ID = 'framework-switcher'
const TOOL_ID = `${ADDON_ID}/tool`

function FrameworkSwitcherTool() {
	const api = useStorybookApi()
	const storyId = api.getCurrentStoryData().id
	const path = storyId ? `?path=/story/${storyId}` : ''
	const url = `http://localhost:${otherPort}/${path}`

	return React.createElement(
		Button,
		{onClick: () => window.open(url, '_blank'), title: `Open in ${otherLabel} Storybook`},
		otherLabel
	)
}

addons.register(ADDON_ID, () => {
	addons.add(TOOL_ID, {
		type: types.TOOL,
		title: otherLabel,
		render: FrameworkSwitcherTool,
	})
})