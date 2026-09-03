import {defineComponent} from 'vue'

import type {Property, PropertyCell} from '../vocabulary'
import {Avatar} from './Avatar'
import {AvatarStack} from './AvatarStack'
import {Chip} from './Chip'

import styles from '../theme/notion.module.css'

export interface PropertiesPanelProps {
	properties: readonly Property[]
	addLabel?: string
}

/**
 * The label/value grid under the title, plus the muted line that adds a row to it.
 *
 * It takes the READING rather than a rendered node, where React's twin takes `value: ReactNode`.
 * A node cannot travel through a template as a prop, so the cell vocabulary is what crosses the
 * boundary and the paint of each cell stays here — which keeps both panels reading the same
 * `readProperties`.
 */
export const PropertiesPanel = defineComponent({
	name: 'PropertiesPanel',
	components: {Avatar, AvatarStack, Chip},
	props: {
		properties: {type: Array as () => readonly Property[], required: true},
		addLabel: {type: String, default: '+ Add a property'},
	},
	emits: ['addProperty'],
	setup: () => ({styles, cellKey: (cell: PropertyCell) => JSON.stringify(cell)}),
	template: `
		<div :class="styles.properties">
			<template v-for="property in properties" :key="property.name">
				<span :class="styles.propertyLabel">{{ property.name }}</span>
				<span :class="styles.propertyValue">
					<span v-for="cell in property.cells" :key="cellKey(cell)">
						<Chip v-if="cell.kind === 'chip'" :tone="cell.tone">{{ cell.label }}</Chip>
						<template v-else-if="cell.kind === 'person'"
							><Avatar :name="cell.name" />{{ cell.name }}</template
						>
						<AvatarStack v-else-if="cell.kind === 'people'" :max="3" :names="cell.names" />
						<span v-else-if="cell.kind === 'link'" :class="styles.link" :title="cell.url">{{
							cell.label
						}}</span>
						<template v-else>{{ cell.text }}</template>
					</span>
				</span>
			</template>
			<button :class="styles.addProperty" type="button" @click="$emit('addProperty')">
				{{ addLabel }}
			</button>
		</div>
	`,
})