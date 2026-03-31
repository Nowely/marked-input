import type {CSSProperties, ReactNode} from 'react'

export interface Tab {
	value: string
	label: string
}

export interface TabsProps {
	tabs: readonly Tab[]
	activeTabId: string
	onChange: (tabId: string) => void
	children?: ReactNode
}

export const Tabs = ({tabs, activeTabId, onChange}: TabsProps) => {
	const tabsContainerStyle: CSSProperties = {
		display: 'flex',
		gap: '8px',
		borderBottom: '1px solid #e0e0e0',
		marginBottom: '16px',
	}

	const getTabButtonStyle = (isActive: boolean): CSSProperties => ({
		padding: '8px 16px',
		border: 'none',
		backgroundColor: 'transparent',
		cursor: 'pointer',
		fontSize: '14px',
		fontWeight: 500,
		color: isActive ? '#000' : '#666',
		borderBottom: isActive ? '2px solid #2196f3' : 'none',
		marginBottom: '-1px',
		transition: 'all 0.2s',
	})

	return (
		<div style={tabsContainerStyle}>
			{tabs.map(tab => (
				<button
					key={tab.value}
					style={getTabButtonStyle(activeTabId === tab.value)}
					onClick={() => onChange(tab.value)}
				>
					{tab.label}
				</button>
			))}
		</div>
	)
}