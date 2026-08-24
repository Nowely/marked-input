// Keep in sync with packages/vue/app/src/content.ts (framework import + storybook URL differ).
import type {Markup} from '@markput/react'

export const MentionMarkup: Markup = '@[__value__](__meta__)'
export const TagMarkup: Markup = '#[__value__]'

export const INITIAL_VALUE =
	'Ship the launch post with @[Ada Lovelace](ada) — the draft is tagged #[release] and #[docs].\n' +
	'Type @ to mention a teammate or # to add a tag.'

export const MENTIONS = [
	{name: 'Ada Lovelace', handle: 'ada'},
	{name: 'Grace Hopper', handle: 'grace'},
	{name: 'Alan Turing', handle: 'alan'},
	{name: 'Margaret Hamilton', handle: 'margaret'},
	{name: 'Katherine Johnson', handle: 'katherine'},
	{name: 'Edsger Dijkstra', handle: 'edsger'},
]

export const TAGS = ['release', 'docs', 'design', 'feedback', 'roadmap', 'breaking-change']

export const DOCS_URL = 'https://markput.vercel.app'
export const GITHUB_URL = 'https://github.com/Nowely/marked-input'
export const STORYBOOK_URL = 'https://markput-react.vercel.app'