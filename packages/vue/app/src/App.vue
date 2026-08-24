<script setup lang="ts">
import {denote} from '@markput/vue'
import {computed, ref} from 'vue'

import {DOCS_URL, GITHUB_URL, INITIAL_VALUE, MentionMarkup, STORYBOOK_URL, TagMarkup} from './content'
import Editor from './Editor.vue'

const value = ref(INITIAL_VALUE)
const status = ref('')

const displayText = computed(() => denote(value.value, mark => mark.value, [MentionMarkup, TagMarkup]))
</script>

<template>
	<div class="page">
		<header class="header">
			<a class="brand" :href="DOCS_URL">
				<svg aria-hidden="true" height="28" viewBox="28 28 124 124" width="28">
					<path d="M105 146A58 58 0 1 1 146 105L122.8 98.8A34 34 0 1 0 98.8 122.8Z" fill="currentColor" />
					<rect fill="#FFB020" height="32" rx="10" width="32" x="74" y="74" />
					<circle cx="122.5" cy="122.5" fill="#FFB020" r="14" />
				</svg>
				Markput
			</a>
			<nav class="nav">
				<a :href="DOCS_URL">Docs</a>
				<a :href="GITHUB_URL">GitHub</a>
			</nav>
		</header>

		<main class="hero">
			<h1>One plain string. Rich inline marks.</h1>
			<p>
				The mentions and tags below are ordinary Vue components rendered from markup inside a plain string. Edit
				the text — the string underneath follows.
			</p>

			<Editor :value="value" @change="value = $event" @markClick="status = $event" />
			<p class="status">{{ status }}</p>

			<div class="panel-label">The value — one plain string</div>
			<pre class="panel">{{ value }}</pre>

			<div class="panel-label">denote() — display text</div>
			<pre class="panel">{{ displayText }}</pre>
		</main>

		<footer class="footer">
			Built with @markput/vue · <a :href="DOCS_URL">Docs</a> · <a :href="STORYBOOK_URL">Storybook</a> ·
			<a :href="GITHUB_URL">GitHub</a>
		</footer>
	</div>
</template>
