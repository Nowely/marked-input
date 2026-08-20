import type {Markup} from '@markput/core'

import {TodoIndent1Mark, TodoItemMark} from './TodoMark'

/**
 * Framework-free: the two markups are typed against core's `Markup`, and `./TodoMark`
 * resolves to `TodoMark.react.tsx` or `TodoMark.vue.ts` per project. The array is left
 * un-annotated on purpose — the framework `Option` type it has to satisfy is the story
 * file's, and that file is compiled once per project.
 */
// Separator-less (issue 08): the TodoList story sets `separator: '\n'`, and each
// item's trailing slot closes at its own row boundary.
const ITEM_MARKUP: Markup = '- [__value__] __slot__'
const INDENT_MARKUP: Markup = '\t- [__value__] __slot__'

export const TODO_OPTIONS = [
	{markup: ITEM_MARKUP, Mark: TodoItemMark},
	{markup: INDENT_MARKUP, Mark: TodoIndent1Mark},
]

export const TODO_VALUE = `
- [ ] Design Phase
	- [ ] Create wireframes
	- [x] Define color palette
	- [ ] Design component library
- [x] Research
	- [x] Analyze competitors
	- [x] User interviews
	- [x] Draft interview questions
	- [x] Schedule 5 sessions
- [ ] Development
	- [ ] Set up CI/CD pipeline
	- [x] Write unit tests
	- [ ] API integration
	- [ ] Auth endpoints
	- [ ] Data sync
- [ ] Launch
	- [ ] Final QA pass
	- [ ] Deploy to production
`