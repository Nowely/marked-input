import {denote} from '@markput/react'
import {useState} from 'react'

import {DOCS_URL, GITHUB_URL, INITIAL_VALUE, MentionMarkup, STORYBOOK_URL, TagMarkup} from './content'
import {Editor} from './Editor'

const BrandMark = () => (
	<svg aria-hidden="true" height="28" viewBox="28 28 124 124" width="28">
		<path d="M105 146A58 58 0 1 1 146 105L122.8 98.8A34 34 0 1 0 98.8 122.8Z" fill="currentColor" />
		<rect fill="#FFB020" height="32" rx="10" width="32" x="74" y="74" />
		<circle cx="122.5" cy="122.5" fill="#FFB020" r="14" />
	</svg>
)

export const App = () => {
	const [value, setValue] = useState(INITIAL_VALUE)
	const [status, setStatus] = useState('')

	const displayText = denote(value, mark => mark.value, [MentionMarkup, TagMarkup])

	return (
		<div className="page">
			<header className="header">
				<a className="brand" href={DOCS_URL}>
					<BrandMark />
					Markput
				</a>
				<nav className="nav">
					<a href={DOCS_URL}>Docs</a>
					<a href={GITHUB_URL}>GitHub</a>
				</nav>
			</header>

			<main className="hero">
				<h1>One plain string. Rich inline marks.</h1>
				<p>
					The mentions and tags below are ordinary React components rendered from markup inside a plain
					string. Edit the text — the string underneath follows.
				</p>

				<Editor onChange={setValue} onMarkClick={setStatus} value={value} />
				<p className="status">{status}</p>

				<div className="panel-label">The value — one plain string</div>
				<pre className="panel">{value}</pre>

				<div className="panel-label">denote() — display text</div>
				<pre className="panel">{displayText}</pre>
			</main>

			<footer className="footer">
				Built with @markput/react · <a href={DOCS_URL}>Docs</a> · <a href={STORYBOOK_URL}>Storybook</a> ·{' '}
				<a href={GITHUB_URL}>GitHub</a>
			</footer>
		</div>
	)
}