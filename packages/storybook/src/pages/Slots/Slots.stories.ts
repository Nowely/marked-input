import {component, story, type PageMeta} from '../../shared/lib/stories'
import {fixtures} from './Slots.fixtures'

const WITH_SLOT_PROPS_VALUE = 'Try pressing @[Enter] or clicking'
const STYLE_MERGING_VALUE = 'Container has @[merged] styles from multiple sources'
const DATA_ATTRIBUTES_VALUE = 'Use @[data] attributes for testing and tracking'

/**
 * Every named export of a CSF file is indexed as a story, so this file exports stories and
 * nothing else — page constants stay module-private.
 */
export default {
	title: 'API/Slots',
	component,
	parameters: {
		docs: {
			description: {
				component:
					'Demonstrates the slots API for customizing internal components. ' +
					'Use `slots` to replace components and `slotProps` to customize their appearance and behavior.',
			},
		},
	},
} satisfies PageMeta

/**
 * Using slotProps to customize styling and add event handlers.
 * This is useful when you want to keep the default components but customize their behavior.
 */
export const WithSlotProps = story({
	args: {
		Mark: fixtures.SimpleMark,
		defaultValue: WITH_SLOT_PROPS_VALUE,
		slotProps: {
			container: {
				className: 'custom-container',
				style: {
					border: '2px solid #4CAF50',
					borderRadius: '8px',
					padding: '12px',
					backgroundColor: '#f5f5f5',
				},
			},
		},
	},
	render: fixtures.renderEventLog,
})

/**
 * Edge case: style merging when the top-level `style` prop and `slotProps.container.style`
 * both contribute. Core merges them onto the one container, `slotProps` last.
 *
 * NOT through `slots.container`, which is what React demonstrated before: a COMPONENT in
 * `slots.container` renders an empty editor under the Vue adapter, so a shared story cannot use
 * one. `CustomComponents` keeps that demo, React-only — reproducer in `Slots.stories.react.tsx`.
 */
export const StyleMerging = story({
	args: {
		Mark: fixtures.SimpleMark,
		defaultValue: STYLE_MERGING_VALUE,
		style: {
			background: '#e3f2fd',
			borderRadius: '8px',
		},
		slotProps: {
			container: {
				style: {
					padding: '16px',
					border: '2px solid #1976d2',
				},
			},
		},
	},
})

/**
 * Data attributes support using camelCase notation.
 * Both adapters convert a camelCase key like `dataUserId` to the `data-user-id` attribute.
 */
export const DataAttributes = story({
	args: {
		Mark: fixtures.SimpleMark,
		defaultValue: DATA_ATTRIBUTES_VALUE,
		slotProps: {
			container: {
				dataTestId: 'marked-input-demo',
				dataModule: 'slots-api',
				dataUserId: 'user-123',
				style: {
					border: '1px solid #999',
					padding: '12px',
					borderRadius: '4px',
					backgroundColor: '#f9f9f9',
				},
			},
		},
	},
})