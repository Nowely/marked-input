import {IconButton} from '@storybook/components'
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-type-assertion */
import {addons, types, useStorybookApi} from '@storybook/manager-api'
import React from 'react'

const isReact = window.location.port === '6006'
const otherPort = isReact ? '6007' : '6006'
const otherLabel = isReact ? 'Vue' : 'React'

const ADDON_ID = 'framework-switcher'
const TOOL_ID = `${ADDON_ID}/tool`

function FrameworkSwitcherTool() {
	const api = useStorybookApi() as any
	const storyId = api.getCurrentStoryData()?.id as string | undefined
	const path = storyId ? `?path=/story/${storyId}` : ''
	const url = `http://localhost:${otherPort}/${path}`

	return React.createElement(
		IconButton,
		{onClick: () => window.open(url, '_blank'), title: `Open in ${otherLabel} Storybook`},
		otherLabel
	)
}

;(addons as any).register(ADDON_ID, () => {
	;(addons as any).add(TOOL_ID, {
		type: (types as any).TOOL,
		title: otherLabel,
		render: FrameworkSwitcherTool,
	})
})