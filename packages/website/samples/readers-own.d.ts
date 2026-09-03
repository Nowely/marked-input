/**
 * Packages the guides ILLUSTRATE but this repo does not install — the reader's own dependencies.
 *
 * Shorthand ambient modules, so anything may be imported from them and the code around the import
 * is still checked. Naming them one by one is the point: a misspelt `@markput/…`, or a package a
 * sample invents, still fails to resolve.
 */
/** Where a dynamic `import('./Heavy')` is redirected — see `declareReadersOwn` in `compile.ts`. */
declare module 'readers-own:*'

declare module '@mui/material'
declare module '@mui/material/styles'
declare module '@chakra-ui/react'
declare module 'antd'
declare module 'lodash'
declare module 'lodash/debounce'
declare module 'react-window'