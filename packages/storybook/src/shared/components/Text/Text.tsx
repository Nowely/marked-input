import {useState} from 'react'

import './Text.css'

function computeStats(value: string): string {
	if (!value) return '0 words · 0 chars · 0 lines'
	const words = value.trim().split(/\s+/).filter(Boolean).length
	const chars = value.length
	const lines = value.split('\n').length
	return `${words} words · ${chars} chars · ${lines} lines`
}

interface PlainValuePanelProps {
	value: string
	position: 'right' | 'bottom'
}

export const PlainValuePanel = ({value, position}: PlainValuePanelProps) => {
	const [copied, setCopied] = useState(false)

	const handleCopy = () => {
		void navigator.clipboard.writeText(value)
		setCopied(true)
		setTimeout(() => setCopied(false), 1500)
	}

	return (
		<div className={`pvp-container pvp-${position}`}>
			<button className="pvp-copy" onClick={handleCopy}>
				{copied ? 'Copied!' : 'Copy'}
			</button>
			<div className="pvp-scroll">
				<pre className="pvp-pre" data-value={value}>
					{value || <em className="pvp-empty">(empty)</em>}
				</pre>
			</div>
			<div className="pvp-footer">
				<span className="pvp-footer-label">Plain text</span>
				<span>{computeStats(value)}</span>
			</div>
		</div>
	)
}