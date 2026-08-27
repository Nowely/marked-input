import {defineComponent} from 'vue'

import styles from '../theme/notion.module.css'

export interface PageChromeProps {
	/** "Product / Launches / Apollo" as its parts; the slashes are drawn, not typed. */
	breadcrumb: readonly string[]
	editedLabel: string
}

/** The bar above the cover: where the page is, when it changed, and what can be done to it. */
export const PageChrome = defineComponent({
	name: 'PageChrome',
	props: {
		breadcrumb: {type: Array as () => readonly string[], required: true},
		editedLabel: {type: String, required: true},
	},
	emits: ['share', 'more'],
	setup: () => ({styles}),
	template: `
		<div :class="styles.topBar">
			<template v-for="(crumb, index) in breadcrumb" :key="crumb">
				<span v-if="index > 0" :class="styles.breadcrumbSeparator">/</span>
				<span :class="styles.breadcrumbItem">{{ crumb }}</span>
			</template>
			<div :class="styles.topBarActions">
				<span :class="styles.topBarStatus">{{ editedLabel }}</span>
				<button :class="styles.topBarButton" type="button" @click="$emit('share')">Share</button>
				<!-- Icon-only, so the name has to come from somewhere: an ellipsis reads as nothing. -->
				<button
					aria-label="More actions"
					:class="styles.topBarButton"
					type="button"
					@click="$emit('more')"
				>…</button>
			</div>
		</div>
	`,
})