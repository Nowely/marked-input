import {faker} from '@faker-js/faker'
import {setProjectAnnotations as setReactAnnotations} from '@storybook/react-vite'
import {setProjectAnnotations as setVueAnnotations} from '@storybook/vue3-vite'
import {afterAll, beforeAll, vi} from 'vitest'

import preview from './.storybook/preview'

if (process.env.FRAMEWORK === 'react') {
	setReactAnnotations(preview)
} else {
	setVueAnnotations(preview)
}

// Freeze faker + Date so faker-driven and clock-driven stories are reproducible.
// We ONLY fake `Date` — NOT setTimeout / setInterval / performance — because the
// MarkedInput component uses real timers for debouncing, overlay animations, etc.
//
// This setupFile runs per-file for every browser spec in both React and Vue
// projects, so we MUST pair useFakeTimers with useRealTimers in afterAll —
// otherwise a fake Date leaks to other specs and breaks anything that compares
// timestamps to "now".
beforeAll(() => {
	faker.seed(123)
	vi.useFakeTimers({toFake: ['Date']})
	vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
})

afterAll(() => {
	vi.useRealTimers()
})