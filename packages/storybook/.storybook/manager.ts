import {IconButton} from '@storybook/components'
import {addons, types, useStorybookApi} from '@storybook/manager-api'
import React from 'react'

const isReact = window.location.port === '6006'
const otherPort = isReact ? '6007' : '6006'
const otherLabel = isReact ? 'Vue' : 'React'

const ADDON_ID = 'framework-switcher'
const TOOL_ID = `${ADDON_ID}/tool`

function FrameworkSwitcherTool() {
	// oxlint-disable-next-line typescript-eslint/no-unsafe-call, typescript-eslint/no-unsafe-member-access
	const api = useStorybookApi()
	// oxlint-disable-next-line typescript-eslint/no-unsafe-call, typescript-eslint/no-unsafe-member-access
	const storyId = api.getCurrentStoryData()?.id
	const path = storyId ? `?path=/story/${storyId}` : ''
	const url = `http://localhost:${otherPort}/${path}`

	return React.createElement(
		IconButton,
		{onClick: () => window.open(url, '_blank'), title: `Open in ${otherLabel} Storybook`},
		otherLabel
	)
}

// oxlint-disable-next-line typescript-eslint/no-unsafe-call, typescript-eslint/no-unsafe-member-access
addons.register(ADDON_ID, () => {
	// oxlint-disable-next-line typescript-eslint/no-unsafe-call, typescript-eslint/no-unsafe-member-access
	addons.add(TOOL_ID, {
		// oxlint-disable-next-line typescript-eslint/no-unsafe-member-access
		type: types.TOOL,
		title: otherLabel,
		render: FrameworkSwitcherTool,
	})
})