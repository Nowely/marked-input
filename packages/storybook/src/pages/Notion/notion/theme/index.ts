import './tokens.css'
import styles from './notion.module.css'

/**
 * The component classes, as the CSS module resolves them. Handed out whole rather than wrapped:
 * a showcase page dresses its own furniture — a caption, a section heading — out of the same set
 * the row kinds use, and a curated re-export would be a second list to keep in sync.
 */
export const theme = styles

/**
 * The literal class the tokens are declared on. Mount the page under it; a consumer that spells
 * it by hand and mistypes gets an unstyled page with no error, so it is exported as a value.
 */
export const NOTION_THEME = 'notionTheme'