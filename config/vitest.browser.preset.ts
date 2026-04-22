export function createChromiumBrowserPreset<T>(provider: T) {
	return {
		enabled: true,
		provider,
		instances: [{browser: 'chromium' as const}],
		viewport: {width: 1280, height: 720},
		headless: true,
		screenshotFailures: false,
	}
}