import type {ReactNode} from 'react'
import {Fragment} from 'react'

import styles from '../theme/notion.module.css'

export interface PropertiesPanelProps {
	/** A value is a node, so a chip, an avatar stack or a link can be handed in whole. */
	properties: readonly {name: string; value: ReactNode}[]
	addLabel?: string
	onAddProperty?: () => void
}

/** The label/value grid under the title, plus the muted line that adds a row to it. */
export const PropertiesPanel = ({properties, addLabel = '+ Add a property', onAddProperty}: PropertiesPanelProps) => (
	<div className={styles.properties}>
		{properties.map(property => (
			<Fragment key={property.name}>
				<span className={styles.propertyLabel}>{property.name}</span>
				<span className={styles.propertyValue}>{property.value}</span>
			</Fragment>
		))}
		<button className={styles.addProperty} onClick={onAddProperty} type="button">
			{addLabel}
		</button>
	</div>
)