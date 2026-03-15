import './Text.css'

export interface TextProps {
	value: string
	label?: string
	className?: string
}

export const Text = ({value, label, className}: TextProps) => (
	<div className={`text-container${className ? ` ${className}` : ''}`}>
		{label && (
			<div className="text-header">
				<span className="text-label">{label}</span>
			</div>
		)}
		<pre className="text-pre">{value}</pre>
	</div>
)