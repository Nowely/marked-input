import {memo} from 'react'

import {useStore} from '../lib/providers/StoreContext'
import {Container} from './Container'

export const NormalContainer = memo(() => {
	const store = useStore()
	const tokens = store.state.tokens.use()
	const className = store.state.className.use()
	const style = store.state.style.use()
	const refs = store.refs

	return <Container tokens={tokens} containerRef={el => (refs.container = el)} className={className} style={style} />
})

NormalContainer.displayName = 'NormalContainer'