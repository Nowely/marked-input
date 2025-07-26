import React from 'react'
import ReactDOM from 'react-dom/client'
import './style.css'
import {Story} from '../../../../storybook/stories'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		<Story.Base.Configured />
	</React.StrictMode>
)
