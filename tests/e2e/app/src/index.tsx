import React from 'react'
import ReactDOM from 'react-dom/client'
import {Configured} from 'storybook/stories/Base.stories'
import './style.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <Configured/>
    </React.StrictMode>
)
